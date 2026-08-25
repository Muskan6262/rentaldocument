from abc import ABC, abstractmethod
from typing import BinaryIO

class ObjectStorageProvider(ABC):
    @abstractmethod
    def upload(self, file_obj: BinaryIO, object_key: str, content_type: str = "application/pdf") -> str:
        """Upload a file to object storage and return the object key."""
        pass
        
    @abstractmethod
    def download(self, object_key: str) -> bytes:
        """Download a file from object storage."""
        pass

    @abstractmethod
    def delete(self, object_key: str) -> bool:
        """Delete a file from object storage."""
        pass

    @abstractmethod
    def exists(self, object_key: str) -> bool:
        """Check if a file exists in object storage."""
        pass
        
    @abstractmethod
    def generate_presigned_url(self, object_key: str, expiration: int = 3600) -> str:
        """Generate a presigned URL for downloading."""
        pass
