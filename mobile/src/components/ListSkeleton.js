import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBlock } from './Skeleton';
import { useTheme } from '../context/ThemeContext';

// For screens that are simply a heading and a stack of rows — savings,
// income lists, folder contents. Shapes are deliberately uneven: a column of
// identical bars reads as a pattern, not as content on its way.
export default function ListSkeleton({ cards = 2, rows = 3 }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const widths = ['62%', '48%', '71%', '55%'];

  return (
    <View style={styles.wrap}>
      {Array.from({ length: cards }).map((_, c) => (
        <View key={c} style={styles.card}>
          <SkeletonBlock width={110} height={12} y={c * 190} />
          {Array.from({ length: rows }).map((_, r) => (
            <View key={r} style={styles.row}>
              <SkeletonBlock width={widths[r % widths.length]} height={13} y={c * 190 + 40 + r * 34} />
              <View style={{ flex: 1 }} />
              <SkeletonBlock width={72} height={13} y={c * 190 + 40 + r * 34} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    wrap: { padding: 16 },
    card: { backgroundColor: theme.surface, borderRadius: 12, padding: 14, marginBottom: 12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  });
}
