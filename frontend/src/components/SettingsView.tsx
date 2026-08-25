import { useState } from 'react';

export interface RAGSettings {
  model: string;
  searchMode: string;
  chunkingStrategy: string;
  embeddingModel: string;
  topK: number;
  temperature: number;
}

interface SettingsViewProps {
  settings: RAGSettings;
  onUpdateSettings: (newSettings: Partial<RAGSettings>) => void;
  tokenUsage?: { token_quota: number; tokens_used: number } | null;
  userEmail?: string | null;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

const AVAILABLE_MODELS = [
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    badge: '128K Context • Recommended',
    description: 'Latest flagship production model on Groq. Exceptional for multi-clause legal cross-referencing and zero-hallucination extraction.'
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    badge: 'Ultra-Fast • Low Latency',
    description: 'Blazing fast inference speed suited for quick clause lookups, definition checks, and instant Q&A.'
  },
  {
    id: 'deepseek-r1-distill-llama-70b',
    name: 'DeepSeek R1 Distill 70B',
    badge: 'Deep Reasoning',
    description: 'Advanced chain-of-thought reasoning model for complex contractual dispute analysis and liability assessment.'
  },
  {
    id: 'sarvam-2b',
    name: 'Sarvam Indic Model',
    badge: 'Indic Legal Specialization',
    description: 'Specialized for Indian tenancy contracts, state-specific stamp duty acts, and multi-lingual Hindi/English parsing.'
  }
];

