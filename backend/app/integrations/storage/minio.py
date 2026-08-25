import os
import boto3
from botocore.exceptions import ClientError
from typing import BinaryIO
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

from app.core.config import settings
from app.integrations.storage.base import ObjectStorageProvider

class MinIOStorageProvider(ObjectStorageProvider):
    def __init__(self):
        self.bucket = settings.S3_BUCKET
        self.endpoint_url = self._resolve_endpoint_url(settings.S3_ENDPOINT_URL)
        self.local_fallback_dir = Path(os.getenv("STORAGE_LOCAL_FALLBACK_DIR", "/app/storage_data" if os.path.exists("/app") else "./storage_data"))
        self.local_fallback_dir.mkdir(parents=True, exist_ok=True)
        self.is_connected = False
        
        try:
            self.client = self._create_client(self.endpoint_url)
            self._ensure_bucket_exists()
        except Exception as e:
            logger.warning(f"Could not connect to MinIO on startup ({e}). Local storage fallback will be active.")
            self.client = None

    def _resolve_endpoint_url(self, configured_url: str) -> str:
        if not configured_url:
            return "http://minio:9000"
        # If configured with localhost inside docker, check if 'minio' is resolvable
        if "localhost" in configured_url or "127.0.0.1" in configured_url:
            import socket
            try:
                socket.gethostbyname("minio")
                return configured_url.replace("localhost", "minio").replace("127.0.0.1", "minio")
            except Exception:
                pass
        return configured_url

    def _create_client(self, endpoint_url: str):
        return boto3.client(
            's3',
            endpoint_url=endpoint_url,
            aws_access_key_id=settings.S3_ACCESS_KEY or "admin",
            aws_secret_access_key=settings.S3_SECRET_KEY or "password",
            region_name=settings.S3_REGION or "us-east-1"
        )

    def _ensure_bucket_exists(self):
        if not self.client:
            return
        try:
            self.client.head_bucket(Bucket=self.bucket)
            self.is_connected = True
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code")
            if error_code in ("404", "NoSuchBucket"):
                try:
                    self.client.create_bucket(Bucket=self.bucket)
                    self.is_connected = True
                except Exception as create_err:
                    logger.warning(f"Could not create S3 bucket '{self.bucket}': {create_err}")
            else:
                logger.warning(f"S3 bucket check returned: {e}")
        except Exception as e:
            # Try alternate endpoint fallback (between minio and localhost)
            alt_endpoint = None
            if "minio" in self.endpoint_url:
                alt_endpoint = self.endpoint_url.replace("minio", "localhost")
            elif "localhost" in self.endpoint_url or "127.0.0.1" in self.endpoint_url:
                alt_endpoint = self.endpoint_url.replace("localhost", "minio").replace("127.0.0.1", "minio")

            if alt_endpoint:
                try:
                    alt_client = self._create_client(alt_endpoint)
                    alt_client.head_bucket(Bucket=self.bucket)
                    self.endpoint_url = alt_endpoint
                    self.client = alt_client
                    self.is_connected = True
                    return
                except Exception:
                    pass
            logger.warning(f"Could not connect to S3/MinIO endpoint '{self.endpoint_url}': {e}. Using local storage fallback.")
            self.is_connected = False

    def upload(self, file_obj: BinaryIO, object_key: str, content_type: str = "application/pdf") -> str:
        # Check connection or retry connection if needed
        if not self.is_connected and self.client:
            self._ensure_bucket_exists()
            
        if self.is_connected and self.client:
            try:
                file_obj.seek(0)
                self.client.upload_fileobj(
                    file_obj, 
                    self.bucket, 
                    object_key, 
                    ExtraArgs={"ContentType": content_type}
                )
                return object_key
            except Exception as e:
                logger.warning(f"MinIO upload failed ({e}). Storing to local fallback.")
                self.is_connected = False

        # Local storage fallback
        file_obj.seek(0)
        dest_path = self.local_fallback_dir / object_key
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        with open(dest_path, "wb") as f:
            f.write(file_obj.read())
        return object_key
        
    def download(self, object_key: str) -> bytes:
        if self.is_connected and self.client:
            try:
                response = self.client.get_object(Bucket=self.bucket, Key=object_key)
                return response['Body'].read()
            except Exception as e:
                logger.warning(f"MinIO download failed ({e}). Checking local storage.")
                
        dest_path = self.local_fallback_dir / object_key
        if dest_path.exists():
            with open(dest_path, "rb") as f:
                return f.read()
        raise Exception(f"Object {object_key} not found in MinIO or local storage")

    def delete(self, object_key: str) -> bool:
        if self.is_connected and self.client:
            try:
                self.client.delete_object(Bucket=self.bucket, Key=object_key)
            except Exception:
                pass
                
        dest_path = self.local_fallback_dir / object_key
        if dest_path.exists():
            try:
                dest_path.unlink()
            except Exception:
                pass
        return True

    def exists(self, object_key: str) -> bool:
        if self.is_connected and self.client:
            try:
                self.client.head_object(Bucket=self.bucket, Key=object_key)
                return True
            except ClientError:
                pass
            except Exception:
                pass
                
        dest_path = self.local_fallback_dir / object_key
        return dest_path.exists()
            
    def generate_presigned_url(self, object_key: str, expiration: int = 3600) -> str:
        if self.is_connected and self.client:
            try:
                return self.client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': self.bucket, 'Key': object_key},
                    ExpiresIn=expiration
                )
            except Exception:
                pass
        return f"/api/v1/documents/raw/{object_key}"

# Global instance for dependency injection
storage_provider = MinIOStorageProvider()

