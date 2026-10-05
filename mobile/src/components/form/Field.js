import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import FormError from '../FormError';
import { space, type } from '../../theme/scale';

// A label, a thing, and the error that belongs to it.
//
// Ten screens in this app hold a text field, and drawn one at a time they
// ended up ten slightly different forms: a label at 14 here and 12 there, a
// gap of 16 above one and 18 above the next, an error sometimes under the
// field and sometimes at the foot of the screen. None of that was decided —
// it accumulated. This is the decision, made once.

export default function Field({ label, hint, error, children, style }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {children}
      {/* Under the field it belongs to, never at the foot of the screen: an
          error you have to scroll to find is an error you argue with. */}
      <FormError message={error} />
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    wrap: { marginBottom: space.md + 2 },
    label: { ...type.bodyStrong, fontSize: 13, color: theme.textSecondary, marginBottom: space.sm + 1 },
    hint: { ...type.secondary, fontSize: 12, color: theme.textSecondary, marginTop: space.sm },
  });
}
