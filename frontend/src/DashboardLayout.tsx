import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import type { ActiveNavTab } from './Sidebar';
import type { DocumentItem } from './components/KnowledgeBaseGrid';

interface LayoutProps {
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
  children: ReactNode;
}

export default function DashboardLayout({
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
  onToggleTheme,
  children
}: LayoutProps) {
  return (
    <div className="dashboard-layout">
      <Sidebar 
        authToken={authToken}
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        documents={documents}
        selectedDocId={selectedDocId}
        onSelectDocument={onSelectDocument}
        currentSessionId={currentSessionId}
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
        onLogout={onLogout}
        temperature={temperature}
        model={model}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
      <div className="dashboard-main">
        {children}
      </div>
    </div>
  );
}
