import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PALETTES, DEFAULT_THEME } from '../theme/palettes';
import { useAuth } from './AuthContext';

const THEME_KEY_PREFIX = 'app_theme_';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [themeName, setThemeNameState] = useState(DEFAULT_THEME);
  const [loaded, setLoaded] = useState(false);

  // Keyed by account, not just device — two people can be logged in on the
  // same physical phone (e.g. during testing) and must not see each other's
  // theme choice bleed through.
  const storageKey = user ? `${THEME_KEY_PREFIX}${user.id}` : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!storageKey) {
        setThemeNameState(DEFAULT_THEME);
        setLoaded(true);
        return;
      }
      const stored = await AsyncStorage.getItem(storageKey);
      if (!cancelled) {
        setThemeNameState(stored && PALETTES[stored] ? stored : DEFAULT_THEME);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const setThemeName = useCallback(
    async (name) => {
      if (!PALETTES[name]) return;
      setThemeNameState(name);
      if (storageKey) await AsyncStorage.setItem(storageKey, name);
    },
    [storageKey]
  );

  if (!loaded) return null;

  const theme = PALETTES[themeName];

  return (
    <ThemeContext.Provider value={{ theme, themeName, setThemeName, availableThemes: PALETTES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
