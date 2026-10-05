import React, { useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import FormError from '../FormError';
import { space, radius, type, tabular, HIT } from '../../theme/scale';

// The figure the screen exists for, at the size it deserves.
//
// Adding an expense is one number and some choices about it, and the number
// used to sit in the same 16pt box as the note field underneath — the same
// weight given to the thing you came to type and the thing you probably will
// not. It is the one amount on the screen, so it is drawn like the one amount
// on the screen, and the currency stands beside it rather than taking a row
// and a set of pills of its own.

export default function AmountField({
  label,
  value,
  onChangeText,
  error,
  currency,
  currencies,
  onPickCurrency,
  placeholder = '0',
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.label}>{label}</Text>

        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            keyboardType="decimal-pad"
            placeholder={placeholder}
            placeholderTextColor={theme.border}
            // The one field on the screen you certainly came to fill.
            autoFocus
            accessibilityLabel={label}
          />
          <Text style={styles.currency}>{currency}</Text>
        </View>

        <View style={[styles.rule, { backgroundColor: error ? theme.danger : theme.primary }]} />

        {/* The other currencies, only when there are others. A row of pills
            offering one choice is a row that asks a question with no answer. */}
        {currencies && currencies.length > 1 && (
          <View style={styles.currencyRow}>
            {currencies.map((c) => {
              const on = c === currency;
              return (
                <Pressable
                  key={c}
                  onPress={() => onPickCurrency?.(c)}
                  style={[styles.currencyPill, on && styles.currencyPillOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.currencyPillText, on && styles.currencyPillTextOn]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <FormError message={error} />
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    wrap: { marginBottom: space.md + 2 },
    card: {
      paddingVertical: space.lg,
      paddingHorizontal: space.md + 4,
      borderRadius: radius.card + 4,
      backgroundColor: theme.surface,
      borderWidth: theme.isDark ? 1 : 0,
      borderColor: theme.border,
      alignItems: 'center',
    },
    label: { ...type.label, color: theme.textSecondary, marginBottom: space.sm + 2 },
    row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: space.sm },
    input: {
      minWidth: 140,
      maxWidth: 200,
      textAlign: 'right',
      padding: 0,
      ...type.hero,
      ...tabular,
      color: theme.text,
    },
    currency: { ...type.amountMedium, fontSize: 19, color: theme.textSecondary },
    rule: { height: 2, borderRadius: 1, width: 200, marginTop: space.sm + 6 },
    currencyRow: { flexDirection: 'row', gap: space.sm - 2, marginTop: space.md },
    currencyPill: {
      minHeight: HIT - 12,
      justifyContent: 'center',
      paddingHorizontal: space.sm + 4,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: theme.border,
    },
    currencyPillOn: { borderColor: theme.primary, backgroundColor: theme.primaryLight },
    currencyPillText: { ...type.secondary, color: theme.textSecondary },
    currencyPillTextOn: { color: theme.primary, fontWeight: '700' },
  });
}
