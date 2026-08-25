from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Boolean
from sqlalchemy.orm import relationship

from app.db.base_class import Base

class Document(Base):
    id = Column(String, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenant.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    document_type = Column(String, default="rental_agreement")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    versions = relationship("DocumentVersion", back_populates="document", cascade="all, delete-orphan")

class DocumentVersion(Base):
    id = Column(String, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenant.id"), nullable=False, index=True)
    document_id = Column(String, ForeignKey("document.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    file_path = Column(String, nullable=False)
    checksum = Column(String, nullable=False)
    processing_status = Column(String, default="PENDING")
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    document = relationship("Document", back_populates="versions")
