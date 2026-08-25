RAG TECHNOLOGY DECISIONS

The approved architecture currently uses:

- Structure-aware hierarchical chunking
- OpenAI text-embedding-3-large
- Qdrant
- PostgreSQL
- Hybrid dense + sparse retrieval
- Metadata filtering
- Reranking
- S3-compatible object storage
- Selective OCR

Do not replace these architectural decisions without explicit instruction.

MULTI-TENANCY SAFETY

Every retrieval request MUST contain tenant_id.

Never perform global vector search across tenants.

Every Qdrant payload MUST contain tenant_id.

Treat missing tenant isolation as a critical security vulnerability.

DOCUMENT VERSIONING

PostgreSQL is the authoritative source for document versions.

Qdrant payloads must reference:

tenant_id
document_id
version_id
is_active

Never retrieve inactive versions by default.

RAG ANSWER QUALITY

Agreement-specific claims must come from retrieved agreement context.

If context does not contain the answer, the chatbot should say that the information was not found in the uploaded agreement.

Never invent:

- rent amounts
- deposits
- dates
- notice periods
- obligations
- penalties
- names
- clauses
- legal terms

Prefer "not found in the agreement" over hallucination.

LEGAL SAFETY

The system is a document-understanding assistant, not a replacement for legal counsel.

Clearly distinguish between:

1. What the uploaded agreement explicitly states
2. General explanation or interpretation

Never represent general legal knowledge as if it appeared inside the agreement.

PARSING

Do not OCR every PDF.

Prefer native extraction.

Use OCR only when native extraction is insufficient.

CHUNKING

Never split rental agreements using only arbitrary fixed token windows.

Use document structure and clauses as the primary chunk boundaries.

Token limits may be used as secondary safeguards for extremely large clauses.

VECTOR DATABASE

Qdrant is a retrieval index.

Do not use Qdrant as the source of truth for:

- document lifecycle
- versions
- tenants
- permissions

These belong in PostgreSQL.

OBJECT STORAGE

Do not store uploaded production documents inside ephemeral backend containers.

Use the ObjectStorageProvider abstraction.
