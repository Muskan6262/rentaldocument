from typing import List
from fastembed import TextEmbedding

from app.core.config import settings
from app.integrations.embeddings.base import EmbeddingProvider

class FastembedDenseProvider(EmbeddingProvider):
    def __init__(self):
        model_name = settings.EMBEDDING_MODEL
        if not model_name or "text-embedding" in model_name:
            model_name = "BAAI/bge-small-en-v1.5"
        self.model = TextEmbedding(model_name=model_name)

    def embed_text(self, text: str) -> List[float]:
        embeddings = list(self.model.embed([text]))
        return embeddings[0].tolist()
        
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        embeddings = list(self.model.embed(texts))
        return [e.tolist() for e in embeddings]

embedding_provider = FastembedDenseProvider()

