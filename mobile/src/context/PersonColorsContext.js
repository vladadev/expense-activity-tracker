import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { cachedGet } from '../api/cachedGet';
import { useAuth } from './AuthContext';
import { useHouseholds } from './HouseholdContext';
import { colorFor, toColorOrder } from '../utils/personColor';

// Holds the household's member list so a person's colour can be decided by
// their position in it rather than by their name.
//
// It is a context rather than a module-level variable on purpose. A variable
// primed by a network response does not re-render anything, so screens that
// had already drawn would keep the fallback colours until something else
// happened to refresh them — which is the kind of "usually fine" that turns
// into a bug report about two people sharing a colour.

const PersonColorsContext = createContext(null);

export function PersonColorsProvider({ children }) {
  const { user } = useAuth();
  // Somebody can be first in one household and third in another, so the order
  // is refetched whenever the household being looked at changes.
  const { activeId } = useHouseholds();
  const [order, setOrder] = useState([]);

  useEffect(() => {
    if (!user) {
      setOrder([]);
      return undefined;
    }
    let cancelled = false;
    cachedGet('/auth/users')
      .then((res) => {
        if (!cancelled) setOrder(toColorOrder(res.data.users));
      })
      .catch(() => {
        // No list means colours fall back to the hash. Worth nothing more
        // than that: a colour is never the only thing carrying a meaning.
      });
    return () => {
      cancelled = true;
    };
  }, [user, activeId]);

  const value = useMemo(() => ({ order }), [order]);
  return <PersonColorsContext.Provider value={value}>{children}</PersonColorsContext.Provider>;
}

// Returns a function rather than a colour, so it can be called inside a loop
// where a hook cannot be.
export function usePersonColor() {
  const ctx = useContext(PersonColorsContext);
  const order = ctx?.order;
  return useCallback((name) => colorFor(name, order), [order]);
}
