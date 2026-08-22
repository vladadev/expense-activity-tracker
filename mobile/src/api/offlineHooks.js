// Bridge between the axios client and the offline queue.
//
// The client cannot import the queue's context directly — the context imports
// the client — so the provider registers itself here at mount and the
// interceptor reaches it through this one indirection.

let handler = null;

export function setOfflineHandler(fn) {
  handler = fn;
}

// Returns true when the write was taken over by the queue.
export function offerToQueue(config) {
  if (!handler) return false;
  try {
    return handler(config) === true;
  } catch (err) {
    return false;
  }
}
