import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Field from './Field';
import { space, radius, type, HIT } from '../../theme/scale';

// Pick one of many, where "many" is a list that grows: categories, folders.
//
// Options wrap onto as many lines as they need. The alternative was a picker,
// and a picker hides the list behind a tap — for six categories that is a tap
// spent on nothing, and for twenty it is the only way to see them all, which
// is why the link to manage them sits under the chips rather than inside a
// sheet somewhere.

export default function ChipGroup({ label, hint, error, options, value, onPick, footer }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Field label={label} hint={hint} error={error}>
      <View style={styles.row}>
        {options.map((o) => {
          const key = o.key ?? o.value ?? o;
          const text = o.label ?? o;
          const on = key === value;
          return (
            <Pressable
              key={key}
              onPress={() => onPick(key)}
              style={[styles.chip, on && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                {text}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {footer}
    </Field>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    chip: {
      minHeight: HIT - 6,
      justifyContent: 'center',
      paddingHorizontal: space.md - 1,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    chipOn: { backgroundColor: theme.primary, borderColor: theme.primary },
    chipText: { ...type.body, fontSize: 14, color: theme.text },
    chipTextOn: { color: '#fff', fontWeight: '600' },
  });
}
