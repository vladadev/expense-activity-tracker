import AsyncStorage from '@react-native-async-storage/async-storage';
import client from './client';

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

function keyFor(url, params) {
  const suffix = params ? JSON.stringify(params) : '';
  return `${PREFIX}${url}${suffix}`;
}

export async function cachedGet(url, config) {
  const key = keyFor(url, config?.params);
  try {
    const res = await client.get(url, config);
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
      return { data: cached.data, stale: true, at: cached.at };
    } catch (parseErr) {
      throw err;
    }
  }
}

// Two people share a phone during testing, and one account's data must never
// surface under the other's. Clearing on logout is the simplest guarantee.
export async function clearOfflineCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch (err) {
    // Nothing to do about it, and it must not block signing out.
  }
}
