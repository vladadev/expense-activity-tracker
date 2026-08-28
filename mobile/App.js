import React, { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { useFonts, Outfit_300Light, Outfit_500Medium } from '@expo-google-fonts/outfit';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { initErrorReporting, reportError } from './src/utils/errorReporting';
import DuoSplash from './src/components/duo/DuoSplash';

// Started before the tree renders so a crash during startup is still caught.
// No-ops safely when the DSN is unset or the native module isn't in this build.
initErrorReporting(Constants.expoConfig?.extra?.sentryDsn);

// How long the splash will wait for its typeface before going ahead without
// it. Long enough for a normal load, short enough that nobody stares at a
// blank screen wondering whether the app is broken.
const FONT_DEADLINE_MS = 2500;

// And a ceiling on the intro itself. The animation reports its own completion,
// but nothing that stands between the user and their app should depend on a
// callback firing — if it ever does not, this hands over anyway.
const INTRO_DEADLINE_MS = 6000;

function ThemedStatusBar() {
  const { theme } = useTheme();
  return <StatusBar style={theme.statusBarStyle} />;
}

export default function App() {
  // The splash plays once per launch and hands over when it finishes.
  const [fontsLoaded, fontError] = useFonts({ Outfit_300Light, Outfit_500Medium });
  const [introDone, setIntroDone] = useState(false);
  const [waitedForFont, setWaitedForFont] = useState(false);

  // Waiting for the font avoids a visible seam: without it the name renders in
  // the system face, then re-measures and jumps when the real one arrives.
  //
  // But waiting must have an end. This gate previously had neither an error
  // path nor a deadline, so a font that never resolved left the app sitting on
  // a blank navy screen with no way forward — a hang, which is worse than the
  // seam it was avoiding and worse than a crash, since nothing is even
  // reported. A missing typeface is a cosmetic problem; it must never be able
  // to hold the whole app.
  useEffect(() => {
    const fontTimer = setTimeout(() => setWaitedForFont(true), FONT_DEADLINE_MS);
    const introTimer = setTimeout(() => setIntroDone(true), INTRO_DEADLINE_MS);
    return () => {
      clearTimeout(fontTimer);
      clearTimeout(introTimer);
    };
  }, []);

  const fontSettled = fontsLoaded || !!fontError || waitedForFont;

  // Worth knowing about: the app still works, but the splash is not what it
  // was designed to be, and silence would hide that indefinitely.
  useEffect(() => {
    if (fontError) reportError(fontError, { stage: 'font-load' });
  }, [fontError]);

  if (!introDone && !fontSettled) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: '#0C447C' }} />
        <StatusBar style="light" />
      </SafeAreaProvider>
    );
  }

  if (!introDone) {
    return (
      <SafeAreaProvider>
        {/* No ThemeProvider here: it reads the logged-in account to pick a
            palette, and the splash has its own fixed colours anyway. */}
        {/* The tagline is English copy in a Serbian app, so it stays off
            until it has been written and translated. */}
        <DuoSplash
          loop={false}
          showTagline={false}
          onFinish={() => setIntroDone(true)}
          fontFamily={fontsLoaded ? 'Outfit_500Medium' : undefined}
        />
        <StatusBar style="light" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      {/* The outer boundary catches what the per-tab ones cannot: a provider
          or the navigator itself throwing. Without it such an error unmounts
          everything and the app vanishes off the screen. */}
      <ErrorBoundary name="app">
        {/* AuthProvider must wrap Theme/Settings — both personalize their
            storage per logged-in account, so they need to know who's logged in. */}
        <AuthProvider>
          <ThemeProvider>
            <SettingsProvider>
              <RootNavigator />
              <ThemedStatusBar />
            </SettingsProvider>
          </ThemeProvider>
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
