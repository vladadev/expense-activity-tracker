import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, Vibration, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// Every action the user takes gets an answer.
//
// Until now the app only ever spoke up to block: an Alert for errors, silence
// for everything else. So a folder that saved correctly and a folder that
// failed to save looked identical for the half second in between, and after
// that the only difference was whether a modal appeared. That silence is what
// makes an app feel cheap, far more than the milliseconds do.
//
// A toast is non-blocking on purpose: success needs acknowledging, not
// confirming, and an error the user can retry should not stop them mid-flow.
// Destructive actions carry an Undo, which is both kinder and faster than a
// confirmation dialog — it costs nothing when you meant it.

const ToastContext = createContext(null);

const DURATION = { success: 2200, error: 4000, undo: 5000 };

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const anim = useRef(new Animated.Value(0)).current;
  const countdown = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef(null);

  const dismiss = useCallback(() => {
    clearTimeout(hideTimer.current);
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setToast(null);
    });
  }, [anim]);

  const show = useCallback(
    (next) => {
      clearTimeout(hideTimer.current);
      setToast(next);
      // A short buzz on failure only. Confirming every success by vibration
      // turns into noise; a failure genuinely wants attention.
      if (next.kind === 'error' && Platform.OS === 'android') Vibration.vibrate(18);
      const life = DURATION[next.kind] || DURATION.success;
      anim.setValue(0);
      countdown.setValue(1);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 9, tension: 70 }).start();
      Animated.timing(countdown, {
        toValue: 0,
        duration: life,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
      hideTimer.current = setTimeout(dismiss, life);
    },
    [anim, countdown, dismiss]
  );

  const api = useMemo(
    () => ({
      success: (message) => show({ kind: 'success', message }),
      error: (message, onRetry) => show({ kind: 'error', message, actionLabel: 'retry', onAction: onRetry }),
      // `onUndo` runs if the user taps; nothing happens otherwise.
      undo: (message, onUndo) => show({ kind: 'undo', message, actionLabel: 'undo', onAction: onUndo }),
      dismiss,
    }),
    [show, dismiss]
  );

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastView toast={toast} anim={anim} countdown={countdown} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const LABELS = {
  retry: { en: 'Retry', sr: 'Pokušaj' },
  undo: { en: 'Undo', sr: 'Vrati' },
};

function ToastView({ toast, anim, countdown, onDismiss }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  if (!toast) return null;

  const tone =
    toast.kind === 'error' ? theme.danger : toast.kind === 'undo' ? theme.textSecondary : theme.success;
  const icon =
    toast.kind === 'error' ? 'alert-circle' : toast.kind === 'undo' ? 'trash-outline' : 'checkmark-circle';

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
        },
      ]}
    >
      <View style={[styles.toast, { borderLeftColor: tone }]}>
        <Ionicons name={icon} size={18} color={tone} />
        <Text style={styles.message} numberOfLines={2}>
          {toast.message}
        </Text>
        {toast.onAction ? (
          <TouchableOpacity
            onPress={() => {
              onDismiss();
              toast.onAction();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.action, { color: theme.primary }]}>
              {LABELS[toast.actionLabel]?.sr || ''}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.trackWrap} pointerEvents="none">
        <Animated.View
          style={[
            styles.track,
            { backgroundColor: tone, transform: [{ scaleX: countdown }] },
          ]}
        />
      </View>
    </Animated.View>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

function createStyles(theme) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      // Clear of the tab bar, so it never covers the thing you just tapped.
      bottom: 78,
      left: 12,
      right: 12,
      alignItems: 'center',
    },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      maxWidth: 520,
      width: '100%',
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderLeftWidth: 4,
      paddingVertical: 13,
      paddingHorizontal: 14,
      elevation: 6,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    message: { flex: 1, fontSize: 14, color: theme.text },
    trackWrap: {
      width: '100%',
      maxWidth: 520,
      height: 3,
      marginTop: -3,
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
      overflow: 'hidden',
    },
    // scaleX scales about the centre by default, which would make the bar
    // close in on itself instead of draining. RN 0.76+ supports transformOrigin.
    track: { width: '100%', height: 3, opacity: 0.55, transformOrigin: 'left' },
    action: { fontSize: 14, fontWeight: '700' },
  });
}
