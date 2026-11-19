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

  // Clear status on logout
  useEffect(() => {
    if (!authToken) {
      setUploading(false);
      setUploadStatus(null);
      setUploadStatusMsg('');
    }
  }, [authToken]);

  // Upload PDF directly to S3 via presigned URL, then poll worker status
  const uploadFile = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadStatus('error');
      setUploadStatusMsg('Only PDF files are supported.');
      return;
    }

    setUploading(true);
    setUploadStatus(null);

    let documentId = null;

    try {
      // 1. Initiate upload: Get presigned Cloudflare R2 URL from API
      setUploadStatusMsg('Initiating presigned upload...');
      const initRes = await api.post('/documents', { filename: file.name });
      documentId = initRes.data.documentId;
      const uploadUrl = initRes.data.uploadUrl;

      // 2. Upload file DIRECTLY to Cloudflare R2 storage via presigned PUT URL
      setUploadStatusMsg('Uploading PDF directly to Cloudflare storage...');
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/pdf',
        },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error(`Direct Cloudflare storage upload failed with HTTP status ${putRes.status}`);
      }

      // 3. Mark upload complete & queue job
      setUploadStatusMsg('Finalizing upload...');
      await api.post(`/documents/${documentId}/complete`);

      // Refresh sidebar doc list
      fetchDocuments();

      // 4. Poll until background processing is complete
      setUploadStatusMsg('Processing PDF...');
      let isFinished = false;
      let attempts = 0;
      const maxAttempts = 60; // 2 minute timeout

      while (!isFinished && attempts < maxAttempts) {
        attempts++;
        await new Promise((res) => setTimeout(res, 2000));

        try {
          const docRes = await api.get(`/documents/${documentId}`);
          const currentStatus = docRes.data.status;

          if (currentStatus === 'READY') {
            isFinished = true;
            setUploadStatus('success');
            setUploadStatusMsg(`Successfully vectorized & ready "${file.name}"!`);
            fetchDocuments();
          } else if (currentStatus === 'FAILED') {
            isFinished = true;
            setUploadStatus('error');
            setUploadStatusMsg(`Document processing failed for "${file.name}".`);
            fetchDocuments();
          } else {
            setUploadStatusMsg(`Document status: ${currentStatus}...`);
          }
        } catch (pollErr) {
          console.warn('Document polling check error:', pollErr.message);
        }
      }

      setTimeout(() => {
        setUploadStatus(null);
      }, 4000);
    } catch (error) {
      console.error('Direct Presigned R2 Upload Error:', error);
      setUploadStatus('error');
      setUploadStatusMsg(error.response?.data?.error || `Upload failed: ${error.message}`);

      // If direct presigned upload failed, delete stale AWAITING_UPLOAD record so it doesn't clutter sidebar
      if (documentId) {
        try {
          await api.delete(`/documents/${documentId}`);
          fetchDocuments();
        } catch (cleanupErr) {
          console.warn('Stale document cleanup warning:', cleanupErr.message);
        }
      }
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
