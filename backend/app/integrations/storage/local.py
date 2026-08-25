import os
from typing import BinaryIO
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

from app.integrations.storage.base import ObjectStorageProvider

class LocalStorageProvider(ObjectStorageProvider):
    def __init__(self, base_dir: str = None):
        if base_dir:
            self.base_dir = Path(base_dir)
        else:
            default_path = "/app/storage_data" if os.path.exists("/app") else "./storage_data"
            self.base_dir = Path(os.getenv("STORAGE_LOCAL_DIR", default_path))
            
        self.base_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"LocalStorageProvider initialized with root directory: {self.base_dir.resolve()}")

    def _get_path(self, object_key: str) -> Path:
        # Prevent directory traversal attacks
        clean_key = object_key.lstrip("/\\")
        return self.base_dir / clean_key

    def upload(self, file_obj: BinaryIO, object_key: str, content_type: str = "application/pdf") -> str:
        dest_path = self._get_path(object_key)
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        file_obj.seek(0)
        with open(dest_path, "wb") as f:
            f.write(file_obj.read())
        return object_key

    def download(self, object_key: str) -> bytes:
        file_path = self._get_path(object_key)
        if not file_path.exists():
            raise FileNotFoundError(f"Document '{object_key}' not found in storage at {file_path}")
        with open(file_path, "rb") as f:
            return f.read()

    def delete(self, object_key: str) -> bool:
        file_path = self._get_path(object_key)
        if file_path.exists():
            try:
                file_path.unlink()
            except Exception as e:
                logger.warning(f"Failed to delete {file_path}: {e}")
        return True

    def exists(self, object_key: str) -> bool:
        return self._get_path(object_key).exists()

    def generate_presigned_url(self, object_key: str, expiration: int = 3600) -> str:
        return f"/api/v1/documents/raw/{object_key}"

storage_provider = LocalStorageProvider()
