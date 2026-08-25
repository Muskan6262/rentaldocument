from abc import ABC, abstractmethod
from typing import List, Dict, Any

class RerankerProvider(ABC):
    @abstractmethod
    def rerank(self, query: str, candidate_chunks: List[Dict[str, Any]], top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Rerank a list of candidate chunks based on their relevance to the query.
        Returns the top_k most relevant chunks.
        """
        pass
