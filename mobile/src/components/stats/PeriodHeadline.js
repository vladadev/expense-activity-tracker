import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import { BlurredText } from '../AmountText';
import { space, radius, type } from '../../theme/scale';

// The answer, before any of the working.
//
// The screen he liked least was never badly drawn — it had no question of its
// own. It opened on four rows of controls and then a chart, and you had to
// assemble the headline yourself out of parts. This is the headline: one
// figure for the period, and one plain sentence saying whether that is more or
// less than last time, which is the comparison every one of those charts was
// being read for and the only one the screen never made.

export default function PeriodHeadline({ label, total, prevTotal, prevLabel, currency, tint }) {
  const { theme } = useTheme();
  const { t, formatAmount } = useSettings();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // No comparison rather than a meaningless one: a period with nothing in it
  // makes every change infinite, and the first month a household uses the app
  // has no previous month at all.
  const comparable = typeof prevTotal === 'number' && prevTotal > 0 && total >= 0;
  const delta = comparable ? (total - prevTotal) / prevTotal : 0;
  const pct = Math.abs(Math.round(delta * 100));
  const flat = comparable && pct < 1;
  const up = delta > 0;

  const accent = tint || theme.primary;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <BlurredText style={[styles.figure, { color: accent }]}>{formatAmount(total, currency)}</BlurredText>

      {comparable && (
        <View style={styles.deltaRow}>
          <View style={[styles.deltaChip, { backgroundColor: flat ? theme.border : up ? theme.dangerLight : theme.primaryLight }]}>
            <Ionicons
              name={flat ? 'remove' : up ? 'arrow-up' : 'arrow-down'}
              size={13}
              color={flat ? theme.textSecondary : up ? theme.danger : theme.primary}
            />
            <Text style={[styles.deltaText, { color: flat ? theme.textSecondary : up ? theme.danger : theme.primary }]}>
              {flat ? t('stats.aboutSame') : `${pct}%`}
            </Text>
          </View>
          <Text style={styles.deltaCaption} numberOfLines={2}>
            {flat ? t('stats.sameAs', { period: prevLabel }) : t(up ? 'stats.moreThan' : 'stats.lessThan', { period: prevLabel })}
          </Text>
        </View>
      )}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    card: {
      padding: space.md + 2,
      borderRadius: radius.card + 4,
      backgroundColor: theme.surface,
      borderWidth: theme.isDark ? 1 : 0,
      borderColor: theme.border,
      marginBottom: space.md,
    },
    label: { ...type.label, color: theme.textSecondary, marginBottom: space.sm - 2 },
    figure: { ...type.amountLarge },
    deltaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm + 2 },
    deltaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: space.sm,
      paddingVertical: space.xs,
      borderRadius: radius.pill,
    },
    deltaText: { ...type.bodyStrong, fontSize: 13 },
    deltaCaption: { flex: 1, ...type.secondary, color: theme.textSecondary },
  });
}
