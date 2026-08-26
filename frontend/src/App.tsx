import { useState, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import DashboardLayout from './DashboardLayout';
import type { ActiveNavTab } from './Sidebar';
import KnowledgeBaseGrid from './components/KnowledgeBaseGrid';
import type { DocumentItem } from './components/KnowledgeBaseGrid';
import SettingsView from './components/SettingsView';
import type { RAGSettings } from './components/SettingsView';
import SavedKeywordsBar from './components/SavedKeywordsBar';
import PdfViewerModal from './components/PdfViewerModal';

interface Citation {
  index: number;
  section: string;
  page: number;
  text_snippet: string;
  score?: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'ai';
  content: string;
  accuracy?: number;
  confidence?: string;
  citations?: Citation[];
  timestamp?: string;
}

function setCookie(name: string, value: string, days: number = 7) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function getCookie(name: string) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

function eraseCookie(name: string) {
  document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState<string>('');
  const [authError, setAuthError] = useState('');

  // Theme State: 'light' (default warm sand/oat palette) | 'dark'
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('rental_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('rental_theme', theme);
    } catch (e) {
      console.error(e);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  // Auth Form State
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Navigation State (1st: chats, 2nd: knowledge, 3rd: settings)
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('chats');

  // Documents & Selection State
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // PDF Viewer Modal State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfModalDocId, setPdfModalDocId] = useState<string | null>(null);
  const [pdfModalDocTitle, setPdfModalDocTitle] = useState('');

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [isDocumentIndexing, setIsDocumentIndexing] = useState(false);

  // Settings State
  const [ragSettings, setRagSettings] = useState<RAGSettings>({
    model: 'llama-3.3-70b-versatile',
    searchMode: 'hybrid',
    chunkingStrategy: 'Structure-Aware Hierarchical Clause Chunking',
    embeddingModel: 'FastEmbed BAAI/bge-small-en-v1.5 + Sparse BM25',
    topK: 5,
    temperature: 0.0
  });

  const [tokenUsage, setTokenUsage] = useState<{ token_quota: number; tokens_used: number } | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isQuerying]);

  useEffect(() => {
    const token = getCookie('auth_token');
    if (token) {
      setAuthToken(token);
      setIsAuthenticated(true);
      window.history.replaceState(null, '', '/');
    }
  }, []);

  // Fetch documents list
  const fetchDocuments = async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/v1/documents/', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        const docs: DocumentItem[] = data.documents || [];
        setDocuments(docs);

        // REQUIREMENT: By default latest PDF select hogi
        if (docs.length > 0 && !selectedDocId) {
          setSelectedDocId(docs[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch documents', e);
    }
  };

  // Fetch user info
  const fetchUserInfo = async () => {
    if (!authToken) return;
    try {
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
    } catch (err) {
      console.error('Failed to fetch user data', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated && authToken) {
      fetchDocuments();
      fetchUserInfo();
    }
  }, [isAuthenticated, authToken]);

  // Periodic polling when any document is in 'INDEXING' status
  useEffect(() => {
    const hasIndexingDocs = documents.some(d => d.status === 'INDEXING');
    if (!hasIndexingDocs || !isAuthenticated || !authToken) return;

    const intervalId = setInterval(() => {
      fetchDocuments();
    }, 2500);

    return () => clearInterval(intervalId);
  }, [documents, isAuthenticated, authToken]);

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
    const payload = isLogin ? { email, password } : { name, email, password };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let data: any = {};
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { detail: response.statusText || `HTTP ${response.status}` };
      }

      if (response.ok) {
        setAuthToken(data.access_token);
        setIsAuthenticated(true);
        setCookie('auth_token', data.access_token);
        window.history.replaceState(null, '', '/');
      } else {
        const errorMsg = data.detail || (typeof data === 'string' ? data : 'Authentication failed');
        setAuthError(errorMsg);
      }
    } catch (err: any) {
      setAuthError(`Authentication error: ${err?.message || 'Unable to reach backend server'}`);
    }
  };

  const handleLogout = () => {
    setAuthToken('');
    setIsAuthenticated(false);
    eraseCookie('auth_token');
    setSelectedDocId(null);
    setCurrentSessionId(null);
    setMessages([]);
    setDocuments([]);
  };

  // When a document is selected, load its latest session or initialize welcome message
  useEffect(() => {
    if (!selectedDocId || !authToken) {
      if (!selectedDocId) {
        setMessages([]);
        setCurrentSessionId(null);
      }
      return;
    }

    const fetchDocHistory = async () => {
      try {
        const res = await fetch('/api/v1/history/', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          const docSessions = (data.sessions || []).filter((s: any) => s.document_id === selectedDocId);
          if (docSessions.length > 0) {
            const latestSession = docSessions[0];
            setCurrentSessionId(latestSession.id);

            const msgRes = await fetch(`/api/v1/history/${latestSession.id}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (msgRes.ok) {
              const msgData = await msgRes.json();
              setMessages(msgData.messages || []);
              return;
            }
          }
        }

        // If no prior session for this doc
        const activeDoc = documents.find(d => d.id === selectedDocId);
        const docName = activeDoc?.title || 'Agreement';
        setCurrentSessionId(null);
        setMessages([
          {
            id: 'welcome-1',
            role: 'ai',
            content: `Hello! I have loaded "${docName}". You can ask any question regarding security deposit, lock-in period, maintenance responsibilities, notice terms, or select one of the saved keywords below.`
          }
        ]);
      } catch (e) {
        console.error(e);
      }
    };

    fetchDocHistory();
  }, [selectedDocId, authToken]);

  // Poll for document status
  useEffect(() => {
    if (!selectedDocId || !authToken) return;

    let timeoutId: any;
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/v1/documents/${selectedDocId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          const versions = data.versions || [];
          if (versions.length > 0) {
            const activeVersion = versions.find((v: any) => v.is_active) || versions[0];
            if (activeVersion.processing_status === "INDEXING") {
              setIsDocumentIndexing(true);
              timeoutId = setTimeout(checkStatus, 2000);
            } else {
              setIsDocumentIndexing(false);
            }
          }
        }
      } catch (err) {
        console.error("Error checking doc status", err);
      }
    };

    checkStatus();
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [selectedDocId, authToken]);

  const handleOpenPdfViewer = (docId: string, title?: string) => {
    const doc = documents.find(d => d.id === docId);
    setPdfModalDocId(docId);
    setPdfModalDocTitle(title || doc?.title || 'Rental Agreement');
    setIsPdfModalOpen(true);
  };

  const handleSelectSession = async (sessionId: string, docId: string) => {
    setSelectedDocId(docId);
    setCurrentSessionId(sessionId);
    setActiveTab('chats');

    try {
      const res = await fetch(`/api/v1/history/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (e) {
      console.error('Failed to load session messages', e);
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    const activeDoc = documents.find(d => d.id === selectedDocId);
    const docName = activeDoc?.title || 'Selected Agreement';
    setMessages([
      {
        id: Date.now().toString(),
        role: 'ai',
        content: `New chat session started for "${docName}". What clause or question would you like me to inspect?`
      }
    ]);
    setActiveTab('chats');
  };

  const sendQuery = async (queryText: string) => {
    if (!queryText.trim() || !selectedDocId || isQuerying) return;

    const userMsgText = queryText.trim();
    setInputMessage('');

    const newMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMsgText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, newMsg]);
    setIsQuerying(true);

    try {
      const response = await fetch('/api/v1/chat/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          document_id: selectedDocId,
          question: userMsgText,
          session_id: currentSessionId,
          temperature: ragSettings.temperature,
          model: ragSettings.model,
          top_k: ragSettings.topK,
          search_mode: ragSettings.searchMode
        })
      });

      const data = await response.json();

      if (response.ok) {
        if (!currentSessionId && data.session_id) {
          setCurrentSessionId(data.session_id);
        }
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: data.answer,
          accuracy: data.accuracy,
          confidence: data.confidence,
          citations: data.citations,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        fetchUserInfo();
      } else {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: `⚠️ Error: ${data.detail || 'Failed to retrieve response'}`
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: '⚠️ Network error communicating with the AI service.'
      }]);
    } finally {
      setIsQuerying(false);
    }
  };

  const handleSendMessage = (e: FormEvent) => {
    e.preventDefault();
    sendQuery(inputMessage);
  };

  const handleSelectKeyword = (keyword: string) => {
    setActiveTab('chats');
    sendQuery(`What does the agreement state regarding ${keyword}?`);
  };

  const selectedDocument = documents.find(d => d.id === selectedDocId);

  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        <div className="glass-panel auth-card">
          <div className="auth-header">
            <div className="auth-logo-badge">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            <h1>AI Rental Intelligence</h1>
            <p>{isLogin ? 'Sign in to access your agreement knowledge base' : 'Create an account to start analyzing legal leases'}</p>
          </div>

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            {authError && <div className="auth-error-banner">{authError}</div>}

            {!isLogin && (
              <div className="input-group">
                <label>Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Jane Doe"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
            )}

            <div className="input-group">
              <label>Email Address</label>
              <input
                type="email"
                required
                placeholder="tenant@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label>Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="auth-submit-btn">
              {isLogin ? 'Sign In to Dashboard' : 'Create Free Account'}
            </button>
          </form>

          <div className="auth-toggle">
            {isLogin ? (
              <>Don't have an account? <span onClick={() => setIsLogin(false)}>Sign Up</span></>
            ) : (
              <>Already have an account? <span onClick={() => setIsLogin(true)}>Sign In</span></>
            )}
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === 'light' ? 'Switch to Dark theme' : 'Switch to Light theme'}
            >
              {theme === 'light' ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                  <span>Light Theme (Warm Sand)</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                  <span>Dark Theme</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      authToken={authToken}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      documents={documents}
      selectedDocId={selectedDocId}
      onSelectDocument={(id) => {
        setSelectedDocId(id);
      }}
      currentSessionId={currentSessionId}
      onSelectSession={handleSelectSession}
      onNewChat={handleNewChat}
      onLogout={handleLogout}
      temperature={ragSettings.temperature}
      model={ragSettings.model}
      theme={theme}
      onToggleTheme={toggleTheme}
    >
      {/* Tab 1: CHATS */}
      {activeTab === 'chats' && (
        <div className="main-chat-view-container">
          {/* Top Bar for Chat */}
          <div className="chat-top-header glass-panel">
            <div className="chat-doc-info">
              <div className="doc-icon-circle">📄</div>
              <div>
                <div className="doc-title-row">
                  <h3>{selectedDocument ? selectedDocument.title : 'No Agreement Selected'}</h3>
                  {selectedDocument && <span className="doc-ver-tag">v{selectedDocument.active_version || 1}.0</span>}
                  {selectedDocument && (
                    <span className={`status-pill ${selectedDocument.status.toLowerCase()}`} style={{ marginLeft: 8 }}>
                      <span className="status-dot"></span>
                      {selectedDocument.status}
                    </span>
                  )}
                </div>
                <span className="doc-sub-text">
                  {selectedDocument?.status === 'INDEXING' ? (
                    <span style={{ color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      ⏳ Document is indexing in background... vectors are being generated.
                    </span>
                  ) : selectedDocument?.status === 'FAILED' ? (
                    <span style={{ color: '#ef4444' }}>
                      ⚠️ Indexing failed. Go to Knowledge Base and click Retry.
                    </span>
                  ) : selectedDocument ? (
                    'Active context for grounded questions'
                  ) : (
                    'Go to Knowledge Base or select an agreement'
                  )}
                </span>
              </div>
            </div>

            <div className="chat-top-actions">
              <div className="chat-config-pill" onClick={() => setActiveTab('settings')} title="View / change RAG settings">
                <span className="config-dot"></span>
                <span>{ragSettings.model.split('-')[0].toUpperCase()}</span>
                <span className="config-temp">T:{ragSettings.temperature.toFixed(1)}</span>
              </div>

              {selectedDocId && (
                <button
                  className="chat-view-pdf-btn"
                  onClick={() => handleOpenPdfViewer(selectedDocId, selectedDocument?.title)}
                  title="View original PDF agreement"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  <span>View PDF</span>
                </button>
              )}
            </div>
          </div>

          {/* Saved Keywords Bar */}
          <SavedKeywordsBar
            onSelectKeyword={handleSelectKeyword}
            currentQuestion={inputMessage}
          />

          {/* Chat Messages Feed */}
          <div className="chat-messages-area glass-panel">
            {!selectedDocId && documents.length === 0 ? (
              <div className="chat-empty-state">
                <div className="empty-icon-glow">📂</div>
                <h3>No Rental Agreement Uploaded</h3>
                <p>Switch to the <b>Knowledge Base</b> tab to upload your lease agreement PDF or images.</p>
                <button className="kb-shortcut-btn" onClick={() => setActiveTab('knowledge')}>
                  Go to Knowledge Base & Upload
                </button>
              </div>
            ) : !selectedDocId ? (
              <div className="chat-empty-state">
                <div className="empty-icon-glow">📄</div>
                <h3>Please Select an Agreement</h3>
                <p>Choose an agreement from the sidebar or Knowledge Base to begin your analysis.</p>
              </div>
            ) : (
              <div className="messages-scroll-wrapper">
                {messages.map(msg => (
                  <div key={msg.id} className={`message-row ${msg.role === 'user' ? 'user-row' : 'ai-row'}`}>
                    <div className="message-avatar">
                      {msg.role === 'user' ? '👤' : '⚡'}
                    </div>

                    <div className={`message-bubble ${msg.role === 'user' ? 'user-bubble' : 'ai-bubble'}`}>
                      {/* AI Grounding Meter */}
                      {msg.role !== 'user' && msg.accuracy !== undefined && (
                        <div className={`accuracy-badge-container ${msg.accuracy >= 85 ? 'accuracy-high' : msg.accuracy >= 70 ? 'accuracy-medium' : msg.accuracy > 0 ? 'accuracy-low' : 'accuracy-none'}`}>
                          <div className="accuracy-badge-header">
                            <div className="accuracy-badge-label">
                              <span className="accuracy-icon">🎯</span>
                              <span className="accuracy-text">
                                {msg.accuracy > 0 ? `Grounding Accuracy: ${msg.accuracy}%` : 'Not Found in Uploaded Agreement'}
                              </span>
                            </div>
                            <span className="accuracy-pill">
                              {msg.confidence || (msg.accuracy >= 88 ? 'High' : msg.accuracy >= 70 ? 'Medium' : msg.accuracy > 0 ? 'Low' : 'Not Found')}
                            </span>
                          </div>
                          {msg.accuracy > 0 && (
                            <div className="accuracy-meter-bar">
                              <div
                                className="accuracy-meter-fill"
                                style={{ width: `${Math.max(5, Math.min(100, msg.accuracy))}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Message Content */}
                      <div className="message-text-body">
                        {msg.content}
                      </div>

                      {/* Verified Citations Snippets */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="citations-container">
                          <div className="citations-header">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                            <span>Verified Agreement Sources ({msg.citations.length})</span>
                          </div>
                          <div className="citations-grid">
                            {msg.citations.map((cite, idx) => (
                              <div key={idx} className="citation-card">
                                <div className="citation-card-top">
                                  <span className="cite-index">[{cite.index}] {cite.section}</span>
                                  <div className="cite-badges">
                                    <span className="cite-page">Page {cite.page}</span>
                                    {cite.score !== undefined && (
                                      <span className="cite-score">{cite.score}% match</span>
                                    )}
                                  </div>
                                </div>
                                <div className="cite-text">"{cite.text_snippet}"</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Message Footer */}
                      {msg.timestamp && (
                        <div className="message-time">{msg.timestamp}</div>
                      )}
                    </div>
                  </div>
                ))}

                {isDocumentIndexing && (
                  <div className="message-row ai-row">
                    <div className="message-avatar">⚡</div>
                    <div className="message-bubble ai-bubble indexing-bubble">
                      <span className="spinner-dot"></span>
                      <span>Semantic vector indexing is processing in background. Answers will be available shortly...</span>
                    </div>
                  </div>
                )}

                {isQuerying && !isDocumentIndexing && (
                  <div className="message-row ai-row">
                    <div className="message-avatar">⚡</div>
                    <div className="message-bubble ai-bubble typing-bubble">
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="typing-label">Searching retrieved clauses & generating answer...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Chat Input Bar */}
          <form className="chat-bottom-input-bar glass-panel" onSubmit={handleSendMessage}>
            <input
              type="text"
              placeholder={
                !selectedDocId
                  ? "Select an agreement from Knowledge Base to start asking..."
                  : selectedDocument?.status === 'INDEXING'
                    ? "Document is currently indexing in background... please wait a moment."
                    : selectedDocument?.status === 'FAILED'
                      ? "Document indexing failed. Please retry in Knowledge Base."
                      : "Ask any question about clauses, notice period, security deposit, rent escalation..."
              }
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              disabled={!selectedDocId || isQuerying || selectedDocument?.status === 'INDEXING' || selectedDocument?.status === 'FAILED'}
            />
            <button
              type="submit"
              className="chat-send-btn"
              disabled={!selectedDocId || isQuerying || selectedDocument?.status === 'INDEXING' || selectedDocument?.status === 'FAILED' || !inputMessage.trim()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              <span>Send</span>
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: KNOWLEDGE BASE (Grid-based PDF support & Auto-Select latest) */}
      {activeTab === 'knowledge' && (
        <KnowledgeBaseGrid
          documents={documents}
          selectedDocId={selectedDocId}
          onSelectDocument={(id) => {
            setSelectedDocId(id);
            setActiveTab('chats');
          }}
          onViewPdf={(id, title) => handleOpenPdfViewer(id, title)}
          authToken={authToken}
          onRefreshDocuments={fetchDocuments}
        />
      )}

      {/* Tab 3: SETTINGS */}
      {activeTab === 'settings' && (
        <SettingsView
          settings={ragSettings}
          onUpdateSettings={(newSettings) => setRagSettings(prev => ({ ...prev, ...newSettings }))}
          tokenUsage={tokenUsage}
          userEmail={userEmail}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}

      {/* Embedded PDF Viewer Modal */}
      <PdfViewerModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        documentId={pdfModalDocId}
        documentTitle={pdfModalDocTitle}
        authToken={authToken}
      />
    </DashboardLayout>
  );
}

export default App;
