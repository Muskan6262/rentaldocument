from fastembed.sparse.sparse_text_embedding import SparseTextEmbedding
from typing import List, Dict, Any

class SparseEmbeddingProvider:
    def __init__(self):
        # We use Qdrant/bm25 which is the standard BM25 sparse model
        self.model = SparseTextEmbedding(model_name="Qdrant/bm25")

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
        sparse_gen = self.model.embed(texts)
        results = []
        for sparse_embedding in sparse_gen:
            results.append({
                "indices": sparse_embedding.indices.tolist(),
                "values": sparse_embedding.values.tolist()
            })
        return results

sparse_provider = SparseEmbeddingProvider()
