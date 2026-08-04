import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const { authToken } = useAuth();
  
  // Sidebar state defaults to local storage preference, defaulting to false (expanded)
  const [isSidebarCollapsed, setIsSidebarCollapsedState] = useState(
    localStorage.getItem('sidebar_collapsed') === 'true'
  );

  const setIsSidebarCollapsed = (val) => {
    setIsSidebarCollapsedState(val);
    localStorage.setItem('sidebar_collapsed', String(val));
  };

  // Force the sidebar to expand (set to false) when a user signs in (authToken becomes active)
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
