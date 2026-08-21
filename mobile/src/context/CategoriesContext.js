import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import client from '../api/client';

const CategoriesContext = createContext(null);

let tempSeq = 0;
const SCOPES = ['expense', 'event', 'wishlist', 'todo'];

export function CategoriesProvider({ children }) {
  const [byScope, setByScope] = useState({ expense: [], event: [], wishlist: [], todo: [] });
  const [loading, setLoading] = useState(true);
  // Mirrors byScope so an optimistic update can capture the pre-change list to
  // revert to, without the mutation having to be a hook with byScope as a dep.
  const byScopeRef = useRef(byScope);
  byScopeRef.current = byScope;

  const refresh = useCallback(async (scope) => {
    const scopesToLoad = scope ? [scope] : SCOPES;
    // allSettled: one scope failing (e.g. a backend that doesn't know a newly
    // added scope yet) must never blank out every other category list.
    const results = await Promise.allSettled(
      scopesToLoad.map((s) => client.get('/categories', { params: { scope: s } }))
    );
    setByScope((prev) => {
      const next = { ...prev };
      scopesToLoad.forEach((s, i) => {
        if (results[i].status === 'fulfilled') next[s] = results[i].value.data.categories;
      });
      return next;
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } catch (err) {
        console.log('Failed to load categories:', err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  // Every mutation below used to POST/PUT and then refetch the whole scope:
  // two round trips before the screen changed, which at ~250ms each is the
  // second or two of lag you could feel on every action. The server already
  // returns the updated document, so the list is patched from that response —
  // one round trip — and moves/deletes are applied locally before the request
  // even goes out, since they cannot be rejected for any reason the UI has
  // not already checked. A failure reverts by refetching.
  function patchScope(scope, updater) {
    setByScope((prev) => ({ ...prev, [scope]: updater(prev[scope]) }));
  }

  // Optimistic like the rest: the folder appears on the tap, and the caller
  // gets the placeholder id back so it can highlight the new row immediately
  // rather than waiting for the server to name it.
  async function addCategory(scope, name, parent) {
    const previous = byScopeRef.current[scope];
    const tempId = `temp-cat-${++tempSeq}`;
    const optimistic = { _id: tempId, name, scope, parent: parent || null, order: 9999, pending: true };
    patchScope(scope, (list) => [...list, optimistic]);
    try {
      const res = await client.post('/categories', { scope, name, parent: parent || undefined });
      patchScope(scope, (list) => list.map((c) => (c._id === tempId ? res.data.category : c)));
      return res.data.category;
    } catch (err) {
      patchScope(scope, () => previous);
      throw err;
    }
  }

  async function renameCategory(id, scope, name) {
    const res = await client.put(`/categories/${id}`, { name });
    patchScope(scope, (list) => list.map((c) => (c._id === id ? res.data.category : c)));
  }

  // parent: a folder id, or null to move back out to the root. Sent even when
  // null, since the route distinguishes "move to root" from "do not move" by
  // whether the key is present at all.
  async function moveCategory(id, scope, parent) {
    const next = parent ?? null;
    const previous = byScopeRef.current[scope];
    patchScope(scope, (list) => list.map((c) => (c._id === id ? { ...c, parent: next } : c)));
    try {
      const res = await client.put(`/categories/${id}`, { parent: next });
      patchScope(scope, (list) => list.map((c) => (c._id === id ? res.data.category : c)));
    } catch (err) {
      patchScope(scope, () => previous);
      throw err;
    }
  }

  async function deleteCategory(id, scope) {
    const previous = byScopeRef.current[scope];
    // Subfolders go with the parent on the server, so they must go here too —
    // otherwise they linger as rows pointing at a folder that no longer exists.
    const doomed = new Set([id]);
    let added = true;
    while (added) {
      added = false;
      for (const c of previous) {
        if (!doomed.has(c._id) && c.parent && doomed.has(c.parent)) {
          doomed.add(c._id);
          added = true;
        }
      }
    }
    patchScope(scope, (list) => list.filter((c) => !doomed.has(c._id)));
    try {
      await client.delete(`/categories/${id}`);
    } catch (err) {
      patchScope(scope, () => previous);
      throw err;
    }
  }

  // Optimistic: reorders locally right away, then persists; reverts via
  // refresh if the server rejects it.
  async function reorderCategories(scope, ids) {
    const orderById = {};
    ids.forEach((id, i) => {
      orderById[id] = i;
    });
    setByScope((prev) => {
      const next = prev[scope].map((c) => (orderById[c._id] != null ? { ...c, order: orderById[c._id] } : c));
      next.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return { ...prev, [scope]: next };
    });
    try {
      await client.put('/categories/reorder', { ids });
    } catch (err) {
      await refresh(scope);
      throw err;
    }
  }

  return (
    <CategoriesContext.Provider
      value={{
        expenseCategories: byScope.expense,
        eventCategories: byScope.event,
        wishlistCategories: byScope.wishlist,
        todoCategories: byScope.todo,
        loading,
        refresh,
        addCategory,
        renameCategory,
        moveCategory,
        deleteCategory,
        reorderCategories,
      }}
    >
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error('useCategories must be used within CategoriesProvider');
  return ctx;
}
