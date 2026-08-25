---
name: offline-write
description: Add or change a write (create/update/delete/reorder) in the app so it feels instant, survives no connection, and cannot corrupt data. Use when adding a form, a mutation, a reorder, or a delete.
---

# Adding a write

Every write in this app goes through the same three layers. Skipping one is
what produces the bugs that are hard to find later.

## 1. Optimistic update, with a revert that knows about the queue

The context (`WishlistItemsContext`, `CategoriesContext`, …) applies the change
to its own state first, then calls the API, then reverts on failure:

```js
setItems(next);
try {
  await client.post('/items', body);
} catch (err) {
  if (!err.queued) setItems(previous);   // ← the guard that matters
  throw err;
}
```

`err.queued` is set by the axios interceptor in `src/api/client.js` when a
write got **no response** and was accepted into the offline queue. Reverting a
queued write is a real bug: the change is going to be sent, so the screen would
show the old value and then flip back minutes later.

## 2. Temporary ids must never reach the server

An optimistic create invents an id like `temp-1712…`. Mongo cannot cast that,
and a queued request carrying one **fails forever** — it retries 20 times and
then sits in the queue looking broken. Filter before sending:

```js
const realIds = ids.filter((id) => !String(id).startsWith('temp-'));
if (realIds.length === 0) return;
```

Do this for anything that sends a list of ids (reorder, bulk move).

## 3. The server must reject garbage with a response, not a hang

Two rules on the backend:

- validate ids: `mongoose.Types.ObjectId.isValid(id)` before any query, and
  return 400 for a bad one. An uncaught `CastError` used to leave the request
  hanging with no response, which the app read as "offline" and re-queued
  forever.
- `require('express-async-errors')` is loaded first in `src/app.js`. Express 4
  does **not** catch a rejected async handler by itself; without it a thrown
  error inside `async (req, res)` means the client waits until it times out.

## Feedback the user sees

- success → `toast.success(t('toast.…'))`, never a modal
- destructive → toast with **undo**; keep the deleted payload so undo can
  restore it (see `deleteItem` returning its restorable record)
- queued → the write already reported success optimistically; the pending
  banner shows the count, so do not also show an error
- a blocking `Alert` is only justified for a genuine confirmation that cannot
  be undone

## Checklist before calling it done

- [ ] optimistic update applied before the request
- [ ] revert guarded by `if (!err.queued)`
- [ ] `temp-` ids filtered out of anything sent
- [ ] server validates ids and answers 400 rather than throwing
- [ ] toast on success, undo on delete
- [ ] tested with the phone in airplane mode: the change stays, the banner
      counts it, and it lands after reconnecting
