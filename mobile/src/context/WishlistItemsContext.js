import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import client from '../api/client';

// One cache for every wishlist and to-do item in the household.
//
// Before this, adding an item cost two round trips before anything appeared:
// the form POSTed, went back, and the list screen then refetched everything
// from scratch. At ~250ms each that is half a second of nothing happening
// while the data was already in hand.
//
// Now every mutation applies locally first and talks to the server afterwards,
// reverting only if the server refuses. Screens read from here instead of
// fetching their own copy, so the two list screens no longer duplicate the
// same request either.

const WishlistItemsContext = createContext(null);

let tempSeq = 0;

export function WishlistItemsProvider({ children }) {
  const [items, setItems] = useState([]);
  // Distinguishes "nothing loaded yet" from "loaded and genuinely empty" —
  // only the first deserves a skeleton.
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Revalidate without clearing: screens keep showing what they have while
  // the fresh copy is on its way, so returning to a tab never blanks it.
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await client.get('/wishlist/items');
      setItems(res.data.items);
      setLoaded(true);
    } catch (err) {
      console.log('Failed to load wishlist items:', err.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function revert(previous) {
    setItems(previous);
  }

  const addItem = useCallback(async (payload) => {
    const previous = itemsRef.current;
    // A placeholder id keeps React keys stable until the real document lands.
    const tempId = `temp-${++tempSeq}`;
    const optimistic = {
      _id: tempId,
      purchased: false,
      price: null,
      currency: null,
      link: '',
      notes: '',
      order: 9999,
      ...payload,
    };
    setItems((prev) => [...prev, optimistic]);
    try {
      const res = await client.post('/wishlist/items', payload);
      setItems((prev) => prev.map((i) => (i._id === tempId ? res.data.item : i)));
      return res.data.item;
    } catch (err) {
      // A write the queue has taken over has NOT failed — it has not been sent yet.
      // Rolling it back here would undo a change in front of someone whose only
      // mistake was being out of signal.
      if (!err.queued) revert(previous);
      throw err;
    }
  }, []);

  const updateItem = useCallback(async (id, payload) => {
    const previous = itemsRef.current;
    setItems((prev) => prev.map((i) => (i._id === id ? { ...i, ...payload } : i)));
    try {
      const res = await client.put(`/wishlist/items/${id}`, payload);
      setItems((prev) => prev.map((i) => (i._id === id ? res.data.item : i)));
      return res.data.item;
    } catch (err) {
      if (!err.queued) revert(previous);
      throw err;
    }
  }, []);

  // Returns the payload needed to put the item back, so the caller can offer
  // an undo instead of asking "are you sure?" beforehand. Confirming up front
  // taxes every correct deletion to guard against the rare wrong one; undo
  // charges only the mistake — and it is honest, because by then you have
  // seen what disappeared.
  const deleteItem = useCallback(async (id) => {
    const previous = itemsRef.current;
    const removed = previous.find((i) => i._id === id);
    setItems((prev) => prev.filter((i) => i._id !== id));
    try {
      await client.delete(`/wishlist/items/${id}`);
      return removed
        ? {
            category: removed.category,
            title: removed.title,
            price: removed.price,
            currency: removed.currency,
            link: removed.link,
            notes: removed.notes,
            reminderEnabled: removed.reminderEnabled,
            reminderAt: removed.reminderAt,
          }
        : null;
    } catch (err) {
      if (!err.queued) revert(previous);
      throw err;
    }
  }, []);

  // Checking something off must feel like a switch, not a request: the server
  // decides the timestamp and the reshuffle, but the tick happens now.
  const togglePurchased = useCallback(async (item) => {
    const next = !item.purchased;
    const previous = itemsRef.current;
    setItems((prev) =>
      prev.map((i) =>
        i._id === item._id
          ? { ...i, purchased: next, purchasedAt: next ? new Date().toISOString() : null }
          : i
      )
    );
    try {
      const res = await client.put(`/wishlist/items/${item._id}`, { purchased: next });
      setItems((prev) => prev.map((i) => (i._id === item._id ? res.data.item : i)));
    } catch (err) {
      if (!err.queued) revert(previous);
      throw err;
    }
  }, []);

  const reorderItems = useCallback(async (ids) => {
    // Same reason as the folder list: a placeholder id is not something the
    // server can cast, so pending records are left out of the payload.
    const realIds = ids.filter((id) => !String(id).startsWith('temp-'));
    const previous = itemsRef.current;
    const orderById = {};
    ids.forEach((id, i) => {
      orderById[id] = i;
    });
    setItems((prev) => prev.map((i) => (orderById[i._id] != null ? { ...i, order: orderById[i._id] } : i)));
    try {
      if (realIds.length > 0) await client.put('/wishlist/items/reorder', { ids: realIds });
    } catch (err) {
      if (!err.queued) revert(previous);
      throw err;
    }
  }, []);

  // Deleting a folder cascades on the server; mirroring it here stops its
  // items from lingering in the cache as orphans.
  const dropItemsIn = useCallback((categoryIds) => {
    const doomed = new Set(categoryIds.map(String));
    setItems((prev) => prev.filter((i) => !doomed.has(String(i.category))));
  }, []);

  return (
    <WishlistItemsContext.Provider
      value={{
        items,
        loaded,
        refreshing,
        refresh,
        addItem,
        updateItem,
        deleteItem,
        togglePurchased,
        reorderItems,
        dropItemsIn,
      }}
    >
      {children}
    </WishlistItemsContext.Provider>
  );
}

export function useWishlistItems() {
  const ctx = useContext(WishlistItemsContext);
  if (!ctx) throw new Error('useWishlistItems must be used within WishlistItemsProvider');
  return ctx;
}
