import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authToken, setAuthTokenState] = useState(
    localStorage.getItem('app_auth_token') || ''
  );
  const [currentUser, setCurrentUserState] = useState(
    localStorage.getItem('app_user') ? JSON.parse(localStorage.getItem('app_user')) : null
  );

  const setAuthToken = (token) => {
    if (token) {
      setAuthTokenState(token);
      localStorage.setItem('app_auth_token', token);
    } else {
      setAuthTokenState('');
      localStorage.removeItem('app_auth_token');
    }
  };

  const setCurrentUser = (user) => {
    if (user) {
      setCurrentUserState(user);
      localStorage.setItem('app_user', JSON.stringify(user));
    } else {
      setCurrentUserState(null);
      localStorage.removeItem('app_user');
    }
  };

  const logout = () => {
    setAuthToken('');
    setCurrentUser(null);
  };

  const value = {
    authToken,
    setAuthToken,
    currentUser,
    setCurrentUser,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
export { AuthContext };
