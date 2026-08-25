from typing import List
import openai

from app.core.config import settings
from app.integrations.embeddings.base import EmbeddingProvider

class OpenAIEmbeddingProvider(EmbeddingProvider):
    def __init__(self):
        self.client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.EMBEDDING_MODEL
        self.dimensions = settings.EMBEDDING_DIMENSIONS

    def embed_text(self, text: str) -> List[float]:
        response = self.client.embeddings.create(
            input=text,
            model=self.model,
            dimensions=self.dimensions
        )
        return response.data[0].embedding
        
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        response = self.client.embeddings.create(
            input=texts,
            model=self.model,
            dimensions=self.dimensions
        )
        return [data.embedding for data in response.data]

# Global instance for dependency injection
embedding_provider = OpenAIEmbeddingProvider()
