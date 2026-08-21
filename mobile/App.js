import React, { useState } from 'react';
import Constants from 'expo-constants';
import { useFonts, Outfit_300Light, Outfit_500Medium } from '@expo-google-fonts/outfit';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { initErrorReporting } from './src/utils/errorReporting';
import DuoSplash from './src/components/duo/DuoSplash';

// Started before the tree renders so a crash during startup is still caught.
// No-ops safely when the DSN is unset or the native module isn't in this build.
initErrorReporting(Constants.expoConfig?.extra?.sentryDsn);

function ThemedStatusBar() {
  const { theme } = useTheme();
  return <StatusBar style={theme.statusBarStyle} />;
}

export default function App() {
  // The splash plays once per launch and hands over when it finishes.
  const [fontsLoaded] = useFonts({ Outfit_300Light, Outfit_500Medium });
  const [introDone, setIntroDone] = useState(false);

  // It must not START until the font is there. Rendering it first and swapping
  // the typeface a few frames in was the seam: the name appeared in the system
  // font, re-measured, and jumped. The fonts are bundled, so this is a frame or
  // two of flat navy — the same colour as the native splash it follows, which
  // makes the handover invisible rather than visible.
  if (!introDone && !fontsLoaded) {
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
          fontFamily="Outfit_500Medium"
        />
        <StatusBar style="light" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
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
    </SafeAreaProvider>
  );
}
