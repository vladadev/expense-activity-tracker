import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../src/api/client';
import { cachedGet, clearOfflineCache } from '../src/api/cachedGet';

jest.mock('../src/api/client', () => ({ get: jest.fn() }));

// The rule that matters here: a request with NO response falls back to the
// last good copy, but a request the server answered — 401, 404, 500 — must
// throw. Serving old data in answer to an error is how "no expenses yet"
// appeared on a screen that simply could not read.
function noResponse(message = 'Network Error') {
  return Object.assign(new Error(message), { response: undefined });
}
function serverError(status) {
  return Object.assign(new Error(`Request failed with status ${status}`), {
    response: { status, data: {} },
  });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  client.get.mockReset();
});

describe('cachedGet', () => {
  it('returns fresh data and marks it not stale', async () => {
    client.get.mockResolvedValue({ data: { total: 10 } });
    const res = await cachedGet('/stats/2026-08-24');
    expect(res.data).toEqual({ total: 10 });
    expect(res.stale).toBe(false);
  });

  it('serves the last good copy when there is no response, flagged stale', async () => {
    client.get.mockResolvedValueOnce({ data: { total: 10 } });
    await cachedGet('/stats/2026-08-24');

    client.get.mockRejectedValueOnce(noResponse());
    const res = await cachedGet('/stats/2026-08-24');
    expect(res.data).toEqual({ total: 10 });
    expect(res.stale).toBe(true);
    expect(typeof res.at).toBe('number');
  });

  it('rethrows when the server answered with an error', async () => {
    client.get.mockResolvedValueOnce({ data: { total: 10 } });
    await cachedGet('/stats/2026-08-24');

    client.get.mockRejectedValueOnce(serverError(404));
    await expect(cachedGet('/stats/2026-08-24')).rejects.toMatchObject({
      response: { status: 404 },
    });
  });

  it('rethrows when offline with nothing cached', async () => {
    client.get.mockRejectedValueOnce(noResponse());
    await expect(cachedGet('/stats/never-read')).rejects.toThrow('Network Error');
  });

  // Statistics reads the same path for different months. One shared entry
  // would show August's numbers under September.
  it('caches different params separately', async () => {
    client.get.mockResolvedValueOnce({ data: { month: 8 } });
    await cachedGet('/expenses', { params: { month: '2026-08' } });
    client.get.mockResolvedValueOnce({ data: { month: 9 } });
    await cachedGet('/expenses', { params: { month: '2026-09' } });

    client.get.mockRejectedValue(noResponse());
    const aug = await cachedGet('/expenses', { params: { month: '2026-08' } });
    const sep = await cachedGet('/expenses', { params: { month: '2026-09' } });
    expect(aug.data).toEqual({ month: 8 });
    expect(sep.data).toEqual({ month: 9 });
  });

  it('overwrites the cached copy on every success', async () => {
    client.get.mockResolvedValueOnce({ data: { total: 10 } });
    await cachedGet('/stats/2026-08-24');
    client.get.mockResolvedValueOnce({ data: { total: 20 } });
    await cachedGet('/stats/2026-08-24');

    client.get.mockRejectedValueOnce(noResponse());
    const res = await cachedGet('/stats/2026-08-24');
    expect(res.data).toEqual({ total: 20 });
  });

  it('survives a corrupted cache entry by rethrowing', async () => {
    await AsyncStorage.setItem('cache_v1:/stats/broken', 'not json');
    client.get.mockRejectedValueOnce(noResponse());
    await expect(cachedGet('/stats/broken')).rejects.toThrow('Network Error');
  });
});

describe('clearOfflineCache', () => {
  it('removes cached reads but leaves other keys alone', async () => {
    client.get.mockResolvedValue({ data: { total: 10 } });
    await cachedGet('/stats/2026-08-24');
    await AsyncStorage.setItem('settings_language', 'sr');

    await clearOfflineCache();

    client.get.mockRejectedValueOnce(noResponse());
    await expect(cachedGet('/stats/2026-08-24')).rejects.toThrow('Network Error');
    expect(await AsyncStorage.getItem('settings_language')).toBe('sr');
  });
});
