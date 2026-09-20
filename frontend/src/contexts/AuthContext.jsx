import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('grocery_user');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verifySession() {
      const token = localStorage.getItem('grocery_access_token');
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        if (res.data?.user) {
          setUser(res.data.user);
          localStorage.setItem('grocery_user', JSON.stringify(res.data.user));
        }
      } catch (err) {
        console.warn('Session check failed:', err.message);
        setUser(null);
        localStorage.removeItem('grocery_access_token');
        localStorage.removeItem('grocery_user');
      } finally {
        setLoading(false);
      }
    }

    verifySession();
  }, []);

  const login = async (identifier, password) => {
    const res = await api.post('/auth/login', { identifier, password });
    const { user: authUser, accessToken } = res.data;
    localStorage.setItem('grocery_access_token', accessToken);
    localStorage.setItem('grocery_user', JSON.stringify(authUser));
    setUser(authUser);
    return authUser;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore
    } finally {
      localStorage.removeItem('grocery_access_token');
      localStorage.removeItem('grocery_user');
      setUser(null);
      window.location.href = '/login';
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    isSuperAdmin: user?.role === 'SUPER_ADMIN',
    isAdmin: user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN',
    login,
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
