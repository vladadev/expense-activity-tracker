import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/env';
import { reportError } from '../utils/errorReporting';
import { offerToQueue } from './offlineHooks';
import { getActiveHouseholdId, HOUSEHOLD_HEADER } from './activeHousehold';
import { dropMemory } from './memoryCache';

export const TOKEN_KEY = 'auth_token';

// The token, in memory.
//
// Every single request used to read it off the disk first. AsyncStorage is a
// round trip over the bridge to SQLite, so a screen that makes four calls paid
// for four of them before any of its own work started — for a string that
// changes twice in the life of an install. `undefined` means nobody has looked
// yet; `null` means we looked and there is none.
let memToken;

export function setAuthToken(token) {
  memToken = token || null;
}

export function clearAuthToken() {
  memToken = null;
}

async function authToken() {
  if (memToken === undefined) memToken = await AsyncStorage.getItem(TOKEN_KEY);
  return memToken;
}

const client = axios.create({ baseURL: API_BASE_URL });

client.interceptors.request.use(async (config) => {
  const token = await authToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Which household this request acts in, stamped on now rather than decided
  // by the server later. A write made offline can sit in the queue for days
  // and go out after its author has switched elsewhere; because the header
  // was written here, at the moment they pressed save, it still lands where
  // they meant it to.
  //
  // A queued request already carries its own header and must keep it.
  const household = getActiveHouseholdId();
  if (household && !config.headers[HOUSEHOLD_HEADER]) {
    config.headers[HOUSEHOLD_HEADER] = household;
  }
  return config;
});

// Screens catch their own load failures and log them to the console — which
// on a phone goes nowhere. Reporting centrally here covers every request in
// the app without touching each screen, and keeps the noise out of Sentry:
//
//   skipped: no connection, timeouts, 401 (expired session), 4xx (validation)
//   sent:    5xx server faults and anything genuinely unexpected
// Anything that changed data on the server makes every cached answer suspect.
// Working out which entries a given write touched is bookkeeping that goes
// wrong six months later; dropping the lot costs one round trip on the next
// screen and cannot be wrong. Exported because it is the whole rule, and a
// rule worth a comment is worth a test.
export function shouldDropCache(method) {
  const m = (method || '').toLowerCase();
  return m !== '' && m !== 'get' && m !== 'head';
}

client.interceptors.response.use(
  (response) => {
    if (shouldDropCache(response.config?.method)) dropMemory();
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const isServerFault = status >= 500;
    const isUnexpected = !status && error.code !== 'ECONNABORTED' && error.message !== 'Network Error';

    if (isServerFault || isUnexpected) {
      reportError(error, {
        endpoint: `${error.config?.method?.toUpperCase() || '?'} ${error.config?.url || '?'}`,
        status: status ? String(status) : 'no-response',
      });
    }

    // A write that failed because the phone had no connection is not a failed
    // write — it is one that has not happened yet. Handing it to the queue
    // lets the change stay on screen and go out when the connection returns,
    // instead of being rolled back under someone who did nothing wrong.
    //
    // Only writes, and only when there was no response at all: a 4xx means the
    // server saw it and refused, which retrying would not fix.
    const method = (error.config?.method || '').toLowerCase();
    const isWrite = method === 'post' || method === 'put' || method === 'delete';
    const noResponse = !error.response;
    if (isWrite && noResponse && !error.config?.__fromQueue && offerToQueue(error.config)) {
      error.queued = true;
    }
    return Promise.reject(error);
  }
);

export default client;
