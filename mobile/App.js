import React, { useState } from 'react';
import Constants from 'expo-constants';
import { useFonts, Outfit_300Light, Outfit_500Medium } from '@expo-google-fonts/outfit';
import { StatusBar } from 'expo-status-bar';
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
  // The splash plays once per launch and hands over when it finishes. It waits
  // on the font too: swapping the name's typeface mid-animation would be the
  // one visible seam in the whole sequence.
  const [fontsLoaded] = useFonts({ Outfit_300Light, Outfit_500Medium });
  const [introDone, setIntroDone] = useState(false);

  if (!introDone) {
    return (
      <SafeAreaProvider>
        {/* No ThemeProvider here: it reads the logged-in account to pick a
            palette, and the splash has its own fixed colours anyway. */}
        <DuoSplash
          loop={false}
          onFinish={() => setIntroDone(true)}
          fontFamily={fontsLoaded ? 'Outfit_500Medium' : undefined}
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
