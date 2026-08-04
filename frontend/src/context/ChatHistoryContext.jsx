import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { api } from './api';

const ChatHistoryContext = createContext(null);

export function ChatHistoryProvider({ children }) {
  const { authToken, logout } = useAuth();
  const [chatHistory, setChatHistory] = useState([]);
  const [activeLogId, setActiveLogId] = useState(null);
  const [currentChat, setCurrentChat] = useState({
    messages: [],
    retrievedChunks: []
  });

  const startNewChat = () => {
    setActiveLogId(null);
    setCurrentChat({ messages: [], retrievedChunks: [] });
  };

  const fetchChatHistory = async () => {
    if (!authToken) return;
    try {
      const res = await api.get('/chat-history');
      setChatHistory(res.data);
    } catch (err) {
      console.error('Error fetching chat history:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      }
    }
  };

  useEffect(() => {
    if (authToken) {
      fetchChatHistory();
    } else {
      setChatHistory([]);
      setActiveLogId(null);
      setCurrentChat({ messages: [], retrievedChunks: [] });
    }
  }, [authToken]);

  const value = {
    chatHistory,
    setChatHistory,
    activeLogId,
    setActiveLogId,
    currentChat,
    setCurrentChat,
    startNewChat,
    fetchChatHistory
  };

  return (
    <ChatHistoryContext.Provider value={value}>
      {children}
    </ChatHistoryContext.Provider>
  );
}

export function useChatHistory() {
  const context = useContext(ChatHistoryContext);
  if (!context) {
    throw new Error('useChatHistory must be used within a ChatHistoryProvider');
  }
  return context;
}
export { ChatHistoryContext };
