import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import Screen from '../Screen';
import { space, radius, type } from '../../theme/scale';

// The shape every form in this app takes.
//
// What scrolls, scrolls; the two things you do with a form do not. Save used
// to be the last item in the scroll, which meant that on a form with six
// fields you had to scroll past everything you had just filled in to reach
// the button, and on a form with two it sat marooned in the middle of an empty
// screen. And there was no way out but the back arrow — leaving was a
// navigation gesture rather than an answer to the question the form asked.
//
// The bar is lifted by the keyboard because Screen pads its children by the
// keyboard height; see useKeyboardHeight for why that is done by hand here.
export default function FormScreen({
  title,
  children,
  onSave,
  saveLabel,
  savingLabel,
  submitting = false,
  disabled = false,
  onCancel,
  showCancel = true,
  contentStyle,
}) {
  const { theme } = useTheme();
  const { t } = useSettings();
  const navigation = useNavigation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const blocked = submitting || disabled;

  return (
    <Screen title={title}>
      <ScrollView
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {children}
      </ScrollView>

      <View style={styles.bar}>
        {showCancel && (
          <Pressable
            onPress={onCancel || (() => navigation.goBack())}
            style={styles.cancel}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
        )}
        <Pressable
          onPress={onSave}
          disabled={blocked}
          style={[styles.save, blocked && styles.saveBlocked]}
          accessibilityRole="button"
          accessibilityState={{ disabled: blocked, busy: submitting }}
        >
          <Text style={styles.saveText}>{submitting ? savingLabel || saveLabel : saveLabel}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    content: { padding: space.md, paddingBottom: space.lg },
    bar: {
      flexDirection: 'row',
      gap: space.sm + 2,
      paddingHorizontal: space.md,
      paddingTop: space.sm + 4,
      paddingBottom: space.lg - 2,
      backgroundColor: theme.background,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    cancel: {
      width: 110,
      height: 54,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.card,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    cancelText: { ...type.section, color: theme.text },
    save: {
      flex: 1,
      height: 54,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.card,
      backgroundColor: theme.primary,
    },
    // Dimmed, not hidden: a button that disappears while it works leaves the
    // thumb pressing the place it used to be.
    saveBlocked: { opacity: 0.55 },
    saveText: { ...type.section, fontSize: 16, color: '#fff' },
  });
}
