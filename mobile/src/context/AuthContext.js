import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client, { TOKEN_KEY } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await client.get('/auth/me');
      setUser(res.data.user);
    } catch (err) {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const res = await client.post('/auth/login', { email, password });
    await AsyncStorage.setItem(TOKEN_KEY, res.data.token);
    setUser(res.data.user);
  }

  async function logout() {
    try {
      await client.post('/auth/logout');
    } catch (err) {
      // ignore — token may already be invalid/expired
    }
    await AsyncStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
