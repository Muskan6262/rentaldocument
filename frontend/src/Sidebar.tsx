import { useEffect, useState } from 'react';
import TokenDashboard from './TokenDashboard';
import type { TokenUsage } from './TokenDashboard';
import type { DocumentItem } from './components/KnowledgeBaseGrid';

export type ActiveNavTab = 'chats' | 'knowledge' | 'settings';

export interface ChatSessionItem {
  id: string;
  document_id: string;
  document_title?: string;
  title: string;
  created_at: string;
}

interface SidebarProps {
  authToken: string;
  activeTab: ActiveNavTab;
  onSelectTab: (tab: ActiveNavTab) => void;
  documents: DocumentItem[];
  selectedDocId: string | null;
  onSelectDocument: (docId: string | null) => void;
  currentSessionId: string | null;
  onSelectSession: (sessionId: string, docId: string) => void;
  onNewChat: () => void;
  onLogout: () => void;
  temperature: number;
  model: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function Sidebar({
  authToken,
  activeTab,
  onSelectTab,
  documents,
  selectedDocId,
  onSelectDocument,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onLogout,
  temperature,
  model,
  theme,
  onToggleTheme
}: SidebarProps) {
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  const fetchUserDataAndSessions = async () => {
    try {
      // Fetch user info & token usage
      const meRes = await fetch('/api/v1/auth/me', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        setTokenUsage({
          token_quota: meData.token_quota,
          tokens_used: meData.tokens_used
        });
        if (meData.email) {
          setUserEmail(meData.email);
        }
      }

      // Fetch chat sessions
      const sessionsRes = await fetch('/api/v1/history/', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to fetch sidebar info', err);
    }
  };

  useEffect(() => {
    if (authToken) {
      fetchUserDataAndSessions();
      const interval = setInterval(fetchUserDataAndSessions, 8000);
      return () => clearInterval(interval);
    }
  }, [authToken, selectedDocId]);

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (s.document_title && s.document_title.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="brand-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </div>
          <div>
            <h2>Rental Intelligence</h2>
            <span className="brand-sub">Grounded RAG Assistant</span>
          </div>
        </div>
      </div>

      {/* 3 Main Navigation Tabs */}
      <div className="sidebar-nav-tabs">
        <button
          className={`nav-tab-btn ${activeTab === 'chats' ? 'active' : ''}`}
          onClick={() => onSelectTab('chats')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          <span>Chats</span>
          {sessions.length > 0 && <span className="nav-badge">{sessions.length}</span>}
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'knowledge' ? 'active' : ''}`}
          onClick={() => onSelectTab('knowledge')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          <span>Knowledge Base</span>
          <span className="nav-badge">{documents.length}</span>
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectTab('settings')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          <span>Settings</span>
        </button>
      </div>

      {/* Dynamic Tab Body */}
      <div className="sidebar-section">
        {activeTab === 'chats' && (
          <div className="sidebar-chat-history-pane">
            <div className="sidebar-action-row">
              <button className="new-chat-btn" onClick={onNewChat}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                <span>New Conversation</span>
              </button>
            </div>

            {sessions.length > 5 && (
              <div className="sidebar-search-input">
                <input
                  type="text"
                  placeholder="Filter chat history..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>
            )}

            <div className="sidebar-list-title">Conversation History</div>

            <div className="sessions-list">
              {filteredSessions.length === 0 ? (
                <div className="empty-state">No chat sessions yet. Ask a question to start.</div>
              ) : (
                filteredSessions.map(sess => {
                  const isActive = currentSessionId === sess.id;
                  return (
                    <div
                      key={sess.id}
                      className={`session-item ${isActive ? 'active' : ''}`}
                      onClick={() => onSelectSession(sess.id, sess.document_id)}
                    >
                      <div className="session-icon">💬</div>
                      <div className="session-details">
                        <div className="session-title" title={sess.title}>{sess.title}</div>
                        <div className="session-doc-name">{sess.document_title || 'Rental Agreement'}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div className="sidebar-kb-pane">
            <div className="sidebar-list-title">Active Document Selection</div>
            <div className="doc-list">
              {documents.length === 0 ? (
                <div className="empty-state">No agreements uploaded yet.</div>
              ) : (
                documents.map(doc => (
                  <div
                    key={doc.id}
                    className={`doc-item ${selectedDocId === doc.id ? 'active' : ''}`}
                    onClick={() => {
                      onSelectDocument(doc.id);
                      onSelectTab('chats');
                    }}
                  >
                    <div className="doc-icon">📄</div>
                    <div className="doc-details">
                      <div className="doc-title">{doc.title}</div>
                      <div className="doc-status-badge">
                        <span className={`status-dot ${doc.status.toLowerCase()}`}></span>
                        <span>{doc.status}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="sidebar-settings-pane">
            <div className="sidebar-list-title">Quick AI Status</div>
            <div className="quick-setting-card">
              <div className="qs-label">Model</div>
              <div className="qs-val">{model}</div>
            </div>
            <div className="quick-setting-card">
              <div className="qs-label">Temperature</div>
              <div className="qs-val">{temperature.toFixed(2)} (Grounding)</div>
            </div>
            <div className="quick-setting-card">
              <div className="qs-label">Retrieval</div>
              <div className="qs-val">Hybrid (BGE + BM25)</div>
            </div>
            <div className="quick-setting-card">
              <div className="qs-label">Chunking</div>
              <div className="qs-val">Structure-Aware Clause</div>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        {userEmail && (
          <div className="user-profile-row">
            <div className="user-avatar">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div className="user-email-text" title={userEmail}>
              {userEmail}
            </div>
          </div>
        )}

        <TokenDashboard usage={tokenUsage} />
        
        <div className="theme-toggle-row">
          <span>Theme Mode</span>
          <button 
            className="theme-toggle-btn" 
            onClick={onToggleTheme}
            title={theme === 'light' ? 'Switch to Dark theme' : 'Switch to Light theme'}
          >
            {theme === 'light' ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                <span>Light (Warm)</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                <span>Dark</span>
              </>
            )}
          </button>
        </div>

        <button className="logout-btn" onClick={onLogout}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
