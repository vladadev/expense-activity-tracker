import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Animated, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PALETTES, DEFAULT_THEME } from '../theme/palettes';
import { mixPalette } from '../theme/mix';
import { motion } from '../theme/scale';
import { useAuth } from './AuthContext';

const THEME_KEY_PREFIX = 'app_theme_';

// The two Pond themes are one place at two times of day, so going between them
// is a crossing rather than a choice: the sun leaves, the moon arrives, and
// every colour in the app travels with them. The older themes are different
// places, and switching between those is still a switch.
const DAY = 'pondLight';
const NIGHT = 'pondDark';
const crosses = (a, b) => (a === DAY || a === NIGHT) && (b === DAY || b === NIGHT) && a !== b;

// How finely the blended palette is stepped.
//
// Position is animated natively and runs at the screen's own rate; colour
// cannot be, because every screen's StyleSheet is rebuilt from the palette.
// Rebuilding it 84 times across the crossing is work nobody sees — a colour
// moving in 24 steps over a second and a half is indistinguishable from one
// moving continuously, while 24 re-renders instead of 84 is the difference
// between a crossing and a stutter.
const STEPS = 24;

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [themeName, setThemeNameState] = useState(DEFAULT_THEME);
  const [loaded, setLoaded] = useState(false);
  // How far through the crossing the colours are, quantised. 0 is day.
  const [nightness, setNightness] = useState(PALETTES[DEFAULT_THEME].isDark ? 1 : 0);

  // The same journey, continuous and on the native side, for anything that
  // moves rather than changes colour — the sun leaving, the moon arriving.
  const nightT = useRef(new Animated.Value(PALETTES[DEFAULT_THEME].isDark ? 1 : 0)).current;
  const running = useRef(null);

  // Keyed by account, not just device — two people can be logged in on the
  // same physical phone (e.g. during testing) and must not see each other's
  // theme choice bleed through.
  const storageKey = user ? `${THEME_KEY_PREFIX}${user.id}` : null;

  const settle = useCallback(
    (name) => {
      const dark = PALETTES[name].isDark ? 1 : 0;
      nightT.setValue(dark);
      setNightness(dark);
    },
    [nightT]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!storageKey) {
        setThemeNameState(DEFAULT_THEME);
        settle(DEFAULT_THEME);
        setLoaded(true);
        return;
      }
      const stored = await AsyncStorage.getItem(storageKey);
      if (!cancelled) {
        const name = stored && PALETTES[stored] ? stored : DEFAULT_THEME;
        setThemeNameState(name);
        settle(name);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey, settle]);

  const setThemeName = useCallback(
    async (name) => {
      if (!PALETTES[name]) return;
      const previous = themeName;
      setThemeNameState(name);
      if (storageKey) AsyncStorage.setItem(storageKey, name).catch(() => {});

      if (!crosses(previous, name)) {
        running.current?.stop();
        running.current = null;
        settle(name);
        return;
      }

      // Tapped again mid-crossing: carry on from wherever the sky is now
      // rather than snapping back to start the other way.
      running.current?.stop();
      const to = name === NIGHT ? 1 : 0;
      const animation = Animated.timing(nightT, {
        toValue: to,
        duration: motion.crossing,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      });
      running.current = animation;
      animation.start(({ finished }) => {
        if (finished) {
          running.current = null;
          setNightness(to);
        }
      });
    },
    [themeName, storageKey, nightT, settle]
  );

  // One listener for the whole app. Each component that wants the continuous
  // value reads nightT directly; everything that is a colour comes from here.
  useEffect(() => {
    const id = nightT.addListener(({ value }) => {
      const stepped = Math.round(value * STEPS) / STEPS;
      setNightness((prev) => (prev === stepped ? prev : stepped));
    });
    return () => nightT.removeListener(id);
  }, [nightT]);

  const theme = useMemo(() => {
    const target = PALETTES[themeName];
    // Only the Pond pair has an in-between. Anything else is itself.
    if (themeName !== DAY && themeName !== NIGHT) return target;
    return mixPalette(PALETTES[DAY], PALETTES[NIGHT], nightness);
  }, [themeName, nightness]);

  const value = useMemo(
    () => ({ theme, themeName, setThemeName, availableThemes: PALETTES, nightness, nightT }),
    [theme, themeName, setThemeName, nightness, nightT]
  );

  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
