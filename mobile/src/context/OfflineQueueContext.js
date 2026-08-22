import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';
import { setOfflineHandler } from '../api/offlineHooks';

// Writes that could not reach the server, kept until they can.
//
// Losing a change because the phone was in a lift is not acceptable, and
// neither is reverting it under someone who did nothing wrong. A write that
// failed with no response at all has not been refused — it has not been seen.
// So it waits here, the change stays on screen, and it goes out the moment
// there is a connection again.
//
// Detecting the connection is done by trying, not by asking: NetInfo is a
// native module and would mean a new build for every install. Retrying on a
// timer and whenever the app comes back to the foreground covers the same
// ground, and "did the request succeed" is the only signal that actually
// matters anyway.

const QUEUE_KEY = 'offline_queue_v1';
const RETRY_MS = 15000;
// Generous enough to survive a commute, finite so nothing can sit in here
// forever. At 15s a piece this is roughly five minutes of trying.
const MAX_ATTEMPTS = 20;
// A queued write gets its own timeout. Without one, a server that accepts the
// connection and then never answers looks identical to having no signal, and
// the entry retries against a request that never resolves.
const QUEUED_TIMEOUT_MS = 15000;

const OfflineQueueContext = createContext(null);

let seq = 0;

export function OfflineQueueProvider({ children }) {
  const [pending, setPending] = useState([]);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const flushingRef = useRef(false);
  const listenersRef = useRef(new Set());

  // Persisted so a queued change survives the app being closed — the case
  // where losing it would be least forgivable.
  const persist = useCallback((next) => {
    AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(QUEUE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) setPending(parsed);
      })
      .catch(() => {});
  }, []);

  const enqueue = useCallback(
    (config) => {
      const entry = {
        id: `q${Date.now()}-${++seq}`,
        method: (config.method || 'post').toLowerCase(),
        url: config.url,
        // axios has already serialised the body by this point.
        data: typeof config.data === 'string' ? config.data : JSON.stringify(config.data ?? null),
        params: config.params || null,
        attempts: 0,
        queuedAt: Date.now(),
      };
      setPending((prev) => {
        const next = [...prev, entry];
        persist(next);
        return next;
      });
      return true;
    },
    [persist]
  );

  useEffect(() => {
    setOfflineHandler(enqueue);
    return () => setOfflineHandler(null);
  }, [enqueue]);

  const notify = useCallback((count) => {
    for (const fn of listenersRef.current) {
      try {
        fn(count);
      } catch (err) {
        // A listener failing must not stop the flush.
      }
    }
  }, []);

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    const queue = pendingRef.current;
    if (queue.length === 0) return;
    flushingRef.current = true;
    let sent = 0;
    try {
      for (const entry of queue) {
        try {
          await client.request({
            method: entry.method,
            url: entry.url,
            data: entry.data ? JSON.parse(entry.data) : undefined,
            params: entry.params || undefined,
            timeout: QUEUED_TIMEOUT_MS,
            // Marks it so a second failure cannot re-queue the same write.
            __fromQueue: true,
          });
          sent += 1;
          setPending((prev) => {
            const next = prev.filter((e) => e.id !== entry.id);
            persist(next);
            return next;
          });
        } catch (err) {
          if (err.response) {
            // The server saw it and refused. Retrying will not change that, so
            // it is dropped rather than left to retry forever.
            setPending((prev) => {
              const next = prev.filter((e) => e.id !== entry.id);
              persist(next);
              return next;
            });
            continue;
          }
          // Still no answer: count the attempt, stop here so the order is
          // preserved, and give up on this entry once it has had its chances.
          // An entry that can never succeed must not be able to block the ones
          // behind it indefinitely.
          setPending((prev) => {
            const next = prev
              .map((e) => (e.id === entry.id ? { ...e, attempts: e.attempts + 1 } : e))
              .filter((e) => e.attempts < MAX_ATTEMPTS);
            persist(next);
            return next;
          });
          break;
        }
      }
    } finally {
      flushingRef.current = false;
      if (sent > 0) notify(sent);
    }
  }, [persist, notify]);

  // Three triggers, none of them a native module: a timer while anything is
  // waiting, the app returning to the foreground, and one attempt at startup.
  useEffect(() => {
    if (pending.length === 0) return undefined;
    const id = setInterval(flush, RETRY_MS);
    return () => clearInterval(id);
  }, [pending.length, flush]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') flush();
    });
    flush();
    return () => sub.remove();
  }, [flush]);

  // Screens subscribe to learn when queued writes finally landed, so they can
  // reload and replace whatever they were showing optimistically.
  const onFlushed = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  // Nothing in this app should ever be unclearable. If a queued write cannot
  // be sent for reasons the user cannot influence, they can drop it rather
  // than live with a banner that never goes away.
  const discardAll = useCallback(() => {
    setPending([]);
    persist([]);
  }, [persist]);

  return (
    <OfflineQueueContext.Provider value={{ pending, count: pending.length, flush, discardAll, onFlushed }}>
      {children}
    </OfflineQueueContext.Provider>
  );
}

export function useOfflineQueue() {
  const ctx = useContext(OfflineQueueContext);
  if (!ctx) throw new Error('useOfflineQueue must be used within OfflineQueueProvider');
  return ctx;
}

export function useOnQueueFlushed(handler) {
  const { onFlushed } = useOfflineQueue();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => onFlushed((count) => ref.current(count)), [onFlushed]);
}
