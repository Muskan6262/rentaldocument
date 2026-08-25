from app.core.config import settings
from .sparse import sparse_provider

if settings.EMBEDDING_PROVIDER == "openai" or "openai" in settings.EMBEDDING_MODEL.lower() or "text-embedding" in settings.EMBEDDING_MODEL.lower():
    from .openai import OpenAIEmbeddingProvider
    embedding_provider = OpenAIEmbeddingProvider()
else:
    from .fastembed_dense import FastembedDenseProvider
    embedding_provider = FastembedDenseProvider()

__all__ = ["embedding_provider", "sparse_provider"]

