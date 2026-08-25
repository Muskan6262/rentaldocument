import boto3
from botocore.exceptions import ClientError
from typing import BinaryIO

from app.core.config import settings
from app.integrations.storage.base import ObjectStorageProvider

class MinIOStorageProvider(ObjectStorageProvider):
    def __init__(self):
        self.bucket = settings.S3_BUCKET
        self.client = boto3.client(
            's3',
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION
        )
        self._ensure_bucket_exists()

    def _ensure_bucket_exists(self):
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code")
            if error_code in ("404", "NoSuchBucket"):
                try:
                    self.client.create_bucket(Bucket=self.bucket)
                except Exception as create_err:
                    print(f"Warning: Could not create S3 bucket '{self.bucket}': {create_err}")
            else:
                print(f"Warning: S3 bucket check returned: {e}")
        except Exception as e:
            print(f"Warning: Could not connect to S3/MinIO endpoint '{settings.S3_ENDPOINT_URL}': {e}")

    def upload(self, file_obj: BinaryIO, object_key: str, content_type: str = "application/pdf") -> str:
        self.client.upload_fileobj(
            file_obj, 
            self.bucket, 
            object_key, 
            ExtraArgs={"ContentType": content_type}
        )
        return object_key
        
    def download(self, object_key: str) -> bytes:
        response = self.client.get_object(Bucket=self.bucket, Key=object_key)
        return response['Body'].read()

    def delete(self, object_key: str) -> bool:
        self.client.delete_object(Bucket=self.bucket, Key=object_key)
        return True

    def exists(self, object_key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=object_key)
            return True
        except ClientError:
            return False
            
    def generate_presigned_url(self, object_key: str, expiration: int = 3600) -> str:
        url = self.client.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket, 'Key': object_key},
            ExpiresIn=expiration
        )
        return url

# Global instance for dependency injection
storage_provider = MinIOStorageProvider()
