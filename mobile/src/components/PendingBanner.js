import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { useOfflineQueue } from '../context/OfflineQueueContext';
import useKeyboardHeight from '../utils/useKeyboardHeight';
import { useToast } from './Toast';
import DuoLoader from './duo/DuoLoader';

// Visible only while something is waiting to be sent. Standing state rather
// than a message: the user should be able to look at any moment and know
// whether their changes are safely away, without having caught a toast.
// How long the retry spinner stays up regardless of how fast the attempt was.
const MIN_SPIN_MS = 1100;
// Distance the banner rises by when a toast is sharing the bottom of the screen.
const TOAST_CLEARANCE = 62;

export default function PendingBanner() {
  const { t } = useSettings();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { count, flush, discardAll } = useOfflineQueue();
  const keyboardHeight = useKeyboardHeight();
  const { visible: toastVisible } = useToast();
  const [trying, setTrying] = useState(false);
  // Animated rather than jumped: the banner slides down into the space the
  // toast leaves instead of teleporting.
  const lift = useRef(new Animated.Value(toastVisible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(lift, {
      toValue: toastVisible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [toastVisible, lift]);

  if (count === 0) return null;

  // The button did nothing visible before: a retry that fails silently is
  // indistinguishable from one that was never registered.
  async function retry() {
    if (trying) return;
    setTrying(true);
    // Held for a moment even when the attempt returns instantly. A spinner
    // that flashes for 40ms reads as nothing having happened, which is the
    // opposite of what pressing the button is meant to communicate.
    const started = Date.now();
    try {
      await flush();
    } finally {
      const elapsed = Date.now() - started;
      setTimeout(() => setTrying(false), Math.max(0, MIN_SPIN_MS - elapsed));
    }
  }

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          bottom: 78 + keyboardHeight,
          transform: [
            { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -TOAST_CLEARANCE] }) },
          ],
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.banner}>
        <Ionicons name="cloud-offline-outline" size={17} color={theme.textSecondary} />
        <Text style={styles.text} numberOfLines={1}>
          {t('offline.pending', { count })}
        </Text>
        <TouchableOpacity onPress={retry} disabled={trying} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
          {trying ? <DuoLoader size={16} /> : <Text style={styles.action}>{t('offline.retry')}</Text>}
        </TouchableOpacity>
        {/* Long press discards, so a write that can never succeed is not a
            banner the user is stuck with. */}
        <TouchableOpacity
          onLongPress={discardAll}
          delayLongPress={600}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    // Above the tab bar and below the toast, so the two never collide.
    wrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
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
