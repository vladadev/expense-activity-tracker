import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBlock } from './Skeleton';
import { useTheme } from '../context/ThemeContext';

// Mirrors the real Finances layout closely enough that nothing jumps when the
// data arrives — the point of a skeleton is that the page is already there.
// `y` values feed the screen-wide sweep so the wave travels down the page
// instead of every block blinking on its own.
export default function FinancesSkeleton() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <SkeletonBlock width="32%" height={38} radius={999} y={0} />
        <SkeletonBlock width="32%" height={38} radius={999} y={0} />
        <SkeletonBlock width="32%" height={38} radius={999} y={0} />
      </View>

      <SkeletonBlock width={130} height={16} y={60} style={styles.centred} />

      <View style={styles.card}>
        <SkeletonBlock width={110} height={11} y={120} style={styles.centred} />
        <SkeletonBlock width={190} height={34} radius={8} y={140} style={styles.centredTop} />
      </View>

      <View style={styles.row}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.metric}>
            <SkeletonBlock width="100%" height={11} y={230} />
            <SkeletonBlock width="70%" height={15} y={250} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>

      <SkeletonBlock width={120} height={11} y={320} style={{ marginTop: 22, marginBottom: 10 }} />
      <View style={styles.card}>
        <View style={styles.between}>
          <SkeletonBlock width={100} height={13} y={360} />
          <SkeletonBlock width={90} height={13} y={360} />
        </View>
        <View style={[styles.between, { marginTop: 16 }]}>
          <SkeletonBlock width={120} height={13} y={400} />
          <SkeletonBlock width={90} height={13} y={400} />
        </View>
      </View>

      <View style={[styles.row, { marginTop: 18 }]}>
        <SkeletonBlock width="48%" height={46} radius={12} y={470} />
        <SkeletonBlock width="48%" height={46} radius={12} y={470} />
      </View>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    wrap: { padding: 16 },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    metric: { flex: 1, backgroundColor: theme.surface, borderRadius: 12, padding: 12 },
    card: { backgroundColor: theme.surface, borderRadius: 12, padding: 14, marginVertical: 10 },
    between: { flexDirection: 'row', justifyContent: 'space-between' },
    centred: { alignSelf: 'center', marginVertical: 12 },
    centredTop: { alignSelf: 'center', marginTop: 10 },
  });
}
