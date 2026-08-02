import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { initErrorReporting } from './src/utils/errorReporting';

// Started before the tree renders so a crash during startup is still caught.
// No-ops safely when the DSN is unset or the native module isn't in this build.
initErrorReporting(Constants.expoConfig?.extra?.sentryDsn);

function ThemedStatusBar() {
  const { theme } = useTheme();
  return <StatusBar style={theme.statusBarStyle} />;
}

export default function App() {
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
