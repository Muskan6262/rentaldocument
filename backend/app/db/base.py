# Import all the models, so that Base has them before being
# imported by Alembic
from app.db.base_class import Base  # noqa
from app.models.tenant import Tenant
from app.models.document import Document, DocumentVersion
from app.models.user import User  # noqa
from app.models.chat import ChatSession, ChatMessage
