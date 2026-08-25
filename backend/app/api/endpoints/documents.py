import uuid
import hashlib
import tempfile
import os
from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.session import get_db, SessionLocal
from app.models.tenant import Tenant
from app.models.document import Document, DocumentVersion
from app.integrations.storage.minio import storage_provider
from app.integrations.parsers import document_parser
from app.core.chunking import chunker
from app.integrations.embeddings.fastembed_dense import embedding_provider
from app.integrations.embeddings.sparse import sparse_provider
from app.integrations.vector_db.qdrant import vector_db_provider
from app.integrations.security.pii_masking import pii_masker
from app.api.endpoints.auth import get_current_tenant_id

router = APIRouter()

def process_document_background(tenant_id: str, document_id: str, version_id: str, chunks: List[dict]):
    db = SessionLocal()
    try:
        # Mask PII in all chunks before generating embeddings and saving to Qdrant
        for chunk in chunks:
            chunk["text"] = pii_masker.mask_text(chunk.get("text", ""))
            
        texts_to_embed = [chunk["text"] for chunk in chunks]
        dense_embeddings = embedding_provider.embed_documents(texts_to_embed)
        sparse_embeddings = sparse_provider.embed_batch(texts_to_embed)
        
        for i, chunk in enumerate(chunks):
            chunk["vector"] = dense_embeddings[i]
            chunk["sparse_vector"] = sparse_embeddings[i]
            
        if chunks:
            vector_db_provider.upsert(
                tenant_id=tenant_id,
                document_id=document_id,
                version_id=version_id,
                chunks=chunks
            )
            
        db_version = db.query(DocumentVersion).filter_by(id=version_id).first()
        if db_version:
            db_version.processing_status = "READY"
            db.commit()
    except Exception as e:
        print(f"Background processing failed: {e}")
        db_version = db.query(DocumentVersion).filter_by(id=version_id).first()
        if db_version:
            db_version.processing_status = "FAILED"
            db.commit()
    finally:
        db.close()

@router.get("/")
def list_documents(
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db)
):
    documents = db.query(Document).filter(Document.tenant_id == tenant_id).order_by(Document.created_at.desc()).all()
    
    result = []
    for doc in documents:
        # Get active version
        active_version = db.query(DocumentVersion).filter(
            DocumentVersion.document_id == doc.id,
            DocumentVersion.is_active == True
        ).first()
        
        result.append({
            "id": doc.id,
            "title": doc.title,
            "created_at": doc.created_at,
            "active_version": active_version.version_number if active_version else None,
            "status": active_version.processing_status if active_version else "UNKNOWN"
        })
        
    return {"documents": result}

