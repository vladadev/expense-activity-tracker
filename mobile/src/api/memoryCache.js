// What the app already knows, for as long as the app is open.
//
// The disk cache underneath this one exists so a screen has something to show
// with no connection. It was never a speed cache: every read went to the
// network first and the disk copy was only ever reached for when the request
// failed. So walking around the app — Money, Analysis, back to Money — paid a
// full round trip each time for figures that had not changed in ten seconds,
// and every one of those trips showed a skeleton on the way.
//
// This holds the last answer in memory and hands it straight back while it is
// young. Nothing here survives the app closing; it is not storage, it is the
// difference between "I already know this" and "let me go and ask".

const mem = new Map();

// How long an answer counts as current. Short enough that a figure changed on
// the other phone shows up on the next screen you open, long enough that
// moving around the app costs nothing. Any write clears the whole cache
// anyway, so this only governs changes made somewhere else.
export const FRESH_MS = 45000;

export function readMemory(key) {
  return mem.get(key) || null;
}

export function writeMemory(key, data) {
  mem.set(key, { at: Date.now(), data });
}

// Anything that changes data on the server makes every answer here suspect —
// a new expense moves a month total, a category rename moves a breakdown — and
// working out which keys a given write touched is the kind of bookkeeping that
// is wrong six months later. Dropping all of it costs one round trip on the
// next screen and cannot be wrong.
export function dropMemory() {
  mem.clear();
}

export function memorySize() {
  return mem.size;
}
