from typing import List
from fastembed import TextEmbedding

from app.core.config import settings
from app.integrations.embeddings.base import EmbeddingProvider

class FastembedDenseProvider(EmbeddingProvider):
    def __init__(self):
        self.model = TextEmbedding(model_name=settings.EMBEDDING_MODEL)

    def embed_text(self, text: str) -> List[float]:
        # embed returns a generator of numpy arrays
        embeddings = list(self.model.embed([text]))
        return embeddings[0].tolist()
        
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        # embed returns a generator of numpy arrays
        embeddings = list(self.model.embed(texts))
        return [e.tolist() for e in embeddings]

# Global instance for dependency injection
embedding_provider = FastembedDenseProvider()
