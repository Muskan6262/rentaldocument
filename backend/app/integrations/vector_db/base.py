from abc import ABC, abstractmethod
from typing import List, Dict, Any

class VectorDBProvider(ABC):
    @abstractmethod
    def upsert(self, tenant_id: str, document_id: str, version_id: str, chunks: List[Dict[str, Any]]) -> bool:
        """
        Upsert a list of document chunks into the vector database.
        Each chunk should contain the vector and payload (which must include tenant_id).
        """
        pass
        
    @abstractmethod
    def search(self, tenant_id: str, query_vector: List[float], limit: int = 10, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """
        Search for similar chunks using a query vector.
        tenant_id is mandatory for isolation.
        """
        pass
