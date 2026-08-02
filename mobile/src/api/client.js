import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/env';
import { reportError } from '../utils/errorReporting';

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
    return Promise.reject(error);
  }
);

export default client;
