import os
import uuid
from typing import List, Dict, Any
from qdrant_client import QdrantClient
from qdrant_client.http import models

from app.core.config import settings
from app.integrations.vector_db.base import VectorDBProvider

class QdrantProvider(VectorDBProvider):
    def __init__(self):
        self.collection_name = settings.QDRANT_COLLECTION + "_hybrid" # Use new name to avoid conflicts
        self.dimensions = settings.EMBEDDING_DIMENSIONS
        self.client = self._init_client()
        self._ensure_collection_exists()

    def _init_client(self) -> QdrantClient:
        url = (settings.QDRANT_URL or "").strip()
        api_key = (settings.QDRANT_API_KEY or "").strip() or None
        
        is_placeholder = (
            not url 
            or "your-cluster" in url.lower() 
            or "your_qdrant" in str(api_key).lower()
            or url == "local" 
            or url == ":memory:"
        )
        
        if not is_placeholder:
            try:
                # Test connectivity with 5s timeout
                client = QdrantClient(url=url, api_key=api_key, timeout=5)
                client.get_collections()
                print(f"Connected successfully to remote Qdrant at: {url}")
                return client
            except Exception as conn_err:
                print(f"Warning: Could not connect to remote Qdrant at '{url}' ({conn_err}). Falling back to embedded local storage.")
        
        # Fallback to embedded local Qdrant on disk
        storage_path = os.path.join(settings.STORAGE_LOCAL_DIR, "qdrant_db")
        os.makedirs(storage_path, exist_ok=True)
        print(f"Initialized Embedded Local Qdrant at: {storage_path}")
        return QdrantClient(path=storage_path)

    def _ensure_collection_exists(self):
        try:
            col = self.client.get_collection(collection_name=self.collection_name)
            # Verify dense vector size matches configuration
            existing_dense_size = None
            if hasattr(col.config.params, "vectors") and isinstance(col.config.params.vectors, dict):
                dense_param = col.config.params.vectors.get("dense")
                if dense_param and hasattr(dense_param, "size"):
                    existing_dense_size = dense_param.size
            
            if existing_dense_size and existing_dense_size != self.dimensions:
                print(f"Recreating Qdrant collection '{self.collection_name}' to match new vector dimension {self.dimensions} (was {existing_dense_size})")
                self.client.delete_collection(collection_name=self.collection_name)
                raise Exception("Collection dimension mismatch, triggering recreation")
        except Exception:
            try:
                # Collection doesn't exist or dimension mismatched, create with named dense and sparse vectors
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
        try:
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
        except Exception as e:
            print(f"Warning: Could not deactivate document versions in Qdrant: {e}")

    def delete_document(self, tenant_id: str, document_id: str):
        """
        Deletes all chunks for a document belonging to the tenant from Qdrant.
        """
        try:
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=models.Filter(
                    must=[
                        models.FieldCondition(key="tenant_id", match=models.MatchValue(value=tenant_id)),
                        models.FieldCondition(key="document_id", match=models.MatchValue(value=document_id))
                    ]
                )
            )
        except Exception as e:
            print(f"Warning: Could not delete document points from Qdrant: {e}")

    def upsert(self, tenant_id: str, document_id: str, version_id: str, chunks: List[Dict[str, Any]]) -> bool:
        if not chunks:
            return True

        # Ensure collection matches vector dimensions of the chunks
        sample_dense = chunks[0].get("vector")
        if sample_dense and len(sample_dense) != self.dimensions:
            self.dimensions = len(sample_dense)
            self._ensure_collection_exists()

        points = []
        for chunk in chunks:
            # Ensure mandatory metadata is attached
            payload = chunk.get("payload", {}).copy()
            payload.update({
                "tenant_id": tenant_id,
                "document_id": document_id,
                "version_id": version_id,
                "is_active": True,
                "text": chunk.get("text", "")
            })
            
            dense_vector = chunk["vector"]
            sparse_vector_data = chunk.get("sparse_vector", {"indices": [], "values": []})
            
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
            
        # Batch upsert to avoid large payload errors
        batch_size = 50
        for i in range(0, len(points), batch_size):
            batch = points[i:i + batch_size]
            try:
                self.client.upsert(
                    collection_name=self.collection_name,
                    points=batch
                )
            except Exception as e:
                print(f"Error during Qdrant upsert batch {i//batch_size}: {e}")
                raise e
        return True

    def search(self, tenant_id: str, query_vector: List[float] = None, limit: int = 10, filters: Dict[str, Any] = None, sparse_query_vector: Dict[str, Any] = None) -> List[Dict[str, Any]]:
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
        
        # Build prefetch safely
        prefetch = []
        if query_vector is not None and len(query_vector) > 0:
            prefetch.append(
                models.Prefetch(
                    query=query_vector,
                    using="dense",
                    limit=limit * 2,
                )
            )
        
        if sparse_query_vector is not None and sparse_query_vector.get("indices"):
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
            
        if not prefetch:
            return []

        # Execute Query API (Fusion)
        try:
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
        except Exception as e:
            print(f"Warning: Qdrant search failed ({e}). Returning empty result set.")
            return []


# Global instance for dependency injection
vector_db_provider = QdrantProvider()
