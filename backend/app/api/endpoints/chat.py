from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.models.tenant import Tenant
from app.models.chat import ChatSession, ChatMessage
from app.integrations.embeddings import embedding_provider, sparse_provider
from app.integrations.vector_db.qdrant import vector_db_provider
from app.integrations.rerankers.cohere import reranker_provider
from app.core.rag import rag_service
from app.api.endpoints.auth import get_current_tenant_id

router = APIRouter()

class ChatRequest(BaseModel):
    document_id: str
    question: str
    session_id: Optional[str] = None
    temperature: Optional[float] = 0.0
    model: Optional[str] = None
    top_k: Optional[int] = 5
    search_mode: Optional[str] = "hybrid"

@router.post("/query")
def query_document(
    request: ChatRequest,
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db)
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=400, detail="Tenant not found")
        
    if tenant.tokens_used >= tenant.token_quota:
        raise HTTPException(status_code=402, detail="Token quota exceeded. Please upgrade your plan.")
        
    try:
        # Resolve or create session
        if request.session_id:
            session = db.query(ChatSession).filter(ChatSession.id == request.session_id).first()
            if not session:
                raise HTTPException(status_code=404, detail="Session not found")
        else:
            session = ChatSession(
                tenant_id=tenant_id,
                document_id=request.document_id,
                title=request.question[:50] + "..." if len(request.question) > 50 else request.question
            )
            db.add(session)
            db.commit()
            
        # Save User Message
        user_msg = ChatMessage(session_id=session.id, role="user", content=request.question)
        db.add(user_msg)
        db.commit()

        # RAG Pipeline with configured search mode and top_k
        query_vector = embedding_provider.embed_text(request.question) if request.search_mode != "sparse" else None
        sparse_query_vector = sparse_provider.embed_text(request.question) if request.search_mode != "dense" else None
        
        limit_candidates = max(10, (request.top_k or 5) * 3)
        retrieved_chunks = vector_db_provider.search(
            tenant_id=tenant_id,
            query_vector=query_vector,
            sparse_query_vector=sparse_query_vector,
            limit=limit_candidates,
            filters={"document_id": request.document_id}
        )
        
        rerank_k = max(1, min(15, request.top_k or 5))
        reranked_chunks = reranker_provider.rerank(
            query=request.question,
            candidate_chunks=retrieved_chunks,
            top_k=rerank_k
        )
        
        rag_response = rag_service.generate_answer(
            question=request.question,
            chunks=reranked_chunks,
            temperature=request.temperature or 0.0,
            model=request.model
        )
        
        # Save Assistant Message
        assistant_msg = ChatMessage(session_id=session.id, role="assistant", content=rag_response["answer"])
        db.add(assistant_msg)
        
        # Update token usage
        tokens_used = rag_response.get("tokens_used", 0)
        tenant.tokens_used += tokens_used
        
        db.commit()
        
        return {
            "status": "success",
            "session_id": session.id,
            "answer": rag_response["answer"],
            "accuracy": rag_response.get("accuracy", 0),
            "confidence": rag_response.get("confidence", "High"),
            "citations": rag_response["citations"],
            "tokens_used": tokens_used
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Retrieval pipeline failed: {str(e)}")
