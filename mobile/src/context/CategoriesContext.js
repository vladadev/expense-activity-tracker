import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import client from '../api/client';

const CategoriesContext = createContext(null);
const SCOPES = ['expense', 'event', 'wishlist', 'todo'];

export function CategoriesProvider({ children }) {
  const [byScope, setByScope] = useState({ expense: [], event: [], wishlist: [], todo: [] });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (scope) => {
    const scopesToLoad = scope ? [scope] : SCOPES;
    const results = await Promise.all(scopesToLoad.map((s) => client.get('/categories', { params: { scope: s } })));
    setByScope((prev) => {
      const next = { ...prev };
      scopesToLoad.forEach((s, i) => {
        next[s] = results[i].data.categories;
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

  async function addCategory(scope, name, parent) {
    await client.post('/categories', { scope, name, parent: parent || undefined });
    await refresh(scope);
  }

  async function renameCategory(id, scope, name) {
    await client.put(`/categories/${id}`, { name });
    await refresh(scope);
  }

  async function deleteCategory(id, scope) {
    await client.delete(`/categories/${id}`);
    await refresh(scope);
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
