import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { api } from './api';

const AllDocumentsContext = createContext(null);

export function AllDocumentsProvider({ children }) {
  const { authToken, logout } = useAuth();
  const [documents, setDocuments] = useState([]);

  const fetchDocuments = async () => {
    if (!authToken) return;
    try {
      const res = await api.get('/documents');
      setDocuments(res.data);
    } catch (err) {
      console.error('Error fetching documents:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      }
    }
  };

  useEffect(() => {
    if (authToken) {
      fetchDocuments();
    } else {
      setDocuments([]);
    }
  }, [authToken]);

  const value = {
    documents,
    setDocuments,
    fetchDocuments
  };

  return (
    <AllDocumentsContext.Provider value={value}>
      {children}
    </AllDocumentsContext.Provider>
  );
}

export function useAllDocuments() {
  const context = useContext(AllDocumentsContext);
  if (!context) {
    throw new Error('useAllDocuments must be used within an AllDocumentsProvider');
  }
  return context;
}
export { AllDocumentsContext };
