import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const { authToken } = useAuth();
  
  // Read saved sidebar preference from local storage
  const [isSidebarCollapsed, setIsSidebarCollapsedState] = useState(
    localStorage.getItem('sidebar_collapsed') === 'true'
  );

  const setIsSidebarCollapsed = (val) => {
    setIsSidebarCollapsedState(val);
    localStorage.setItem('sidebar_collapsed', String(val));
  };

  // Expand sidebar when user logs in
  useEffect(() => {
    if (authToken) {
      setIsSidebarCollapsedState(false);
    }
  }, [authToken]);

  const value = {
    isSidebarCollapsed,
    setIsSidebarCollapsed
  };

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
export { SidebarContext };
