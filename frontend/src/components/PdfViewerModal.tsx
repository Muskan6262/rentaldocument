import { useState } from 'react';

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string | null;
  documentTitle: string;
  authToken: string;
}

export default function PdfViewerModal({
  isOpen,
  onClose,
  documentId,
  documentTitle,
  authToken
}: PdfViewerModalProps) {
  const [zoom, setZoom] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  if (!isOpen || !documentId) return null;

  const pdfUrl = `/api/v1/documents/${documentId}/download`;

  const handleDownload = async () => {
    try {
      const response = await fetch(pdfUrl, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${documentTitle || 'agreement'}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to download PDF', err);
    }
  };

  const handleOpenNewTab = async () => {
    try {
      const response = await fetch(pdfUrl, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    } catch (err) {
      console.error('Failed to open PDF in new tab', err);
    }
  };

  return (
    <div className="pdf-modal-overlay" onClick={onClose}>
      <div 
        className={`pdf-modal-container ${isFullscreen ? 'fullscreen' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="pdf-modal-header">
          <div className="pdf-modal-title-group">
            <span className="pdf-modal-badge">PDF Viewer</span>
            <h3 className="pdf-modal-title">{documentTitle || 'Rental Agreement'}</h3>
          </div>

          <div className="pdf-modal-actions">
            <div className="pdf-zoom-controls">
              <button 
                className="pdf-btn-icon" 
                onClick={() => setZoom(prev => Math.max(50, prev - 15))}
                title="Zoom Out"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="8" y1="11" x2="14" y2="11"></line></svg>
              </button>
              <span className="pdf-zoom-label">{zoom}%</span>
              <button 
                className="pdf-btn-icon" 
                onClick={() => setZoom(prev => Math.min(200, prev + 15))}
                title="Zoom In"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
              </button>
            </div>

            <button className="pdf-action-btn" onClick={handleOpenNewTab} title="Open in browser tab">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              <span>New Tab</span>
            </button>

            <button className="pdf-action-btn" onClick={handleDownload} title="Download PDF file">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Download</span>
            </button>

            <button 
              className="pdf-btn-icon" 
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
              )}
            </button>

            <button className="pdf-modal-close-btn" onClick={onClose} title="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>

        {/* Modal Body: PDF Container */}
        <div className="pdf-modal-body">
          <div 
            className="pdf-embed-wrapper"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          >
            <iframe
              src={pdfUrl}
              title={documentTitle}
              className="pdf-iframe"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
