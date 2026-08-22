import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/env';
import { reportError } from '../utils/errorReporting';
import { offerToQueue } from './offlineHooks';

export const TOKEN_KEY = 'auth_token';

const client = axios.create({ baseURL: API_BASE_URL });

client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Screens catch their own load failures and log them to the console — which
// on a phone goes nowhere. Reporting centrally here covers every request in
// the app without touching each screen, and keeps the noise out of Sentry:
//
//   skipped: no connection, timeouts, 401 (expired session), 4xx (validation)
//   sent:    5xx server faults and anything genuinely unexpected
client.interceptors.response.use(
  (response) => response,
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
