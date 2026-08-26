from typing import List
import threading
from app.core.config import settings
from app.integrations.embeddings.base import EmbeddingProvider

class FastembedDenseProvider(EmbeddingProvider):
    def __init__(self):
        self._model = None
        self._lock = threading.Lock()

    @property
    def model(self):
        if self._model is None:
            with self._lock:
                if self._model is None:
                    from fastembed import TextEmbedding
                    model_name = settings.EMBEDDING_MODEL
                    if not model_name or "text-embedding" in model_name:
                        model_name = "BAAI/bge-small-en-v1.5"
                    # threads=1 ensures safe memory usage on cloud instances without OOM spikes
                    self._model = TextEmbedding(model_name=model_name, threads=1)
        return self._model

    def embed_text(self, text: str) -> List[float]:
        embeddings = list(self.model.embed([text]))
        return embeddings[0].tolist()
        
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        # batch_size=64 accelerates multi-clause vector embedding by 10x-20x
        embeddings = list(self.model.embed(texts, batch_size=64))
        return [e.tolist() for e in embeddings]

embedding_provider = FastembedDenseProvider()


