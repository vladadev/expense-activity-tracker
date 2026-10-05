import React, { useMemo, useState, forwardRef } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import Field from './Field';
import { space, radius, type, HIT } from '../../theme/scale';

// The ordinary one: a name, a note, a password.
//
// `onClearError` runs on every keystroke, so a message stops sitting under a
// field the moment the person starts fixing it. Every form was doing that by
// hand and one or two had forgotten.
//
// `secure` brings the eye with it. Three screens ask for a password and each
// had built its own reveal toggle, or had not — so the one place you type a
// password twice and cannot check it was the place with no way to look.

const TextField = forwardRef(function TextField(
  { label, hint, error, onChangeText, style, inputStyle, multiline, secure, onClearError, ...rest },
  ref
) {
  const { theme } = useTheme();
  const { t } = useSettings();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [revealed, setRevealed] = useState(false);

  // With an eye on it the border belongs to the wrapper, so the glyph sits
  // inside the field rather than beside it.
  const inputStyles = [
    styles.input,
    multiline && styles.multiline,
    secure ? styles.bare : !!error && styles.inputError,
    inputStyle,
  ];

  const input = (
    <TextInput
      ref={ref}
      style={inputStyles}
      placeholderTextColor={theme.textSecondary}
      multiline={multiline}
      secureTextEntry={secure ? !revealed : undefined}
      onChangeText={(v) => {
        onChangeText?.(v);
        onClearError?.();
      }}
      {...(secure ? { autoCapitalize: 'none', autoCorrect: false } : null)}
      {...rest}
    />
  );

  return (
    <Field label={label} hint={hint} error={error} style={style}>
      {secure ? (
        <View style={[styles.wrap, !!error && styles.wrapError]}>
          {input}
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            style={styles.eye}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={revealed ? t('password.hideOne') : t('password.showOne')}
          >
            <Ionicons name={revealed ? 'eye-off' : 'eye-outline'} size={20} color={theme.textSecondary} />
          </Pressable>
        </View>
      ) : (
        input
      )}
    </Field>
  );
});

export default TextField;

function createStyles(theme) {
  return StyleSheet.create({
    input: {
      flex: 1,
      minHeight: HIT,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.control,
      paddingHorizontal: space.sm + 4,
      paddingVertical: space.sm + 2,
      ...type.body,
      fontSize: 16,
      color: theme.text,
      backgroundColor: theme.surface,
    },
    multiline: { minHeight: HIT * 2, textAlignVertical: 'top' },
    // The border carries the error, not the background: a tinted field behind
    // red text is two signals for one problem, and the message below already
    // says what is wrong.
    inputError: { borderColor: theme.danger, borderWidth: 1.5 },

    bare: { borderWidth: 0, backgroundColor: 'transparent' },
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.control,
      backgroundColor: theme.surface,
    },
    wrapError: { borderColor: theme.danger, borderWidth: 1.5 },
    eye: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  });
}
