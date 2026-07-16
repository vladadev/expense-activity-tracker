import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Keyboard, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import NotificationBell from './NotificationBell';

// Replaces React Navigation's native stack header everywhere in the app.
// The native header wasn't reserving space for the status bar correctly on
// this device/Android setup (overlapping content on every pushed screen,
// not just stack roots) — this JS-rendered header lives inside the same
// SafeAreaView we already confirmed works, so it can't have that problem.
//
// Keyboard handling on Android is done by hand (padding driven off the real
// keyboardDidShow/Hide event height) instead of KeyboardAvoidingView or the
// native windowSoftInputMode=resize setting. Expo SDK 54 enforces edge-to-edge
// on Android, which breaks both of those mechanisms — the root view no longer
// actually resizes when the keyboard opens, so nothing to "avoid" into exists.
function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return height;
}

export default function Screen({ title, children, showBack, showBell = true }) {
  const { theme } = useTheme();
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
  title: { fontSize: 18, fontWeight: '700', flex: 1 },
});
