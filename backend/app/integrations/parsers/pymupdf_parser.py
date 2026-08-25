import pymupdf
import pytesseract
from PIL import Image
from typing import List, Dict, Any
import ftfy

from app.integrations.parsers.base import DocumentParser, DocumentElement

class PyMuPDFParser(DocumentParser):
    def parse(self, file_path: str) -> List[DocumentElement]:
        """
        Parses a PDF file using PyMuPDF and extracts text blocks with structural hints.
        """
        elements = []
        try:
            doc = pymupdf.open(file_path)
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                # Extract dictionary of page blocks which includes font info
                blocks = page.get_text("dict").get("blocks", [])
                
                # 1. Detect Tables
                table_bboxes = []
                try:
                    tables = page.find_tables()
                    for tab in tables:
                        table_bboxes.append(tab.bbox)
                        
                        rows = tab.extract()
                        if not rows:
                            continue
                            
                        # Convert to Markdown
                        md_text = ""
                        for r_idx, row in enumerate(rows):
                            clean_row = [ftfy.fix_text(str(cell)).replace("\n", " ").strip() if cell else "" for cell in row]
                            md_text += "| " + " | ".join(clean_row) + " |\n"
                            
                            # Add separator after header
                            if r_idx == 0:
                                md_text += "|" + "|".join(["---"] * len(clean_row)) + "|\n"
                                
                        elements.append(
                            DocumentElement(
                                page_number=page_num + 1,
                                element_type="table",
                                text=md_text.strip(),
                                coordinates={
                                    "x0": tab.bbox[0],
                                    "y0": tab.bbox[1],
                                    "x1": tab.bbox[2],
                                    "y1": tab.bbox[3]
                                },
                                metadata={"max_font_size": 11.0, "source": "table_extraction"}
                            )
                        )
                except Exception:
                    pass
                
                text_found = False
                for block in blocks:
                    # Type 0 is text
                    if block.get("type") == 0:
                        text_found = True
                        block_text = ""
                        max_font_size = 0.0
                        
                        for line in block.get("lines", []):
                            for span in line.get("spans", []):
                                block_text += span.get("text", "") + " "
                                size = span.get("size", 0.0)
                                if size > max_font_size:
                                    max_font_size = size
                                    
                        block_text = ftfy.fix_text(block_text).strip()
                        if not block_text:
                            continue
                            
                        # Extremely basic heuristic: if font is large, consider it a heading
                        # (A real implementation would dynamically calculate the base font size of the document)
                        element_type = "paragraph"
                        if max_font_size > 13.0: 
                            element_type = "heading"
                            
                        coords = block.get("bbox", [0, 0, 0, 0])
                        
                        # Prevent duplicate text extraction by checking intersection with tables
                        intersects_table = False
                        for t_bbox in table_bboxes:
                            if not (coords[2] <= t_bbox[0] or coords[0] >= t_bbox[2] or coords[3] <= t_bbox[1] or coords[1] >= t_bbox[3]):
                                intersects_table = True
                                break
                                
                        if intersects_table:
                            continue
                        
                        elements.append(
                            DocumentElement(
                                page_number=page_num + 1, # 1-indexed
                                element_type=element_type,
                                text=block_text,
                                coordinates={
                                    "x0": coords[0],
                                    "y0": coords[1],
                                    "x1": coords[2],
                                    "y1": coords[3]
                                },
                                metadata={"max_font_size": max_font_size}
                            )
                        )
                    
                    # Type 1 is image
                    elif block.get("type") == 1:
                        image_bytes = block.get("image")
                        if image_bytes:
                            import io
                            try:
                                img = Image.open(io.BytesIO(image_bytes))
                                ocr_text = ftfy.fix_text(pytesseract.image_to_string(img)).strip()
                                if ocr_text:
                                    coords = block.get("bbox", [0, 0, 0, 0])
                                    elements.append(
                                        DocumentElement(
                                            page_number=page_num + 1,
                                            element_type="paragraph",
                                            text=ocr_text,
                                            coordinates={
                                                "x0": coords[0],
                                                "y0": coords[1],
                                                "x1": coords[2],
                                                "y1": coords[3]
                                            },
                                            metadata={"max_font_size": 11.0, "source": "ocr_image_block"}
                                        )
                                    )
                            except Exception:
                                pass
                        
                # SELECTIVE OCR FALLBACK
                # If no text blocks were found, assume it's a scanned page and run OCR
                if not text_found:
                    pix = page.get_pixmap(dpi=300)
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    
                    ocr_text = ftfy.fix_text(pytesseract.image_to_string(img)).strip()
                    if ocr_text:
                        elements.append(
                            DocumentElement(
                                page_number=page_num + 1,
                                element_type="paragraph", # Default to paragraph for OCR text
                                text=ocr_text,
                                coordinates={"x0": 0, "y0": 0, "x1": pix.width, "y1": pix.height},
                                metadata={"max_font_size": 11.0, "source": "ocr"}
                            )
                        )
            doc.close()
            return elements
        except Exception as e:
            raise Exception(f"Failed to parse document: {str(e)}")

# Global instance for dependency injection
document_parser = PyMuPDFParser()
