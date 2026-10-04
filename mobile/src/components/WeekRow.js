import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { space, font, type, tabular, HIT } from '../theme/scale';

// The month, collapsed to the week the chosen day is in.
//
// The month grid takes half the screen whether you are reading the month or
// reading one day, and it is one day you are reading almost every time. This
// is what stands in for it then: the same seven columns in the same order,
// the same dots, so the eye does not have to re-learn anything — it is the
// month with five rows taken away, not a different control.
//
// Written here rather than reached for from the calendar library, because the
// library's own collapsing calendar brings its own provider and its own theme
// and would have to be taught the palette twice.
//
// The chosen day is drawn at exactly the size and radius the grid above draws
// it, from the constants below, so folding and unfolding moves rows and
// nothing else. It was 34 wide with a radius of 999, and that is the bug he
// found: every other round thing in this app is drawn at half its own width,
// and an oversized radius is not reliably clamped on Android under Fabric, so
// the one outlier was the one marker that came out square.

// What the calendar library draws a day in: 32 across, radius exactly half.
// Changing either here without changing the grid's theme splits the two.
export const DAY = 32;
export const DAY_RADIUS = DAY / 2;

// Monday first, the same as the grid above it.
function startOfWeek(iso) {
  const d = new Date(`${iso}T00:00:00`);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return d;
}

function isoOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function weekOf(iso) {
  const start = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return isoOf(d);
  });
}

export default function WeekRow({ selected, today, marks, headings, onPick }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const days = useMemo(() => weekOf(selected), [selected]);

  return (
    <View style={styles.row}>
      {days.map((iso, i) => {
        const chosen = iso === selected;
        const dots = (marks[iso] && marks[iso].dots) || [];
        return (
          <Pressable key={iso} style={styles.cell} onPress={() => onPick(iso)} accessibilityRole="button">
            <Text style={styles.heading}>{headings[i]}</Text>
            <View style={[styles.number, chosen && { backgroundColor: theme.primary }]}>
              <Text
                style={[
                  styles.numberText,
                  iso === today && !chosen && { color: theme.primary },
                  chosen && { color: theme.isDark ? '#06201A' : '#FFFFFF' },
                ]}
              >
                {Number(iso.slice(8, 10))}
              </Text>
            </View>
            {/* The dots carry the same meaning here as in the grid, and are
                hidden under the chosen day because its fill already says it. */}
            <View style={styles.dots}>
              {!chosen &&
                dots.slice(0, 3).map((dot, n) => (
                  <View key={`${dot.color}-${n}`} style={[styles.dot, { backgroundColor: dot.color }]} />
                ))}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    row: { flexDirection: 'row', paddingHorizontal: space.xs },
    cell: { flex: 1, alignItems: 'center', paddingVertical: space.xs, minHeight: HIT + 14 },
    heading: { ...type.secondary, fontSize: 11, color: theme.textSecondary },
    number: {
      width: DAY,
      height: DAY,
      borderRadius: DAY_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    // The grid's own day type, so the figure does not change size or face when
    // the month folds around it.
    numberText: { fontFamily: font.displayMedium, fontSize: 17, ...tabular, color: theme.text },
    dots: { flexDirection: 'row', gap: 3, height: 6, alignItems: 'center' },
    dot: { width: 5, height: 5, borderRadius: 3 },
  });
}
