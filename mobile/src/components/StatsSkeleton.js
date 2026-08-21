import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBlock } from './Skeleton';
import { useTheme } from '../context/ThemeContext';

// The donut is the slowest thing on Statistics, so its placeholder is a ring
// of the same diameter rather than a rectangle — the page must not resize
// under the reader when the real chart arrives.
export default function StatsSkeleton({ withChart = true }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <SkeletonBlock width="48%" height={36} radius={999} y={0} />
        <SkeletonBlock width="48%" height={36} radius={999} y={0} />
      </View>

      <SkeletonBlock width={140} height={16} y={60} style={styles.centred} />

      <View style={styles.row}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.summary}>
            <SkeletonBlock width="80%" height={10} y={130} />
            <SkeletonBlock width="60%" height={15} y={150} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>

      {withChart ? (
        <View style={styles.card}>
          <SkeletonBlock width={150} height={150} radius={75} y={240} style={styles.centred} />
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.legendRow}>
              <SkeletonBlock width={10} height={10} radius={5} y={420 + i * 30} />
              <SkeletonBlock width="45%" height={11} y={420 + i * 30} />
              <View style={{ flex: 1 }} />
              <SkeletonBlock width={70} height={11} y={420 + i * 30} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    wrap: { padding: 16 },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    summary: { flex: 1, backgroundColor: theme.surface, borderRadius: 12, padding: 12 },
    card: { backgroundColor: theme.surface, borderRadius: 12, padding: 16, marginTop: 14 },
    centred: { alignSelf: 'center', marginVertical: 12 },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  });
}
