import React from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import Header from './components/Header';
import AuthScreen from './components/AuthScreen';
import './App.css';

function MainLayout() {
  return (
    <div className="flex h-screen text-slate-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 flex flex-col h-full min-w-0">
        
        {/* Header */}
        <Header />

        {/* Chat area */}
        <div className="flex-1 flex flex-col overflow-hidden p-6">
          {/* Chat widget */}
          <div className="flex-1 min-h-0 glass-panel rounded-2xl overflow-hidden flex flex-col">
            <ChatInterface />
          </div>
        </div>
      </main>
    </div>
  );
}

function WorkspaceRouter() {
  const { authToken } = useAppContext();
  return authToken ? <MainLayout /> : <AuthScreen />;
}

export default function App() {
  return (
    <AppProvider>
      <WorkspaceRouter />
    </AppProvider>
  );
}
