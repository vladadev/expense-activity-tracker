import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import client from '../api/client';

const NotificationsContext = createContext(null);
const POLL_INTERVAL_MS = 30000;

export function NotificationsProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const intervalRef = useRef(null);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await client.get('/notifications/unread-count');
      setUnreadCount(res.data.count);
    } catch (err) {
      console.log('Failed to refresh unread notification count:', err.message);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await client.get('/notifications', { params: { limit: 100 } });
      setNotifications(res.data.notifications);
    } catch (err) {
      console.log('Failed to load notifications:', err.message);
    }
  }, []);

  const markSeen = useCallback(async () => {
    setUnreadCount(0);
    try {
      await client.post('/notifications/seen');
    } catch (err) {
      console.log('Failed to mark notifications seen:', err.message);
    }
  }, []);

  useEffect(() => {
    refreshUnreadCount();
    intervalRef.current = setInterval(refreshUnreadCount, POLL_INTERVAL_MS);

    // Also refresh whenever the app comes back to the foreground, so the
    // badge is fresh right away instead of waiting for the next poll tick.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshUnreadCount();
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [refreshUnreadCount]);

  return (
    <NotificationsContext.Provider
      value={{ unreadCount, notifications, loadNotifications, refreshUnreadCount, markSeen }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
