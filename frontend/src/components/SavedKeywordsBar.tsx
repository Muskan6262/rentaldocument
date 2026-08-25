import { useState, useEffect } from 'react';

interface SavedKeywordsBarProps {
  onSelectKeyword: (keyword: string) => void;
  currentQuestion?: string;
}

const DEFAULT_KEYWORDS = [
  'Security Deposit & Deductions',
  'Lock-in & Notice Period',
  'Maintenance & Repairs',
  'Subletting & Guest Policy',
  'Rent Escalation & Due Date',
  'Termination & Breach Penalties',
  'Utilities & Electricity Bills'
];

export default function SavedKeywordsBar({ onSelectKeyword, currentQuestion }: SavedKeywordsBarProps) {
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('saved_rental_keywords');
      if (saved) {
        setCustomKeywords(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const saveKeywordsToStorage = (keywords: string[]) => {
    setCustomKeywords(keywords);
    try {
      localStorage.setItem('saved_rental_keywords', JSON.stringify(keywords));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddKeyword = () => {
    const trimmed = (newKeywordInput || currentQuestion || '').trim();
    if (!trimmed) return;
    if (!customKeywords.includes(trimmed) && !DEFAULT_KEYWORDS.includes(trimmed)) {
      const updated = [...customKeywords, trimmed];
      saveKeywordsToStorage(updated);
    }
    setNewKeywordInput('');
    setIsAdding(false);
  };

  const handleRemoveKeyword = (keywordToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customKeywords.filter(k => k !== keywordToRemove);
    saveKeywordsToStorage(updated);
  };

  return (
    <div className="saved-keywords-container">
      <div className="keywords-header">
        <div className="keywords-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          <span>Saved Keywords & Key Clauses</span>
        </div>
        
        <div className="keywords-actions">
          {!isAdding ? (
            <button 
              className="add-keyword-trigger-btn"
              onClick={() => setIsAdding(true)}
              title="Add custom keyword or clause bookmark"
            >
              + Save Keyword
            </button>
          ) : (
            <div className="add-keyword-input-wrapper">
              <input
                type="text"
                placeholder="e.g. Painting charges..."
                value={newKeywordInput}
                onChange={(e) => setNewKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddKeyword();
                  if (e.key === 'Escape') setIsAdding(false);
                }}
                autoFocus
              />
              <button className="keyword-confirm-btn" onClick={handleAddKeyword}>Add</button>
              <button className="keyword-cancel-btn" onClick={() => setIsAdding(false)}>✕</button>
            </div>
          )}
        </div>
      </div>

      <div className="keywords-chip-list">
        {DEFAULT_KEYWORDS.map((keyword, idx) => (
          <button
            key={`def-${idx}`}
            className="keyword-chip default-chip"
            onClick={() => onSelectKeyword(keyword)}
            title={`Ask about "${keyword}"`}
          >
            <span className="chip-icon">⚡</span>
            <span className="chip-text">{keyword}</span>
          </button>
        ))}

        {customKeywords.map((keyword, idx) => (
          <div
            key={`cust-${idx}`}
            className="keyword-chip custom-chip"
            onClick={() => onSelectKeyword(keyword)}
            title={`Ask about "${keyword}"`}
          >
            <span className="chip-icon">🏷️</span>
            <span className="chip-text">{keyword}</span>
            <button
              className="chip-remove-btn"
              onClick={(e) => handleRemoveKeyword(keyword, e)}
              title="Remove saved keyword"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
