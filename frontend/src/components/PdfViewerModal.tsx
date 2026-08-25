import { useState, useEffect } from 'react';

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
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let currentObjectUrl: string | null = null;

    if (isOpen && documentId) {
      setIsLoading(true);
      setLoadError(null);

      const fetchPdf = async () => {
        try {
          const res = await fetch(`/api/v1/documents/${documentId}/download`, {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });
          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Failed to load PDF (${res.status}): ${errText}`);
          }
          const blob = await res.blob();
          currentObjectUrl = window.URL.createObjectURL(blob);
          setBlobUrl(currentObjectUrl);
        } catch (err: any) {
          setLoadError(err.message || 'Unable to load PDF document');
        } finally {
          setIsLoading(false);
        }
      };

      fetchPdf();
    } else {
      setBlobUrl(null);
    }

    return () => {
      if (currentObjectUrl) {
        window.URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [isOpen, documentId, authToken]);

  if (!isOpen || !documentId) return null;

  const handleDownload = async () => {
    if (blobUrl) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${documentTitle || 'agreement'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleOpenNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank');
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

            <button className="pdf-action-btn" onClick={handleOpenNewTab} title="Open in browser tab" disabled={!blobUrl}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              <span>New Tab</span>
            </button>

            <button className="pdf-action-btn" onClick={handleDownload} title="Download PDF file" disabled={!blobUrl}>
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
          {isLoading ? (
            <div className="flex items-center justify-center h-full min-h-[400px] text-slate-400 gap-3">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Loading agreement PDF...</span>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-rose-400 gap-2 p-6 text-center">
              <span className="text-lg font-semibold">Failed to display document</span>
              <span className="text-sm text-slate-400">{loadError}</span>
            </div>
          ) : blobUrl ? (
            <div
              className="pdf-embed-wrapper"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
            >
              <iframe
                src={blobUrl}
                title={documentTitle}
                className="pdf-iframe"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
