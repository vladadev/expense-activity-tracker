import AsyncStorage from '@react-native-async-storage/async-storage';
import client from './client';
import { getActiveHouseholdId } from './activeHousehold';
import { readMemory, writeMemory, dropMemory, FRESH_MS } from './memoryCache';

// A GET that remembers its last good answer.
//
// The offline queue keeps writes safe, but reading was still all-or-nothing:
// with no connection a screen had nothing to show and rendered empty, which
// looks broken rather than offline. Every response that arrives is kept, and
// when a request cannot reach the server the last one is served instead,
// flagged as stale so the screen can say how old it is.
//
// Only a request that gets NO response falls back. A 401 or a 404 is the
// server answering, and answering an error with old data would be a lie.

const PREFIX = 'cache_v1:';

// The household is part of the key. Without it, switching from one household
// to another would serve the previous one's figures from the cache until the
// network answered — the same URL, a different household, the same key.
function keyFor(url, params) {
  const suffix = params ? JSON.stringify(params) : '';
  const household = getActiveHouseholdId() || 'none';
  return `${PREFIX}${household}:${url}${suffix}`;
}

// What we already know, right now, without waiting for anything. A screen can
// render its first frame from this instead of a skeleton.
export function peekCache(url, params) {
  const hit = readMemory(keyFor(url, params));
  return hit ? hit.data : null;
}

export async function cachedGet(url, config) {
  const key = keyFor(url, config?.params);

  // Young enough to answer with. No request, no skeleton, no wait. Writes
  // clear this cache wholesale, so the only thing this can be behind is a
  // change made on somebody else's phone in the last few seconds.
  const hit = readMemory(key);
  if (hit && Date.now() - hit.at < FRESH_MS) {
    return { data: hit.data, stale: false, at: hit.at, fromMemory: true };
  }

  try {
    const res = await client.get(url, config);
    writeMemory(key, res.data);
    // Written without awaiting: a slow disk must not delay the screen, and a
    // failed write only costs this one entry.
    AsyncStorage.setItem(key, JSON.stringify({ at: Date.now(), data: res.data })).catch(() => {});
    return { data: res.data, stale: false, at: Date.now() };
  } catch (err) {
    if (err.response) throw err;
    const raw = await AsyncStorage.getItem(key).catch(() => null);
    if (!raw) throw err;
    try {
      const cached = JSON.parse(raw);
      writeMemory(key, cached.data);
      return { data: cached.data, stale: true, at: cached.at };
    } catch (parseErr) {
      throw err;
    }
  }
}

// Two people share a phone during testing, and one account's data must never
// surface under the other's. Clearing on logout is the simplest guarantee.
export async function clearOfflineCache() {
  // Memory first, and outside the try: the disk sweep can fail, and leaving
  // one account's figures in memory for the next person to sign in is the one
  // outcome that must not be possible.
  dropMemory();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch (err) {
    // Nothing to do about it, and it must not block signing out.
  }
}
