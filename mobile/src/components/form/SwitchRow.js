import React, { useMemo } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { space, radius, type, HIT } from '../../theme/scale';

// On or off, with the words on the left and the switch on the right.
//
// It was a label from the form's label style sitting in a flex row with a bare
// Switch, which put a heading-sized, muted, uppercase-ish word next to a
// control — so the one thing on the form you toggle read as a section title
// that happened to have a switch after it. It is a row now, and it looks like
// something you operate.
export default function SwitchRow({ label, hint, value, onValueChange }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.words}>
          <Text style={styles.label}>{label}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ true: theme.primary }}
          accessibilityLabel={label}
        />
      </View>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    wrap: { marginBottom: space.md + 2 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm + 4,
      minHeight: HIT,
      paddingHorizontal: space.sm + 4,
      paddingVertical: space.sm,
      borderRadius: radius.control,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    words: { flex: 1 },
    label: { ...type.bodyStrong, color: theme.text },
    hint: { ...type.secondary, fontSize: 12, color: theme.textSecondary, marginTop: 1 },
  });
}
