import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// Replaces React Navigation's native stack header everywhere in the app.
// The native header wasn't reserving space for the status bar correctly on
// this device/Android setup (overlapping content on every pushed screen,
// not just stack roots) — this JS-rendered header lives inside the same
// SafeAreaView we already confirmed works, so it can't have that problem.
export default function Screen({ title, children, showBack }) {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const displayBack = showBack !== undefined ? showBack : navigation.canGoBack();

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
        </View>
      )}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {children}
      </KeyboardAvoidingView>
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
