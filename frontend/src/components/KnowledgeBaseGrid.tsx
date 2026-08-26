import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';

export interface DocumentItem {
  id: string;
  title: string;
  created_at: string;
  active_version: number;
  status: string;
}

interface KnowledgeBaseGridProps {
  documents: DocumentItem[];
  selectedDocId: string | null;
  onSelectDocument: (docId: string) => void;
  onViewPdf: (docId: string, title: string) => void;
  authToken: string;
  onRefreshDocuments: () => void;
}

export default function KnowledgeBaseGrid({
  documents,
  selectedDocId,
  onSelectDocument,
  onViewPdf,
  authToken,
  onRefreshDocuments
}: KnowledgeBaseGridProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadDetails, setUploadDetails] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (files.length > 100) {
      setUploadStatus('Maximum 100 files allowed per upload.');
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const name = files[i].name.toLowerCase();
      if (!name.endsWith('.pdf') && !name.endsWith('.png') && !name.endsWith('.jpg') && !name.endsWith('.jpeg')) {
        setUploadStatus('Please select only PDF or Image (PNG/JPG) files.');
        return;
      }
    }

    setIsUploading(true);
    setUploadStep(1);
    setUploadDetails(null);
    setUploadStatus(`Uploading & analyzing ${files.length} file(s)...`);
    setUploadError('');

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    const progressInterval = setInterval(() => {
      setUploadStep(prev => (prev < 4 ? prev + 1 : prev));
    }, 1200);

    try {
      const response = await fetch('/api/v1/documents/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      clearInterval(progressInterval);
      setUploadStep(5);

      let data: any = {};
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { detail: response.statusText || `HTTP ${response.status}` };
      }

      if (response.ok) {
        setUploadStatus('Document successfully ingested and indexed!');
        setUploadDetails({ ...data.details, warning: data.warning });
        onRefreshDocuments();
        if (data.document_id) {
          onSelectDocument(data.document_id);
        }
        setTimeout(() => setUploadStatus(''), 4000);
      } else {
        const errorMsg = data.detail || (typeof data === 'string' ? data : `Upload failed with status ${response.status}`);
        setUploadError(`Upload Error: ${errorMsg}`);
        setUploadStatus('');
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      setUploadError(`Upload Error: ${err?.message || 'Network connection error or request timed out.'}`);
      setUploadStatus('');
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadStep(0), 10000);
    }
  };

  const filteredDocs = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const handleDeleteDoc = async (docId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      const res = await fetch(`/api/v1/documents/${docId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        onRefreshDocuments();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Delete failed: ${err.detail || 'Unknown error'}`);
      }
    } catch (e: any) {
      alert(`Delete failed: ${e.message}`);
    }
  };

  const handleReindexDoc = async (docId: string) => {
    setUploadStatus('Re-indexing document in background...');
    try {
      const res = await fetch(`/api/v1/documents/${docId}/reindex`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        setUploadStatus('Reindexing started. Embeddings are generating...');
        onRefreshDocuments();
        setTimeout(() => setUploadStatus(''), 4000);
      } else {
        const err = await res.json().catch(() => ({}));
        setUploadError(`Reindex failed: ${err.detail || 'Unknown error'}`);
        setUploadStatus('');
      }
    } catch (e: any) {
      setUploadError(`Reindex failed: ${e.message}`);
      setUploadStatus('');
    }
  };

  return (
    <div className="knowledge-base-container">
      {/* Knowledge Base Header */}
      <div className="kb-header-row">
        <div>
          <h2 className="kb-title">Knowledge Base & Agreements</h2>
          <p className="kb-subtitle">
            Upload, organize, and inspect all rental agreements in a grid view. The latest document is selected by default for chat intelligence.
          </p>
        </div>

        <div className="kb-header-actions">
          <input
            type="file"
            multiple
            accept="application/pdf, image/png, image/jpeg, image/jpg"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <button 
            className="kb-upload-btn"
            onClick={() => !isUploading && fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            <span>{isUploading ? 'Ingesting...' : '+ Upload Agreement'}</span>
          </button>
        </div>
      </div>

      {/* Upload Drag & Drop Dropzone Banner */}
      <div 
        className={`kb-dropzone ${isUploading ? 'uploading' : ''}`}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <div className="dropzone-icon-glow">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="12" y2="12"></line><line x1="15" y1="15" x2="12" y2="12"></line></svg>
        </div>
        <div className="dropzone-content">
          <h4 className="dropzone-title">Drag & drop rental agreements or click to browse</h4>
          <p className="dropzone-desc">Supports PDF & Multi-page Image Scans (PNG/JPG). Up to 100 pages per file with automatic OCR & PII protection.</p>
        </div>
      </div>

      {/* Ingestion Steps Progress */}
      {(isUploading || (uploadStep > 0 && uploadStep <= 5)) && (
        <div className="upload-progress-card glass-panel">
          <div className="progress-header">
            <span className="progress-pulse-dot"></span>
            <h4>Real-Time RAG Ingestion Pipeline</h4>
          </div>
          <div className="progress-steps-grid">
            <div className={`step-box ${uploadStep >= 1 ? 'active' : ''} ${uploadStep > 1 ? 'completed' : ''}`}>
              <div className="step-num">01</div>
              <div className="step-label">Native & OCR Parsing</div>
              <div className="step-sub">Extracting layout & clauses</div>
            </div>
            <div className={`step-box ${uploadStep >= 2 ? 'active' : ''} ${uploadStep > 2 ? 'completed' : ''}`}>
              <div className="step-num">02</div>
              <div className="step-label">Structure Chunking</div>
              <div className="step-sub">Hierarchical clause boundaries</div>
            </div>
            <div className={`step-box ${uploadStep >= 3 ? 'active' : ''} ${uploadStep > 3 ? 'completed' : ''}`}>
              <div className="step-num">03</div>
              <div className="step-label">Dense + Sparse Embeddings</div>
              <div className="step-sub">Generating semantic vectors</div>
            </div>
            <div className={`step-box ${uploadStep >= 4 ? 'active' : ''} ${uploadStep > 4 ? 'completed' : ''}`}>
              <div className="step-num">04</div>
              <div className="step-label">Qdrant Indexing</div>
              <div className="step-sub">Multi-tenant vector payload</div>
            </div>
          </div>

          {uploadDetails && (
            <div className="upload-summary-pills">
              <span className="summary-pill">📑 Elements: <b>{uploadDetails.parsing?.elements_found || 0}</b></span>
              <span className="summary-pill">🧩 Chunks: <b>{uploadDetails.chunking?.chunks_created || 0}</b></span>
              <span className="summary-pill">⚡ Strategy: <b>{uploadDetails.chunking?.strategy || 'Structure-Aware'}</b></span>
            </div>
          )}
        </div>
      )}

      {uploadStatus && <div className="status-banner success">{uploadStatus}</div>}
      {uploadError && <div className="status-banner error">{uploadError}</div>}

      {/* Grid Controls & Search */}
      <div className="kb-controls-bar">
        <div className="kb-search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input
            type="text"
            placeholder="Search documents by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>

        <div className="kb-stats-badge">
          <span>Total Agreements: <b>{documents.length}</b></span>
        </div>
      </div>

      {/* Documents Grid View */}
      {filteredDocs.length === 0 ? (
        <div className="kb-empty-grid glass-panel">
          <div className="empty-icon">📁</div>
          <h3>{documents.length === 0 ? 'No agreements in Knowledge Base' : 'No agreements matching your search'}</h3>
          <p>Upload your first rental agreement PDF or image scan above to enable AI queries and clause extraction.</p>
        </div>
      ) : (
        <div className="kb-documents-grid">
          {filteredDocs.map((doc, idx) => {
            const isSelected = selectedDocId === doc.id;
            const isLatest = idx === 0;
            const isFailed = doc.status === 'FAILED';

            return (
              <div 
                key={doc.id}
                className={`kb-doc-card glass-panel ${isSelected ? 'active-card' : ''}`}
                onClick={() => onSelectDocument(doc.id)}
              >
                {/* Card Top Badges */}
                <div className="doc-card-header">
                  <div className="doc-card-type-badge">
                    <span className="pdf-tag">PDF</span>
                    {isLatest && <span className="latest-tag">Latest</span>}
                  </div>

                  <div className={`status-pill ${doc.status.toLowerCase()}`}>
                    <span className="status-dot"></span>
                    {doc.status}
                  </div>
                </div>

                {/* Card Main Info */}
                <div className="doc-card-body">
                  <div className="doc-thumbnail-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  </div>
                  <div className="doc-card-text">
                    <h4 className="doc-card-title" title={doc.title}>{doc.title}</h4>
                    <div className="doc-card-meta">
                      <span>v{doc.active_version || 1}.0</span>
                      <span className="meta-sep">•</span>
                      <span>{formatDate(doc.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="doc-card-footer" onClick={(e) => e.stopPropagation()}>
                  <button 
                    className={`card-select-btn ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => onSelectDocument(doc.id)}
                  >
                    {isSelected ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        <span>Active in Chat</span>
                      </>
                    ) : (
                      <>
                        <span>Select for Chat</span>
                      </>
                    )}
                  </button>

                  <button 
                    className="card-view-btn"
                    onClick={() => onViewPdf(doc.id, doc.title)}
                    title="View PDF document"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    <span>View</span>
                  </button>

                  {isFailed && (
                    <button
                      className="card-view-btn"
                      style={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)' }}
                      onClick={() => handleReindexDoc(doc.id)}
                      title="Retry indexing"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                      <span>Retry</span>
                    </button>
                  )}

                  <button
                    className="card-view-btn"
                    style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                    onClick={() => handleDeleteDoc(doc.id, doc.title)}
                    title="Delete document"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
