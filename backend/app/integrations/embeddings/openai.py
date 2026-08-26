from typing import List
import openai

from app.core.config import settings
from app.integrations.embeddings.base import EmbeddingProvider
from app.integrations.embeddings.fastembed_dense import FastembedDenseProvider

class OpenAIEmbeddingProvider(EmbeddingProvider):
    def __init__(self):
        self.client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.EMBEDDING_MODEL
        self.dimensions = settings.EMBEDDING_DIMENSIONS
        self._fallback_provider = None

    @property
    def fallback(self):
        if self._fallback_provider is None:
            self._fallback_provider = FastembedDenseProvider()
        return self._fallback_provider

    def embed_text(self, text: str) -> List[float]:
        try:
            response = self.client.embeddings.create(
                input=text,
                model=self.model,
                dimensions=self.dimensions
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"Warning: OpenAI embeddings failed ({e}). Falling back to FastEmbed local dense embedding.")
            return self.fallback.embed_text(text)
        
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        try:
            response = self.client.embeddings.create(
                input=texts,
                model=self.model,
                dimensions=self.dimensions
            )
            return [data.embedding for data in response.data]
        except Exception as e:
            print(f"Warning: OpenAI embeddings failed ({e}). Falling back to FastEmbed local dense embedding.")
            return self.fallback.embed_documents(texts)

# Global instance for dependency injection
embedding_provider = OpenAIEmbeddingProvider()
