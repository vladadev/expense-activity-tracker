import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import client from '../api/client';

const CategoriesContext = createContext(null);
const SCOPES = ['expense', 'event', 'wishlist'];

export function CategoriesProvider({ children }) {
  const [byScope, setByScope] = useState({ expense: [], event: [], wishlist: [] });
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

  async function addCategory(scope, name) {
    await client.post('/categories', { scope, name });
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

  return (
    <CategoriesContext.Provider
      value={{
        expenseCategories: byScope.expense,
        eventCategories: byScope.event,
        wishlistCategories: byScope.wishlist,
        loading,
        refresh,
        addCategory,
        renameCategory,
        deleteCategory,
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
