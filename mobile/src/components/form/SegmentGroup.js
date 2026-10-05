import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Field from './Field';
import { radius, type } from '../../theme/scale';

// Pick one of two or three, where the set is fixed: whose it is, which way the
// money went. Fixed means it can be laid out in equal parts and read without
// opening anything — the same control Money, the calendar and Lists wear in
// their headers, in the dry version that belongs on a form.

export default function SegmentGroup({ label, hint, error, options, value, onPick }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Field label={label} hint={hint} error={error}>
      <View style={styles.track}>
        {options.map((o) => {
          const key = o.key ?? o.value ?? o;
          const text = o.label ?? o;
          const on = key === value;
          return (
            <Pressable
              key={key}
              onPress={() => onPick(key)}
              style={[styles.segment, on && styles.segmentOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.segmentText, on && styles.segmentTextOn]} numberOfLines={1}>
                {text}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    track: {
      flexDirection: 'row',
      padding: 4,
      borderRadius: radius.control + 4,
      backgroundColor: theme.isDark ? theme.surface : theme.border,
    },
    // flex, not flexGrow: flexGrow shares out the spare space while each
    // segment still starts at the width of its own word, so the longer label
    // would sit in the wider half.
    segment: {
      flex: 1,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.control,
    },
    segmentOn: { backgroundColor: theme.isDark ? theme.primary : theme.surface },
    segmentText: { ...type.bodyStrong, fontSize: 14, color: theme.textSecondary },
    segmentTextOn: { color: theme.isDark ? '#fff' : theme.text },
  });
}
