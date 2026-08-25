import os
from app.core.config import settings

storage_type = os.getenv("OBJECT_STORAGE_PROVIDER", getattr(settings, "OBJECT_STORAGE_PROVIDER", "local")).lower()

if storage_type in ("minio", "s3", "r2") and os.getenv("S3_ENDPOINT_URL"):
    from .minio import storage_provider, MinIOStorageProvider
else:
    from .local import storage_provider, LocalStorageProvider

__all__ = ["storage_provider"]

