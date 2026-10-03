import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { setStatusBarStyle } from 'expo-status-bar';
import { useTheme } from '../../context/ThemeContext';

// What it takes to put anything on top of the water.
//
// The pond is dark in both themes — the day sky is deep green, the night sky
// is nearly black — so ink over it does not come from the palette. It is this
// one colour in both, which is also the Pond background, so a title over the
// water and the page under it are made of the same stuff.

export const ON_WATER = '#F4F2EC';
// A second line under a title: present, but not competing with it.
export const ON_WATER_DIM = 'rgba(244,242,236,0.78)';

// The app sets the status bar from the theme, which is right everywhere except
// here: on a screen with water behind the top, `pondLight` asks for dark icons
// and puts them on the darkest thing in the app.
//
// Tied to focus, and restoring the theme's own style on the way out. Rendering
// another <StatusBar style="light" /> instead would be shorter and wrong —
// expo-status-bar applies a style and does not put the previous one back, so
// leaving this screen would leave light icons on the light screen after it.
// `enabled` is a flag rather than a reason not to call this: the shared header
// decides whether it has water behind it from its props, and a hook that is
// sometimes called and sometimes not is the one rule React does not bend.
export function useStatusBarOnWater(enabled = true) {
  const { theme } = useTheme();
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      setStatusBarStyle('light');
      return () => setStatusBarStyle(theme.statusBarStyle);
    }, [enabled, theme.statusBarStyle])
  );
}
