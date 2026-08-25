# Tenant & Owner Rental Agreement Intelligence Platform

## Architecture Decisions

| Area | Selected Technology / Strategy |
|---|---|
| Chunking | Structure-aware / clause-based hierarchical chunking |
| Embedding | OpenAI text-embedding-3-large |
| Embedding Dimensions | Configurable, preferably 1024 or 1536 |
| Vector DB | Qdrant |
| Metadata DB | PostgreSQL |
| Document Versioning | PostgreSQL |
| Retrieval | Hybrid Dense + Sparse/BM25 |
| Filtering | Qdrant metadata filters |
| Reranking | Cohere Rerank / BGE-reranker-v2-m3 |
| Parsing | PyMuPDF / Docling / Unstructured |
| OCR | Selective OCR only |
| Object Storage | S3 / MinIO |
| Multi-tenancy | Mandatory tenant_id isolation |
| Version Isolation | document_id + version_id + is_active |
