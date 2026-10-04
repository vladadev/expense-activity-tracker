import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import { BlurredText } from '../AmountText';
import { space, radius, type, tabular, HIT } from '../../theme/scale';

// Where the money went, as a ranked list rather than a ring.
//
// This replaced a donut, and the donut was never the thing doing the work:
// DonutChart draws a 150pt ring and then prints a full legend underneath it
// with every name and every amount. The legend already answered the question.
// The ring was 150 points of decoration on top of it, and past about six
// categories its slices were too thin to read anyway — so the eye went to the
// legend regardless.
//
// A list is read top to bottom in the order that matters, needs no legend
// because the name is on the row, and works the same with three categories or
// fifteen. The bar behind each row is the share, so the shape is still there.

const PREVIEW = 5;

export default function CategoryBars({ data, total, currency, emptyLabel }) {
  const { theme } = useTheme();
  const { t, formatAmount } = useSettings();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [open, setOpen] = useState(false);

  const rows = open ? data : data.slice(0, PREVIEW);
  const hidden = data.length - rows.length;

  if (!data.length) return <Text style={styles.empty}>{emptyLabel || t('stats.noneYet')}</Text>;

  return (
    <View>
      {rows.map((d) => {
        const share = total > 0 ? d.amount / total : 0;
        return (
          <View key={d.name} style={styles.row}>
            {/* The share, drawn behind the words rather than beside them: a
                separate column of bars costs width the names need, and the
                comparison being made is between rows, not within one. */}
            <View style={[styles.fill, { width: `${Math.max(share * 100, 1.5)}%`, backgroundColor: d.color }]} />
            <View style={styles.rowInk}>
              <View style={[styles.dot, { backgroundColor: d.color }]} />
              <Text style={styles.name} numberOfLines={1}>
                {d.name}
              </Text>
              <Text style={styles.share}>{Math.round(share * 100)}%</Text>
              <BlurredText style={styles.amount}>{formatAmount(d.amount, currency)}</BlurredText>
            </View>
          </View>
        );
      })}

      {(hidden > 0 || open) && (
        <Pressable
          onPress={() => setOpen((v) => !v)}
          style={styles.more}
          accessibilityRole="button"
        >
          <Text style={styles.moreText}>
            {open ? t('stats.showLess') : t('calendar.moreEntries', { count: hidden })}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    row: {
      // 40, not 48: nothing here is pressed. The rule is about what a thumb
      // has to hit, and five rows paying for a target they never use is 40
      // points of scroll bought with nothing.
      minHeight: 40,
      justifyContent: 'center',
      borderRadius: radius.control,
      backgroundColor: theme.surface,
      borderWidth: theme.isDark ? 1 : 0,
      borderColor: theme.border,
      marginBottom: space.sm - 2,
      overflow: 'hidden',
    },
    // Faint, because it sits under text that has to stay readable at every
    // width the bar can take.
    fill: { position: 'absolute', left: 0, top: 0, bottom: 0, opacity: 0.16 },
    rowInk: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm + 4 },
    dot: { width: 9, height: 9, borderRadius: 4.5 },
    name: { flex: 1, ...type.bodyStrong, color: theme.text },
    share: { ...type.secondary, ...tabular, color: theme.textSecondary, minWidth: 34, textAlign: 'right' },
    amount: { ...type.amountSmall, color: theme.text, minWidth: 76, textAlign: 'right' },
    more: { minHeight: HIT - 10, alignItems: 'center', justifyContent: 'center' },
    moreText: { ...type.bodyStrong, fontSize: 13, color: theme.primary },
    empty: { ...type.secondary, color: theme.textSecondary, textAlign: 'center', paddingVertical: space.lg },
  });
}
