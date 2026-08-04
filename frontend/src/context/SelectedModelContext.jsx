import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { api } from './api';

const SelectedModelContext = createContext(null);

export function SelectedModelProvider({ children }) {
  const { authToken, logout } = useAuth();
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');

  const fetchModels = async () => {
    if (!authToken) return;
    try {
      const res = await api.get('/models');
      setModels(res.data);
      if (res.data.length > 0) {
        setSelectedModel(res.data[0].id);
      }
    } catch (err) {
      console.error('Error fetching models:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      }
    }
  };

  useEffect(() => {
    if (authToken) {
      fetchModels();
    } else {
      setModels([]);
      setSelectedModel('');
    }
  }, [authToken]);

  const value = {
    models,
    setModels,
    selectedModel,
    setSelectedModel,
    fetchModels
  };

  return (
    <SelectedModelContext.Provider value={value}>
      {children}
    </SelectedModelContext.Provider>
  );
}

export function useSelectedModel() {
  const context = useContext(SelectedModelContext);
  if (!context) {
    throw new Error('useSelectedModel must be used within a SelectedModelProvider');
  }
  return context;
}
export { SelectedModelContext };
