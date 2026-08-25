from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.models.chat import ChatSession, ChatMessage
from app.models.document import Document
from app.api.endpoints.auth import get_current_tenant_id

router = APIRouter()

@router.get("/")
def list_sessions(
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db)
):
    sessions = db.query(ChatSession).filter(ChatSession.tenant_id == tenant_id).order_by(ChatSession.created_at.desc()).all()
    result = []
    for s in sessions:
        doc = db.query(Document).filter(Document.id == s.document_id).first()
        result.append({
            "id": s.id,
            "document_id": s.document_id,
            "document_title": doc.title if doc else "Unknown Document",
            "title": s.title,
            "created_at": s.created_at,
            "updated_at": s.updated_at
        })
    return {"sessions": result}

@router.get("/{session_id}")
def get_session_messages(
    session_id: str,
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db)
):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.tenant_id == tenant_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc()).all()
    
    return {
        "session_id": session.id,
        "document_id": session.document_id,
        "title": session.title,
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at
            } for m in messages
        ]
    }