export default function SettingsView({
  settings,
  onUpdateSettings,
  tokenUsage,
  userEmail,
  theme,
  onToggleTheme
}: SettingsViewProps) {
  const [saveToast, setSaveToast] = useState(false);

  const handleTempChange = (newTemp: number) => {
    onUpdateSettings({ temperature: newTemp });
    triggerSaveToast();
  };

  const handleModelChange = (newModel: string) => {
    onUpdateSettings({ model: newModel });
    triggerSaveToast();
  };

  const handleSearchModeChange = (newMode: string) => {
    onUpdateSettings({ searchMode: newMode });
    triggerSaveToast();
  };

  const handleTopKChange = (newTopK: number) => {
    onUpdateSettings({ topK: newTopK });
    triggerSaveToast();
  };

  const triggerSaveToast = () => {
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  const quotaPercent = tokenUsage && tokenUsage.token_quota > 0
    ? Math.min(100, Math.round((tokenUsage.tokens_used / tokenUsage.token_quota) * 100))
    : 0;

  return (
    <div className="settings-view-container">
      {/* Settings Header */}
      <div className="settings-header">
        <div>
          <h2 className="settings-title">AI & RAG Pipeline Settings</h2>
          <p className="settings-subtitle">
            Configure LLM models, hybrid search retrieval, chunking policies, top-k reranking, and live temperature calibration.
          </p>
        </div>

        {saveToast && (
          <div className="save-toast-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>Settings Updated</span>
          </div>
        )}
      </div>

      <div className="settings-grid-layout">
        {/* Left Column: Model & Generation Parameters */}
        <div className="settings-column">
          {/* Section 1: Model Selection */}
          <div className="settings-card glass-panel">
            <div className="card-heading">
              <div className="heading-icon">🧠</div>
              <div>
                <h3>Active Large Language Model</h3>
                <p>Select the reasoning engine for agreement analysis and legal answer generation</p>
              </div>
            </div>

            <div className="model-options-list">
              {AVAILABLE_MODELS.map(m => {
                const isSelected = settings.model === m.id;
                return (
                  <div
                    key={m.id}
                    className={`model-option-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleModelChange(m.id)}
                  >
                    <div className="option-radio">
                      <div className={`radio-circle ${isSelected ? 'checked' : ''}`}></div>
                    </div>
                    <div className="option-content">
                      <div className="option-header-row">
                        <span className="model-name">{m.name}</span>
                        <span className="model-pill">{m.badge}</span>
                      </div>
                      <p className="model-desc">{m.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Temperature Control */}
          <div className="settings-card glass-panel">
            <div className="card-heading">
              <div className="heading-icon">🌡️</div>
              <div>
                <h3>Model Temperature & Creativity</h3>
                <p>Control the randomness vs strict factual grounding of answers</p>
              </div>
            </div>

            <div className="temperature-control-box">
              <div className="temp-slider-header">
                <span className="temp-label">Current Temperature</span>
                <span className="temp-value-badge">{settings.temperature.toFixed(2)}</span>
              </div>

              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={settings.temperature}
                onChange={(e) => handleTempChange(parseFloat(e.target.value))}
                className="temp-range-slider"
              />

              <div className="slider-labels">
                <span>0.0 (Strict Grounding)</span>
                <span>0.5 (Balanced)</span>
                <span>1.0 (Creative)</span>
              </div>

              {/* Presets */}
              <div className="temp-presets-row">
                <button
                  className={`temp-preset-btn ${settings.temperature === 0.0 ? 'active' : ''}`}
                  onClick={() => handleTempChange(0.0)}
                >
                  🎯 Strict Grounding (0.0)
                </button>
                <button
                  className={`temp-preset-btn ${settings.temperature === 0.3 ? 'active' : ''}`}
                  onClick={() => handleTempChange(0.3)}
                >
                  ⚖️ Balanced (0.3)
                </button>
                <button
                  className={`temp-preset-btn ${settings.temperature === 0.7 ? 'active' : ''}`}
                  onClick={() => handleTempChange(0.7)}
                >
                  💡 Explanatory (0.7)
                </button>
              </div>

              <div className="temp-info-note">
                <span className="info-icon">ℹ️</span>
                <span>
                  {settings.temperature === 0.0
                    ? "Recommended for legal agreements: Strict 0.0 temperature guarantees non-hallucination and exact citations."
                    : "Non-zero temperature enables softer reasoning and natural summaries while still referencing retrieved citations."}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: RAG Pipeline, Chunking, Embedding & Security */}
        <div className="settings-column">
          {/* Section 3: Search & Retrieval Strategy */}
          <div className="settings-card glass-panel">
            <div className="card-heading">
              <div className="heading-icon">🔍</div>
              <div>
                <h3>Search & Retrieval Mode</h3>
                <p>Vector database index querying strategy</p>
              </div>
            </div>

            <div className="search-mode-grid">
              <div
                className={`search-mode-card ${settings.searchMode === 'hybrid' ? 'selected' : ''}`}
                onClick={() => handleSearchModeChange('hybrid')}
              >
                <div className="mode-badge-recommended">Recommended</div>
                <h4>Hybrid (Dense + Sparse)</h4>
                <p>Combines BGE semantic vector similarity with Qdrant BM25 lexical keyword matching via Reciprocal Rank Fusion.</p>
              </div>

              <div
                className={`search-mode-card ${settings.searchMode === 'dense' ? 'selected' : ''}`}
                onClick={() => handleSearchModeChange('dense')}
              >
                <h4>Dense Vector Only</h4>
                <p>Embeds query via 384-dim dense representation. Best for conceptual understanding and semantic queries.</p>
              </div>

              <div
                className={`search-mode-card ${settings.searchMode === 'sparse' ? 'selected' : ''}`}
                onClick={() => handleSearchModeChange('sparse')}
              >
                <h4>Sparse Lexical (BM25)</h4>
                <p>Exact keyword and term frequency matching. Best for specific clause numbers, names, and monetary values.</p>
              </div>
            </div>
          </div>

          {/* Section 4: Chunking & Embeddings Specification */}
          <div className="settings-card glass-panel">
            <div className="card-heading">
              <div className="heading-icon">⚙️</div>
              <div>
                <h3>Chunking & Embeddings Engine</h3>
                <p>Active document processing specifications</p>
              </div>
            </div>

            <div className="specs-table">
              <div className="spec-row">
                <span className="spec-label">Chunking Strategy</span>
                <span className="spec-value highlight">Structure-Aware Hierarchical</span>
              </div>
              <div className="spec-desc-text">
                Chunks adhere to rental agreement clause boundaries (Section, Title, Articles) rather than arbitrary fixed token cuts.
              </div>

              <div className="spec-row" style={{ marginTop: '0.75rem' }}>
                <span className="spec-label">Dense Embedding Model</span>
                <span className="spec-value">FastEmbed BAAI/bge-small-en-v1.5</span>
              </div>

              <div className="spec-row">
                <span className="spec-label">Sparse Embedding Model</span>
                <span className="spec-value">Qdrant Fast-Sparse BM25</span>
              </div>

              <div className="spec-row">
                <span className="spec-label">Vector Database</span>
                <span className="spec-value">Qdrant Cloud / Multi-Tenant</span>
              </div>
            </div>
          </div>

          {/* Section 4.5: Theme & Appearance */}
          <div className="settings-card glass-panel">
            <div className="card-heading">
              <div className="heading-icon">🎨</div>
              <div>
                <h3>UI Theme & Appearance</h3>
                <p>Select your visual styling (warm non-white light palette or dark obsidian)</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div 
                className={`search-mode-card ${theme === 'light' ? 'selected' : ''}`}
                onClick={theme !== 'light' && onToggleTheme ? onToggleTheme : undefined}
                style={{ cursor: 'pointer' }}
              >
                <h4>☀️ Light Theme (Warm Sand)</h4>
                <p>Natural warm oat, linen & slate tones without stark white eye fatigue.</p>
              </div>

              <div 
                className={`search-mode-card ${theme === 'dark' ? 'selected' : ''}`}
                onClick={theme !== 'dark' && onToggleTheme ? onToggleTheme : undefined}
                style={{ cursor: 'pointer' }}
              >
                <h4>🌙 Dark Theme</h4>
                <p>Deep obsidian navy for nighttime or low-light environments.</p>
              </div>
            </div>
          </div>

          {/* Section 5: Top-K Reranking Slider */}
          <div className="settings-card glass-panel">
            <div className="card-heading">
              <div className="heading-icon">🏆</div>
              <div>
                <h3>Top-K Reranking Candidates</h3>
                <p>Number of reranked snippets fed into LLM context window</p>
              </div>
            </div>

            <div className="topk-control-box">
              <div className="topk-slider-row">
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="1"
                  value={settings.topK}
                  onChange={(e) => handleTopKChange(parseInt(e.target.value))}
                  className="temp-range-slider"
                />
                <span className="topk-value-pill">{settings.topK} chunks</span>
              </div>
              <div className="slider-labels">
                <span>1 Chunk (Focused)</span>
                <span>5 Chunks (Optimal)</span>
                <span>15 Chunks (Deep)</span>
              </div>
            </div>
          </div>

          {/* Section 6: Security & Quota Dashboard */}
          <div className="settings-card glass-panel">
            <div className="card-heading">
              <div className="heading-icon">🛡️</div>
              <div>
                <h3>Security & Tenant Quota</h3>
                <p>Isolation, PII masking and token limits {userEmail && `for ${userEmail}`}</p>
              </div>
            </div>

            <div className="security-badges-row">
              <div className="sec-badge">
                <span className="sec-icon">🔒</span>
                <span>Tenant Isolation Enforced</span>
              </div>
              <div className="sec-badge">
                <span className="sec-icon">🛡️</span>
                <span>PII Redaction Active</span>
              </div>
              <div className="sec-badge">
                <span className="sec-icon">🦠</span>
                <span>ClamAV Scanning</span>
              </div>
            </div>

            {tokenUsage && (
              <div className="token-usage-bar-card">
                <div className="token-bar-header">
                  <span>Token Quota Utilization</span>
                  <span><b>{tokenUsage.tokens_used.toLocaleString()}</b> / {tokenUsage.token_quota.toLocaleString()} tokens</span>
                </div>
                <div className="token-meter-bg">
                  <div 
                    className="token-meter-fill"
                    style={{ 
                      width: `${quotaPercent}%`,
                      background: quotaPercent > 90 ? 'var(--error-color)' : 'linear-gradient(90deg, #6366f1, #10b981)'
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