@router.post("/upload")
async def upload_documents(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db)
):
    # Verify tenant exists
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=400, detail="Tenant not found")
        
    if len(files) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 files allowed per upload")
        
    for f in files:
        if not f.filename.lower().endswith(('.pdf', '.png', '.jpg', '.jpeg')):
            raise HTTPException(status_code=400, detail="Only PDF and Image files are supported")

    import pymupdf
    combined_pdf = pymupdf.open()
    original_bytes_for_hash = b""
    for f in files:
        f_content = await f.read()
        original_bytes_for_hash += f_content
        fname = f.filename.lower()
        if fname.endswith(".pdf"):
            src = pymupdf.open("pdf", f_content)
            combined_pdf.insert_pdf(src)
        else:
            img = pymupdf.open(stream=f_content, filetype=fname.split('.')[-1])
            pdfbytes = img.convert_to_pdf()
            img.close()
            imgPDF = pymupdf.open("pdf", pdfbytes)
            combined_pdf.insert_pdf(imgPDF)
            
    content = combined_pdf.write()
    combined_pdf.close()
    
    main_filename = files[0].filename if len(files) == 1 else "combined_document.pdf"
    checksum = hashlib.sha256(original_bytes_for_hash).hexdigest()
    
    # ---------------------------------------------------------
    # PRE-FLIGHT CHECKS
    # ---------------------------------------------------------
    
    # 1. Duplication Check
    existing = db.query(DocumentVersion).join(Document).filter(
        DocumentVersion.checksum == checksum, 
        Document.tenant_id == tenant_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Document already exists (Duplicate SHA-256)")
        
    # 2. Virus Scan
    from app.integrations.security.clamav import scanner
    try:
        if not scanner.scan_bytes(content):
            raise HTTPException(status_code=400, detail="Virus detected in document")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    # 3. Quality (Blurry) Check & Parsing
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(content)
        tmp_path = tmp.name
        
    try:
        import pymupdf
        try:
            doc = pymupdf.open(tmp_path)
            total_pages = len(doc)
            doc.close()
        except:
            total_pages = 1
            
        elements = document_parser.parse(tmp_path)
        extracted_chars = sum(len(el.text) for el in (elements or []))
        expected_chars = total_pages * 1500
        
        read_percentage = 0
        if expected_chars > 0:
            read_percentage = min(100, int((extracted_chars / expected_chars) * 100))
            
        if read_percentage < 80:
            raise HTTPException(status_code=400, detail=f"Document is too blurry or unreadable. Only extracted {read_percentage}% of expected text. Minimum 80% required.")
            
        warning_msg = None
        if read_percentage < 100:
            warning_msg = f"Only {read_percentage}% data was read successfully. {100 - read_percentage}% is pending because the text was very blurry."
        
        chunks = chunker.chunk(elements)
        if not chunks:
            raise HTTPException(status_code=400, detail="Could not generate any readable chunks from the document text.")
            
        # ---------------------------------------------------------
        # ALL CHECKS PASSED: SAVE TO DB, MINIO, AND VECTOR DB
        # ---------------------------------------------------------
        document_id = str(uuid.uuid4())
        version_id = str(uuid.uuid4())
        object_key = f"tenants/{tenant_id}/documents/{document_id}/versions/{version_id}/{main_filename}"
        
        import io
        file_obj = io.BytesIO(content)
        storage_provider.upload(file_obj, object_key, "application/pdf")
        
        db_document = Document(
            id=document_id,
            tenant_id=tenant_id,
            title=main_filename
        )
        db.add(db_document)
        
        db_version = DocumentVersion(
            id=version_id,
            tenant_id=tenant_id,
            document_id=document_id,
            version_number=1,
            file_path=object_key,
            checksum=checksum,
            processing_status="INDEXING",
            is_active=True
        )
        db.add(db_version)
        db.commit()
        
        # Trigger background processing for embeddings
        background_tasks.add_task(process_document_background, tenant_id, document_id, version_id, chunks)
        
    except Exception as e:
        # In a real system, we would mark the DocumentVersion processing_status as FAILED.
        # For Phase 1/2, we'll raise an HTTPException for visibility.
        raise HTTPException(status_code=500, detail=f"Ingestion pipeline failed: {str(e)}")
    finally:
        # Cleanup temp file
        os.remove(tmp_path)
    
    return {
        "status": "success",
        "document_id": document_id,
        "version_id": version_id,
        "message": "Document uploaded and parsed successfully. Embeddings are generating in the background.",
        "warning": warning_msg,
        "details": {
            "parsing": {"status": "success", "elements_found": len(elements) if 'elements' in locals() else 0},
            "chunking": {"status": "success", "strategy": "Hierarchical Structure-Aware Chunking", "chunks_created": len(chunks) if 'chunks' in locals() else 0},
            "embedding": {"status": "processing", "message": "Background task started"}
        }
    }

@router.post("/upload/{document_id}/version")
async def upload_document_version(
    background_tasks: BackgroundTasks,
    document_id: str,
    files: List[UploadFile] = File(...),
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db)
):
    # Verify document exists and belongs to tenant
    db_document = db.query(Document).filter(Document.id == document_id, Document.tenant_id == tenant_id).first()
    if not db_document:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if len(files) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 files allowed per upload")
        
    for f in files:
        if not f.filename.lower().endswith(('.pdf', '.png', '.jpg', '.jpeg')):
            raise HTTPException(status_code=400, detail="Only PDF and Image files are supported")

    import pymupdf
    combined_pdf = pymupdf.open()
    for f in files:
        f_content = await f.read()
        fname = f.filename.lower()
        if fname.endswith(".pdf"):
            src = pymupdf.open("pdf", f_content)
            combined_pdf.insert_pdf(src)
        else:
            img = pymupdf.open(stream=f_content, filetype=fname.split('.')[-1])
            pdfbytes = img.convert_to_pdf()
            img.close()
            imgPDF = pymupdf.open("pdf", pdfbytes)
            combined_pdf.insert_pdf(imgPDF)
            
    content = combined_pdf.write()
    combined_pdf.close()
    
    main_filename = files[0].filename if len(files) == 1 else "combined_document.pdf"
    
    checksum = hashlib.sha256(content).hexdigest()
    
    # ---------------------------------------------------------
    # PRE-FLIGHT CHECKS
    # ---------------------------------------------------------
    
    # 1. Duplication Check
    existing = db.query(DocumentVersion).filter(DocumentVersion.checksum == checksum, DocumentVersion.document_id == document_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Document version already exists (Duplicate SHA-256)")
        
    # 2. Virus Scan
    from app.integrations.security.clamav import scanner
    try:
        if not scanner.scan_bytes(content):
            raise HTTPException(status_code=400, detail="Virus detected in document")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    # 3. Quality Check
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(content)
        tmp_path = tmp.name
        
    try:
        import pymupdf
        try:
            doc = pymupdf.open(tmp_path)
            total_pages = len(doc)
            doc.close()
        except:
            total_pages = 1
            
        elements = document_parser.parse(tmp_path)
        extracted_chars = sum(len(el.text) for el in (elements or []))
        expected_chars = total_pages * 1500
        
        read_percentage = 0
        if expected_chars > 0:
            read_percentage = min(100, int((extracted_chars / expected_chars) * 100))
            
        if read_percentage < 80:
            raise HTTPException(status_code=400, detail=f"Document is too blurry or unreadable. Only extracted {read_percentage}% of expected text. Minimum 80% required.")
            
        warning_msg = None
        if read_percentage < 100:
            warning_msg = f"Only {read_percentage}% data was read successfully. {100 - read_percentage}% is pending because the text was very blurry."
            
        chunks = chunker.chunk(elements)
        if not chunks:
            raise HTTPException(status_code=400, detail="Could not generate any readable chunks from the document text.")
            
        # ---------------------------------------------------------
        # ALL CHECKS PASSED: SAVE TO DB, MINIO, AND VECTOR DB
        # ---------------------------------------------------------
        version_id = str(uuid.uuid4())
        
        latest_version = db.query(DocumentVersion).filter(DocumentVersion.document_id == document_id).order_by(DocumentVersion.version_number.desc()).first()
        next_version_num = latest_version.version_number + 1 if latest_version else 1
        
        db.query(DocumentVersion).filter(DocumentVersion.document_id == document_id).update({"is_active": False})
        vector_db_provider.deactivate_document_versions(tenant_id, document_id)
        
        object_key = f"tenants/{tenant_id}/documents/{document_id}/versions/{version_id}/{main_filename}"
        import io
        file_obj = io.BytesIO(content)
        storage_provider.upload(file_obj, object_key, "application/pdf")
        
        db_version = DocumentVersion(
            id=version_id,
            tenant_id=tenant_id,
            document_id=document_id,
            version_number=next_version_num,
            file_path=object_key,
            checksum=checksum,
            processing_status="INDEXING",
            is_active=True
        )
        db.add(db_version)
        db.commit()
        
        # Trigger background processing for embeddings
        background_tasks.add_task(process_document_background, tenant_id, document_id, version_id, chunks)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion pipeline failed: {str(e)}")
    finally:
        os.remove(tmp_path)
    
    return {
        "status": "success",
        "document_id": document_id,
        "version_id": version_id,
        "version_number": next_version_num,
        "message": "New document version created. Embeddings are generating in the background.",
        "warning": warning_msg,
        "details": {
            "parsing": {"status": "success", "elements_found": len(elements) if 'elements' in locals() else 0},
            "chunking": {"status": "success", "strategy": "Hierarchical Structure-Aware Chunking", "chunks_created": len(chunks) if 'chunks' in locals() else 0},
            "embedding": {"status": "processing", "message": "Background task started"}
        }
    }

@router.get("/{document_id}")
def get_document_versions(
    document_id: str,
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db)
):
    db_document = db.query(Document).filter(Document.id == document_id, Document.tenant_id == tenant_id).first()
    if not db_document:
        raise HTTPException(status_code=404, detail="Document not found")
        
    versions = db.query(DocumentVersion).filter(DocumentVersion.document_id == document_id).order_by(DocumentVersion.version_number.desc()).all()
    
    return {
        "document_id": db_document.id,
        "title": db_document.title,
        "created_at": db_document.created_at,
        "versions": [
            {
                "version_id": v.id,
                "version_number": v.version_number,
                "file_path": v.file_path,
                "processing_status": v.processing_status,
                "is_active": v.is_active,
                "created_at": v.created_at
            }
            for v in versions
        ]
    }

@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db)
):
    db_document = db.query(Document).filter(Document.id == document_id, Document.tenant_id == tenant_id).first()
    if not db_document:
        raise HTTPException(status_code=404, detail="Document not found")
        
    active_version = db.query(DocumentVersion).filter(
        DocumentVersion.document_id == document_id,
        DocumentVersion.is_active == True
    ).first()
    
    if not active_version:
        raise HTTPException(status_code=404, detail="No active version found for document")
        
    try:
        content = storage_provider.download(active_version.file_path)
        return Response(content=content, media_type="application/pdf")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download document: {str(e)}")

