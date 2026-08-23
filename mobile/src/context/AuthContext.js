import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client, { TOKEN_KEY } from '../api/client';
import { identifyUser, clearUser } from '../utils/errorReporting';
import { clearOfflineCache } from '../api/cachedGet';

const AuthContext = createContext(null);

// The last account this device was signed in as. Kept so the app can open
// without a connection — see restoreSession.
const USER_KEY = 'auth_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  // Tags crash reports with an opaque account id — never a name or email —
  // so one person hitting a bug 40 times is distinguishable from 40 people.
  useEffect(() => {
    if (user) identifyUser(user);
    else clearUser();
  }, [user]);

  async function restoreSession() {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await client.get('/auth/me');
      setUser(res.data.user);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
    } catch (err) {
      // Only a server that REFUSES the token means the session is over. Any
      // other failure — no signal, a timeout, the API being down — means the
      // session could not be checked, which is not the same thing. Discarding
      // the token there logged people out for opening the app on a train, and
      // signing back in needs the very connection they do not have.
      const rejected = err.response?.status === 401 || err.response?.status === 403;
      if (rejected) {
        await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
      } else {
        const cached = await AsyncStorage.getItem(USER_KEY);
        if (cached) setUser(JSON.parse(cached));
      }
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const res = await client.post('/auth/login', { email, password });
    await AsyncStorage.multiSet([
      [TOKEN_KEY, res.data.token],
      [USER_KEY, JSON.stringify(res.data.user)],
    ]);
    setUser(res.data.user);
  }

  async function register(name, email, password) {
    const res = await client.post('/auth/register', { name, email, password });
    await AsyncStorage.multiSet([
      [TOKEN_KEY, res.data.token],
      [USER_KEY, JSON.stringify(res.data.user)],
    ]);
    setUser(res.data.user);
    return res.data.user;
  }

  // Called after joining/leaving a household so screens depending on
  // user.household re-read the current value without a full re-login.
  async function refreshUser() {
    const res = await client.get('/auth/me');
    setUser(res.data.user);
    return res.data.user;
  }

  async function logout() {
    try {
      await client.post('/auth/logout');
    } catch (err) {
      // ignore — token may already be invalid/expired
    }
    // Logging out deliberately clears the cached account too, or the next
    // launch would restore it from storage.
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    await clearOfflineCache();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
