from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # API Settings
    PROJECT_NAME: str = "AI Rental Intelligence API"
    SECRET_KEY: str = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    
    # OpenAI (Deprecated)
    OPENAI_API_KEY: str = ""
    
    # Groq (Free Chat LLM)
    GROQ_API_KEY: str = ""
    
    # Embeddings
    EMBEDDING_PROVIDER: str = "fastembed"
    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    EMBEDDING_DIMENSIONS: int = 384
    
    # Qdrant
    VECTOR_DB_PROVIDER: str = "qdrant"
    QDRANT_URL: str = "http://qdrant:6333"
    QDRANT_API_KEY: str = ""
    QDRANT_COLLECTION: str = "rental_agreement_chunks_v2"
    
    # Retrieval
    DENSE_TOP_K: int = 20
    SPARSE_TOP_K: int = 20
    RERANK_TOP_K: int = 8
    
    # Reranker
    RERANKER_PROVIDER: str = "cohere"
    COHERE_API_KEY: str = ""
    RERANKER_MODEL: str = ""
    
    # Object Storage
    OBJECT_STORAGE_PROVIDER: str = "minio"
    S3_ENDPOINT_URL: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "admin"
    S3_SECRET_KEY: str = "password"
    S3_BUCKET: str = "rental-agreements"
    S3_REGION: str = "us-east-1"
    
    # Database (Postgres)
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/rental_intelligence"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
