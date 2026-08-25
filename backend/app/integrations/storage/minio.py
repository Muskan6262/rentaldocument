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
        except ClientError:
            # Create bucket if it doesn't exist
            self.client.create_bucket(Bucket=self.bucket)

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
