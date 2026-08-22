import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { useOfflineQueue } from '../context/OfflineQueueContext';

// Visible only while something is waiting to be sent. Standing state rather
// than a message: the user should be able to look at any moment and know
// whether their changes are safely away, without having caught a toast.
export default function PendingBanner() {
  const { t } = useSettings();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { count, flush } = useOfflineQueue();

  if (count === 0) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <TouchableOpacity style={styles.banner} onPress={flush} activeOpacity={0.8}>
        <Ionicons name="cloud-offline-outline" size={17} color={theme.textSecondary} />
        <Text style={styles.text} numberOfLines={1}>
          {t('offline.pending', { count })}
        </Text>
        <Text style={styles.action}>{t('offline.retry')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    // Above the tab bar and below the toast, so the two never collide.
    wrap: { position: 'absolute', bottom: 140, left: 12, right: 12, alignItems: 'center' },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      width: '100%',
      maxWidth: 520,
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 10,
      paddingHorizontal: 13,
    },
    text: { flex: 1, fontSize: 13, color: theme.textSecondary },
    action: { fontSize: 13, fontWeight: '700', color: theme.primary },
  });
}
