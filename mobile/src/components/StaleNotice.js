import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { formatTime } from '../i18n/dateFormat';

// Shown when a screen is displaying its last good copy rather than live data.
// The time matters more than the fact: "offline" tells you nothing about
// whether the number you are reading is from a minute ago or from Tuesday.
export default function StaleNotice({ at }) {
  const { t } = useSettings();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  if (!at) return null;

  return (
    <View style={styles.wrap}>
      <Ionicons name="cloud-offline-outline" size={13} color={theme.textSecondary} />
      <Text style={styles.text} numberOfLines={1}>
        {t('offline.showingCached', { time: formatTime(new Date(at)) })}
      </Text>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 7,
      backgroundColor: theme.surface,
    },
    text: { flex: 1, fontSize: 12, color: theme.textSecondary },
  });
}
