import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import NotificationBell from './NotificationBell';
import useKeyboardHeight from '../utils/useKeyboardHeight';

// Replaces React Navigation's native stack header everywhere in the app.
// The native header wasn't reserving space for the status bar correctly on
// this device/Android setup (overlapping content on every pushed screen,
// not just stack roots) — this JS-rendered header lives inside the same
// SafeAreaView we already confirmed works, so it can't have that problem.
//
// Keyboard handling on Android is done by hand — see useKeyboardHeight for why
// KeyboardAvoidingView and windowSoftInputMode=resize both stopped working.

// showPrivacyToggle is opt-in: the eye only belongs on screens that actually
// display amounts, otherwise it is a control that appears to do nothing.
export default function Screen({ title, children, showBack, showBell = true, showPrivacyToggle = false }) {
  const { theme } = useTheme();
  const { t, hideAmounts, toggleHideAmounts } = useSettings();
  const navigation = useNavigation();
  const displayBack = showBack !== undefined ? showBack : navigation.canGoBack();
  const keyboardHeight = useKeyboardHeight();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      {title != null && (
        <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
          {displayBack && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </TouchableOpacity>
          )}
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
          {showPrivacyToggle && (
            <TouchableOpacity
              onPress={toggleHideAmounts}
              style={styles.privacyButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={hideAmounts ? t('common.showAmounts') : t('common.hideAmounts')}
            >
              <Ionicons
                name={hideAmounts ? 'eye-off' : 'eye-outline'}
                size={22}
                color={hideAmounts ? theme.primary : theme.textSecondary}
              />
            </TouchableOpacity>
          )}
          {showBell && <NotificationBell />}
        </View>
      )}
      <View style={{ flex: 1, paddingBottom: keyboardHeight }}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: { marginRight: 4, padding: 4 },
  privacyButton: { padding: 4, marginRight: 4 },
  title: { fontSize: 18, fontWeight: '700', flex: 1 },
});
