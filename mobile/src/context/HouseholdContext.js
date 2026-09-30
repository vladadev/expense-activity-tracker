import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';
import { cachedGet } from '../api/cachedGet';
import { setActiveHouseholdId } from '../api/activeHousehold';
import { useAuth } from './AuthContext';

// Which households this account belongs to, and which one it is looking at.
//
// One at a time, the way Discord shows one server at a time: everything on
// screen belongs to the active household, and switching changes all of it at
// once. The alternative — everything added up across households — would make
// a private expense show up in a shared total, which is the opposite of why
// somebody keeps two.
//
// The choice is remembered per account, so opening the app puts you back
// where you were rather than somewhere arbitrary.

const HouseholdContext = createContext(null);

const activeKey = (userId) => `active_household:${userId}`;

export function HouseholdProvider({ children }) {
  const { user } = useAuth();
  const [households, setHouseholds] = useState([]);
  const [activeId, setActiveIdState] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Set before any request goes out, not in an effect afterwards: a screen
  // that fetches on mount would otherwise send the first request with no
  // household on it.
  const apply = useCallback((id) => {
    setActiveHouseholdId(id);
    setActiveIdState(id ? String(id) : null);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await cachedGet('/households');
      const list = res.data.households || [];
      setHouseholds(list);

      const remembered = await AsyncStorage.getItem(activeKey(user.id)).catch(() => null);
      // A remembered household the account no longer belongs to — they left
      // it, or it was on another phone — falls back to the first one rather
      // than leaving the app pointed at something it cannot read.
      const stillAMember = list.some((h) => String(h.id) === String(remembered));
      apply(stillAMember ? remembered : list[0]?.id || null);
    } catch (err) {
      // Offline with nothing cached. The server falls back to the caller's
      // most recent household when no header arrives, so the app still works;
      // it just cannot offer a switcher yet.
    } finally {
      setLoaded(true);
    }
  }, [user, apply]);

  useEffect(() => {
    if (!user) {
      setHouseholds([]);
      apply(null);
      setLoaded(false);
      return;
    }
    load();
  }, [user, load, apply]);

  const switchTo = useCallback(
    async (id) => {
      if (!id || String(id) === String(activeId)) return;
      apply(id);
      // Remembered per account, since two people share a phone during testing.
      if (user) AsyncStorage.setItem(activeKey(user.id), String(id)).catch(() => {});
    },
    [activeId, apply, user]
  );

  const create = useCallback(
    async (name) => {
      const res = await client.post('/households', { name });
      const created = res.data.household;
      await load();
      await switchTo(created.id);
      return created;
    },
    [load, switchTo]
  );

  const join = useCallback(
    async (code) => {
      const res = await client.post('/households/join', { code });
      const joined = res.data.household;
      await load();
      // Landing in the household you just joined is the only sensible place
      // to be after joining it.
      await switchTo(joined.id);
      return joined;
    },
    [load, switchTo]
  );

  const leave = useCallback(
    async (confirmName) => {
      const res = await client.post('/households/leave', { confirmName });
      const next = res.data.household;
      await load();
      await switchTo(next.id);
      return next;
    },
    [load, switchTo]
  );

  const active = useMemo(
    () => households.find((h) => String(h.id) === String(activeId)) || null,
    [households, activeId]
  );

  const value = useMemo(
    () => ({ households, active, activeId, loaded, switchTo, create, join, leave, refresh: load }),
    [households, active, activeId, loaded, switchTo, create, join, leave, load]
  );

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHouseholds() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHouseholds must be used within HouseholdProvider');
  return ctx;
}
