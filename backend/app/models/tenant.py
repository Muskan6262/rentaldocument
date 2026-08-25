from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer

from app.db.base_class import Base

class Tenant(Base):
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    token_quota = Column(Integer, default=100000)
    tokens_used = Column(Integer, default=0)
