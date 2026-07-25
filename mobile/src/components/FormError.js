import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Inline validation/error message shown next to the field it belongs to.
// Modals are reserved for destructive confirmations — a field-level problem
// should never interrupt the user with a popup they have to dismiss before
// they can even see the field again.
export default function FormError({ message, style }) {
  const { theme } = useTheme();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: message ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [message, fade]);

  if (!message) return null;

  return (
    <Animated.View
      style={[
        styles.wrap,
        { backgroundColor: hexToRgba(theme.danger, 0.12), borderColor: hexToRgba(theme.danger, 0.35), opacity: fade },
        style,
      ]}
      accessibilityLiveRegion="polite"
    >
      <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
      <Text style={[styles.text, { color: theme.danger }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  text: { flex: 1, fontSize: 13, fontWeight: '500' },
});
