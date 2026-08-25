import uuid
from typing import List, Dict, Any
from qdrant_client import QdrantClient
from qdrant_client.http import models

from app.core.config import settings
from app.integrations.vector_db.base import VectorDBProvider

class QdrantProvider(VectorDBProvider):
    def __init__(self):
        self.client = QdrantClient(url=settings.QDRANT_URL, api_key=settings.QDRANT_API_KEY)
        self.collection_name = settings.QDRANT_COLLECTION + "_hybrid" # Use new name to avoid conflicts
        self.dimensions = settings.EMBEDDING_DIMENSIONS
        self._ensure_collection_exists()

    def _ensure_collection_exists(self):
        try:
            self.client.get_collection(collection_name=self.collection_name)
        except Exception as e:
            try:
                # Collection doesn't exist, attempt to create it with named dense and sparse vectors
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config={
                        "dense": models.VectorParams(size=self.dimensions, distance=models.Distance.COSINE)
                    },
                    sparse_vectors_config={
                        "sparse": models.SparseVectorParams(
                            index=models.SparseIndexParams(
                                on_disk=False,
                            )
                        )
                    }
                )
                # Create payload index for tenant_id for mandatory filtering
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="tenant_id",
                    field_schema=models.PayloadSchemaType.KEYWORD
                )
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="document_id",
                    field_schema=models.PayloadSchemaType.KEYWORD
                )
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="version_id",
                    field_schema=models.PayloadSchemaType.KEYWORD
                )
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="is_active",
                    field_schema=models.PayloadSchemaType.BOOL
                )
            except Exception as create_err:
                print(f"Warning: Could not connect to or initialize Qdrant at '{settings.QDRANT_URL}': {create_err}")

    def deactivate_document_versions(self, tenant_id: str, document_id: str):
        """
        Marks all existing chunks for a document as inactive so they are excluded from search.
        """
        self.client.set_payload(
            collection_name=self.collection_name,
            payload={"is_active": False},
            points=models.Filter(
                must=[
                    models.FieldCondition(key="tenant_id", match=models.MatchValue(value=tenant_id)),
                    models.FieldCondition(key="document_id", match=models.MatchValue(value=document_id))
                ]
            )
        )

    def upsert(self, tenant_id: str, document_id: str, version_id: str, chunks: List[Dict[str, Any]]) -> bool:
        points = []
        for chunk in chunks:
            # Ensure mandatory metadata is attached
            payload = chunk.get("payload", {})
            payload.update({
                "tenant_id": tenant_id,
                "document_id": document_id,
                "version_id": version_id,
                "is_active": True, # Default to true when freshly upserted
                "text": chunk.get("text", "")
            })
            
            # Extract dense and sparse vectors
            dense_vector = chunk["vector"]
            sparse_vector_data = chunk["sparse_vector"]
            
            points.append(
                models.PointStruct(
                    id=str(uuid.uuid4()),
                    vector={
                        "dense": dense_vector,
                        "sparse": models.SparseVector(
                            indices=sparse_vector_data["indices"],
                            values=sparse_vector_data["values"]
                        )
                    },
                    payload=payload
                )
            )
            
        if points:
            self.client.upsert(
                collection_name=self.collection_name,
                points=points
            )
        return True

    def search(self, tenant_id: str, query_vector: List[float], limit: int = 10, filters: Dict[str, Any] = None, sparse_query_vector: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        if filters is None:
            filters = {}
            
        # MANDATORY TENANT ISOLATION
        must_conditions = [
            models.FieldCondition(
                key="tenant_id",
                match=models.MatchValue(value=tenant_id)
            ),
            models.FieldCondition(
                key="is_active",
                match=models.MatchValue(value=True)
            )
        ]
        
        # Add other filters if provided
        for key, value in filters.items():
            must_conditions.append(
                models.FieldCondition(
                    key=key,
                    match=models.MatchValue(value=value)
                )
            )
            
        filter_obj = models.Filter(must=must_conditions)
        
        # HYBRID SEARCH via Query API with Reciprocal Rank Fusion
        prefetch = [
            models.Prefetch(
                query=query_vector,
                using="dense",
                limit=limit * 2,
            )
        ]
        
        if sparse_query_vector:
            prefetch.append(
                models.Prefetch(
                    query=models.SparseVector(
                        indices=sparse_query_vector["indices"],
                        values=sparse_query_vector["values"]
                    ),
                    using="sparse",
                    limit=limit * 2,
                )
            )
            
        # Execute Query API (Fusion)
        results = self.client.query_points(
            collection_name=self.collection_name,
            prefetch=prefetch,
            query=models.FusionQuery(fusion=models.Fusion.RRF),
            query_filter=filter_obj,
            limit=limit,
            with_payload=True
        )
        
        return [
            {
                "id": hit.id,
                "score": hit.score,
                "payload": hit.payload
            }
            for hit in results.points
        ]

# Global instance for dependency injection
vector_db_provider = QdrantProvider()
