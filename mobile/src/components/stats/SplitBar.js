import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import { BlurredText } from '../AmountText';
import { space, radius, type, HIT } from '../../theme/scale';

// Two parts of one total, as one bar instead of a second ring.
//
// Personal against together is a composition of two numbers. A donut spends
// 150 points and a legend saying what a single divided bar says in forty, and
// the screen was already carrying one ring for categories — two rings asking
// the same shape of question, one under the other, is what made this page feel
// like a pile rather than an answer.
//
// Each half is a filter: pressing one narrows everything above it, which is
// what the old tappable summary boxes did and is worth keeping.

export default function SplitBar({ parts, active, onPick, currency }) {
  const { theme } = useTheme();
  const { formatAmount } = useSettings();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const total = parts.reduce((sum, p) => sum + Math.max(p.amount, 0), 0);
  if (total <= 0) return null;

  return (
    <View>
      <View style={styles.track}>
        {parts.map((p, i) => {
          const share = p.amount / total;
          if (share <= 0) return null;
          return (
            <View
              key={p.key}
              style={{
                flexGrow: share,
                flexBasis: 0,
                backgroundColor: p.color,
                opacity: active && active !== p.key ? 0.3 : 1,
                borderRightWidth: i < parts.length - 1 ? 2 : 0,
                borderRightColor: theme.surface,
              }}
            />
          );
        })}
      </View>

      <View style={styles.row}>
        {parts.map((p) => {
          const on = active === p.key;
          return (
            <Pressable
              key={p.key}
              onPress={() => onPick?.(p.key)}
              style={[styles.cell, on && { borderColor: p.color, backgroundColor: theme.surface }]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <View style={styles.cellHead}>
                <View style={[styles.dot, { backgroundColor: p.color }]} />
                <Text style={styles.name} numberOfLines={1}>
                  {p.name}
                </Text>
              </View>
              <BlurredText style={styles.amount}>{formatAmount(p.amount, currency)}</BlurredText>
              <Text style={styles.share}>{Math.round((p.amount / total) * 100)}%</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    track: {
      flexDirection: 'row',
      height: 14,
      borderRadius: 7,
      overflow: 'hidden',
      backgroundColor: theme.border,
    },
    row: { flexDirection: 'row', gap: space.sm, marginTop: space.sm + 2 },
    cell: {
      flex: 1,
      minHeight: HIT,
      justifyContent: 'center',
      paddingHorizontal: space.sm + 2,
      paddingVertical: space.sm,
      borderRadius: radius.control,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    cellHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    name: { flex: 1, ...type.secondary, color: theme.textSecondary },
    amount: { ...type.amountSmall, color: theme.text, marginTop: 2 },
    share: { ...type.secondary, fontSize: 11, color: theme.textSecondary },
  });
}
