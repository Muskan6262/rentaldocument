import cohere
from typing import List, Dict, Any
from app.core.config import settings

class CohereReranker:
    def __init__(self):
        # We assume the user adds COHERE_API_KEY to their environment or .env
        api_key = getattr(settings, "COHERE_API_KEY", None)
        if api_key:
            self.client = cohere.Client(api_key=api_key)
        else:
            self.client = None

    def rerank(self, query: str, candidate_chunks: List[Dict[str, Any]], top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Reranks the candidate chunks using Cohere's Rerank API.
        If the API key is not set or there's an error, it degrades gracefully 
        and returns the original ranking.
        """
        if not candidate_chunks:
            return []
            
        if not self.client:
            print("WARNING: COHERE_API_KEY not set. Returning original vector search ranking.")
            return candidate_chunks[:top_k]
            
        # Extract the text snippets for reranking
        documents = []
        valid_chunks = []
        for chunk in candidate_chunks:
            payload = chunk.get("payload", {})
            text = payload.get("text", "")
            if text and text.strip():
                documents.append(text)
                valid_chunks.append(chunk)
                
        if not documents:
            return candidate_chunks[:top_k]
            
        try:
            # Call Cohere Rerank API
            results = self.client.rerank(
                model="rerank-english-v3.0",
                query=query,
                documents=documents,
                top_n=top_k,
                return_documents=False
            )
            
            # Map back to original chunks using the returned indices
            reranked_chunks = []
            for result in results.results:
                chunk = valid_chunks[result.index].copy()
                chunk["score"] = float(result.relevance_score)
                reranked_chunks.append(chunk)
                
            return reranked_chunks
            
        except Exception as e:
            print(f"WARNING: Cohere reranking failed ({str(e)}). Degrading to original ranking.")
            return candidate_chunks[:top_k]

reranker_provider = CohereReranker()
