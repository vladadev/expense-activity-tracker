import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import DuoLoader from './duo/DuoLoader';

// "Nothing here yet" and "I could not find out" are different sentences, and
// showing the first when the second is true is the app telling the user their
// records are gone. This is the second sentence.
export default function LoadFailed({ onRetry }) {
  const { t } = useSettings();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [trying, setTrying] = useState(false);

  async function retry() {
    if (trying || !onRetry) return;
    setTrying(true);
    const started = Date.now();
    try {
      await onRetry();
    } finally {
      setTimeout(() => setTrying(false), Math.max(0, 900 - (Date.now() - started)));
    }
  }

  return (
    <View style={styles.wrap}>
      <Ionicons name="cloud-offline-outline" size={30} color={theme.textSecondary} />
      <Text style={styles.title}>{t('offline.cannotLoad')}</Text>
      <Text style={styles.body}>{t('offline.cannotLoadBody')}</Text>
      {onRetry ? (
        <TouchableOpacity style={styles.button} onPress={retry} disabled={trying} activeOpacity={0.8}>
          {trying ? <DuoLoader size={18} /> : <Text style={styles.buttonText}>{t('offline.retry')}</Text>}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    wrap: { alignItems: 'center', paddingVertical: 44, paddingHorizontal: 32, gap: 10 },
    title: { fontSize: 15, fontWeight: '700', color: theme.text, marginTop: 4 },
    body: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 19 },
    button: {
      marginTop: 8,
      minHeight: 42,
      minWidth: 120,
      paddingHorizontal: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: { fontSize: 14, fontWeight: '700', color: theme.primary },
  });
}
