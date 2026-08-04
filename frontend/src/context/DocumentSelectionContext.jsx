import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const DocumentSelectionContext = createContext(null);

export function DocumentSelectionProvider({ children }) {
  const { authToken } = useAuth();
  const [selectedDocIds, setSelectedDocIds] = useState([]);

  // Reset selected documents when logged out
  useEffect(() => {
    if (!authToken) {
      setSelectedDocIds([]);
    }
  }, [authToken]);

  const value = {
    selectedDocIds,
    setSelectedDocIds
  };

  return (
    <DocumentSelectionContext.Provider value={value}>
      {children}
    </DocumentSelectionContext.Provider>
  );
}

export function useDocumentSelection() {
  const context = useContext(DocumentSelectionContext);
  if (!context) {
    throw new Error('useDocumentSelection must be used within a DocumentSelectionProvider');
  }
  return context;
}
export { DocumentSelectionContext };
