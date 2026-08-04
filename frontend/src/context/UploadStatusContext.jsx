import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useAllDocuments } from './AllDocumentsContext';
import { api } from './api';

const UploadStatusContext = createContext(null);

export function UploadStatusProvider({ children }) {
  const { authToken } = useAuth();
  const { fetchDocuments } = useAllDocuments();
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); // 'success' | 'error' | null
  const [uploadStatusMsg, setUploadStatusMsg] = useState('');

  // Reset upload status when logged out
  useEffect(() => {
    if (!authToken) {
      setUploading(false);
      setUploadStatus(null);
      setUploadStatusMsg('');
    }
  }, [authToken]);

  const uploadFile = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setUploadStatus('error');
      setUploadStatusMsg('Only PDF files are supported.');
      return;
    }

    setUploading(true);
    setUploadStatus(null);
    setUploadStatusMsg('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setUploadStatus('success');
      setUploadStatusMsg(`Successfully processed "${file.name}"!`);
      
      // Sync document indexes
      fetchDocuments();

      setTimeout(() => {
        setUploadStatus(null);
      }, 4000);
    } catch (error) {
      setUploadStatus('error');
      setUploadStatusMsg(error.response?.data?.error || `Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const value = {
    uploading,
    setUploading,
    uploadStatus,
    setUploadStatus,
    uploadStatusMsg,
    setUploadStatusMsg,
    uploadFile
  };

  return (
    <UploadStatusContext.Provider value={value}>
      {children}
    </UploadStatusContext.Provider>
  );
}

export function useUploadStatus() {
  const context = useContext(UploadStatusContext);
  if (!context) {
    throw new Error('useUploadStatus must be used within an UploadStatusProvider');
  }
  return context;
}
export { UploadStatusContext };
