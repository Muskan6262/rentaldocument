from typing import List, Dict, Any
from app.integrations.parsers.base import DocumentElement

# PLACEHOLDER for Phase 2:
# We do NOT implement chunking in Phase 1 as per architectural decisions.
# Future chunking strategy must preserve:
# - Agreement section
# - Clause heading
# - Clause number
# - Sub-clause
# - Paragraph
# - Page number

class HierarchicalChunker:
    def __init__(self):
        pass

    def chunk(self, elements: List[DocumentElement]) -> List[Dict[str, Any]]:
        """
        Converts a list of DocumentElements into structure-aware chunks.
        """
        chunks = []
        current_heading = None
        
        for element in elements:
            if element.element_type == "heading":
                current_heading = element.text
            elif element.element_type in ["paragraph", "table"]:
                # Create contextualized text
                context_text = f"[{current_heading}]\n{element.text}" if current_heading else element.text
                
                chunk = {
                    "text": context_text,
                    "payload": {
                        "page_number": element.page_number,
                        "section": current_heading,
                        "element_type": element.element_type
                    }
                }
                chunks.append(chunk)
                
        return chunks

chunker = HierarchicalChunker()
