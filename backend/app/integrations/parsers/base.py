from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class DocumentElement(BaseModel):
    page_number: int
    element_type: str # e.g., 'paragraph', 'heading', 'table', 'list'
    text: str
    heading: Optional[str] = None
    section: Optional[str] = None
    coordinates: Optional[Dict[str, float]] = None
    metadata: Optional[Dict[str, Any]] = None

class DocumentParser(ABC):
    @abstractmethod
    def parse(self, file_path: str) -> List[DocumentElement]:
        """
        Parse a document (PDF) into a list of structured elements.
        """
        pass
