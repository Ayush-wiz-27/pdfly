import React, { createContext, useContext } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { SidebarProvider, useSidebar } from './SidebarContext';
import { DocumentSelectionProvider, useDocumentSelection } from './DocumentSelectionContext';
import { SelectedModelProvider, useSelectedModel } from './SelectedModelContext';
import { AllDocumentsProvider, useAllDocuments } from './AllDocumentsContext';
import { UploadStatusProvider, useUploadStatus } from './UploadStatusContext';
import { ChatHistoryProvider, useChatHistory } from './ChatHistoryContext';
import { api } from './api';

const AppContext = createContext(null);

export { api };

export function AppProvider({ children }) {
  return (
    <AuthProvider>
      <SidebarProvider>
        <DocumentSelectionProvider>
          <SelectedModelProvider>
            <AllDocumentsProvider>
              <UploadStatusProvider>
                <ChatHistoryProvider>
                  <CombinedContextConsumer>{children}</CombinedContextConsumer>
                </ChatHistoryProvider>
              </UploadStatusProvider>
            </AllDocumentsProvider>
          </SelectedModelProvider>
        </DocumentSelectionProvider>
      </SidebarProvider>
    </AuthProvider>
  );
}

function CombinedContextConsumer({ children }) {
  const auth = useAuth();
  const sidebar = useSidebar();
  const docSelection = useDocumentSelection();
  const selectedModel = useSelectedModel();
  const allDocs = useAllDocuments();
  const uploadStatus = useUploadStatus();
  const chatHistory = useChatHistory();

  // Clear all app state on logout
  const combinedLogout = () => {
    auth.logout();
    docSelection.setSelectedDocIds([]);
    allDocs.setDocuments([]);
    chatHistory.setChatHistory([]);
    chatHistory.setActiveLogId(null);
    chatHistory.setCurrentChat({ messages: [], retrievedChunks: [] });
  };

  const value = {
    api,
    ...auth,
    logout: combinedLogout,
    ...sidebar,
    ...docSelection,
    ...selectedModel,
    ...allDocs,
    ...uploadStatus,
    ...chatHistory,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
export { useAppContext as useAppContextCompat };
export { AppContext };
