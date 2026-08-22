import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';

// A small bus for "something was just written".
//
// Expenses, income, savings and events are each read by several screens over
// different date ranges, so a single cache the way the lists have one would
// have to model every one of those ranges. What actually causes the lag is
// narrower than that: a form saves, navigates back, and the screen underneath
// refetches from scratch before the new record appears — a second round trip
// for a record the form already had in its hands.
//
// So the form announces what it wrote, and any screen currently showing a list
// that the record belongs in merges it straight away. The refetch still
// happens behind that, and reconciles anything the merge got wrong.
//
// kind:   'expense' | 'income' | 'savings' | 'event'
// action: 'create' | 'update' | 'delete'

const DataEventsContext = createContext(null);

export function DataEventsProvider({ children }) {
  const listeners = useRef(new Set());

  const emit = useCallback((kind, action, entity) => {
    for (const fn of listeners.current) {
      try {
        fn({ kind, action, entity });
      } catch (err) {
        // One screen's merge must never stop another's.
        console.log('Data event listener failed:', err.message);
      }
    }
  }, []);

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  return <DataEventsContext.Provider value={{ emit, subscribe }}>{children}</DataEventsContext.Provider>;
}

export function useDataEvents() {
  const ctx = useContext(DataEventsContext);
  if (!ctx) throw new Error('useDataEvents must be used within DataEventsProvider');
  return ctx;
}

// Handler is kept in a ref so a screen can pass an inline arrow without
// resubscribing on every render.
export function useOnDataEvent(handler) {
  const { subscribe } = useDataEvents();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => subscribe((event) => ref.current(event)), [subscribe]);
}

// Applies a create/update/delete to a plain array of records, leaving the
// caller to decide whether the record belongs in its list at all.
export function applyDataEvent(list, event, { belongs = () => true } = {}) {
  const { action, entity } = event;
  if (!entity || !entity._id) return list;
  if (action === 'delete') return list.filter((r) => r._id !== entity._id);
  const without = list.filter((r) => r._id !== entity._id);
  if (!belongs(entity)) return without;
  return [...without, entity];
}
