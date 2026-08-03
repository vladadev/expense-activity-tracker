import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../i18n/translations';
import { useAuth } from './AuthContext';

const LANGUAGE_KEY_PREFIX = 'app_language_';
const CURRENCY_KEY_PREFIX = 'app_currency_';
const HIDE_AMOUNTS_KEY_PREFIX = 'app_hide_amounts_';

const DEFAULT_LANGUAGE = 'sr';
const DEFAULT_CURRENCY = 'RSD';

const CURRENCY_SYMBOLS = { RSD: 'RSD', EUR: '€', USD: '$' };

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);
  const [currency, setCurrencyState] = useState(DEFAULT_CURRENCY);
  // "Privacy mode": blurs every displayed amount so the app can be shown to
  // other people without revealing the household's finances. Deliberately
  // sticky across restarts — if you turned it on to show someone the app, it
  // must still be on the next time you hand them the phone.
  const [hideAmounts, setHideAmountsState] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Keyed by account, not just device — see ThemeContext for why (two
  // people can share a physical phone during testing/use).
  const languageKey = user ? `${LANGUAGE_KEY_PREFIX}${user.id}` : null;
  const currencyKey = user ? `${CURRENCY_KEY_PREFIX}${user.id}` : null;
  const hideAmountsKey = user ? `${HIDE_AMOUNTS_KEY_PREFIX}${user.id}` : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!languageKey || !currencyKey || !hideAmountsKey) {
        setLanguageState(DEFAULT_LANGUAGE);
        setCurrencyState(DEFAULT_CURRENCY);
        setHideAmountsState(false);
        setLoaded(true);
        return;
      }
      const [storedLanguage, storedCurrency, storedHideAmounts] = await Promise.all([
        AsyncStorage.getItem(languageKey),
        AsyncStorage.getItem(currencyKey),
        AsyncStorage.getItem(hideAmountsKey),
      ]);
      if (!cancelled) {
        setLanguageState(storedLanguage || DEFAULT_LANGUAGE);
        setCurrencyState(storedCurrency || DEFAULT_CURRENCY);
        setHideAmountsState(storedHideAmounts === '1');
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [languageKey, currencyKey, hideAmountsKey]);

  const setLanguage = useCallback(
    async (lang) => {
      setLanguageState(lang);
      if (languageKey) await AsyncStorage.setItem(languageKey, lang);
    },
    [languageKey]
  );

  const setCurrency = useCallback(
    async (curr) => {
      setCurrencyState(curr);
      if (currencyKey) await AsyncStorage.setItem(currencyKey, curr);
    },
    [currencyKey]
  );

  // State flips first so the tap feels instant; the write is fire-and-forget
  // because a failed write only costs the setting on the next launch.
  const toggleHideAmounts = useCallback(() => {
    setHideAmountsState((prev) => {
      const next = !prev;
      if (hideAmountsKey) AsyncStorage.setItem(hideAmountsKey, next ? '1' : '0');
      return next;
    });
  }, [hideAmountsKey]);

  const t = useCallback(
    (key, params) => {
      let str = translations[language]?.[key] ?? translations[DEFAULT_LANGUAGE][key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          str = str.replace(`{${k}}`, v);
        }
      }
      return str;
    },
    [language]
  );

  const formatAmount = useCallback((amount, currencyCode) => {
    const code = currencyCode || DEFAULT_CURRENCY;
    const symbol = CURRENCY_SYMBOLS[code] || code;
    const formatted = Number(amount).toLocaleString(undefined, {
      minimumFractionDigits: code === 'RSD' ? 0 : 2,
      maximumFractionDigits: code === 'RSD' ? 0 : 2,
    });
    return code === 'RSD' ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
  }, []);

  if (!loaded) return null;

  return (
    <SettingsContext.Provider
      value={{ language, setLanguage, currency, setCurrency, t, formatAmount, hideAmounts, toggleHideAmounts }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
