from typing import List, Dict, Any
import threading

class SparseEmbeddingProvider:
    def __init__(self):
        self._model = None
        self._lock = threading.Lock()

    @property
    def model(self):
        if self._model is None:
            with self._lock:
                if self._model is None:
                    from fastembed.sparse.sparse_text_embedding import SparseTextEmbedding
                    self._model = SparseTextEmbedding(model_name="Qdrant/bm25", threads=1)
        return self._model

    def embed_text(self, text: str) -> Dict[str, Any]:
        """
        Embeds a single string into a sparse vector.
        Returns a dictionary with 'indices' and 'values'.
        """
        sparse_gen = self.model.embed([text])
        sparse_embedding = list(sparse_gen)[0]
        return {
            "indices": sparse_embedding.indices.tolist(),
            "values": sparse_embedding.values.tolist()
        }

    def embed_batch(self, texts: List[str]) -> List[Dict[str, Any]]:
        """
        Embeds a batch of strings into sparse vectors.
        """
        sparse_gen = self.model.embed(texts, batch_size=4)
        results = []
        for sparse_embedding in sparse_gen:
            results.append({
                "indices": sparse_embedding.indices.tolist(),
                "values": sparse_embedding.values.tolist()
            })
        return results

sparse_provider = SparseEmbeddingProvider()

