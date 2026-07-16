import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const SIZE = 150;
const STROKE = 26;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// data: [{ name, amount, color, valueLabel }], sorted by amount descending by the caller.
// Renders a ring (no on-chart text) plus a separate legend list below it, so the
// list can grow to any number of rows without ever overlapping the chart.
export default function DonutChart({ data, total, centerValue, centerCaption, theme }) {
  const styles = createStyles(theme);
  let cumulativeFraction = 0;

  return (
    <View>
      <View style={styles.chartWrap}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={theme.border} strokeWidth={STROKE} fill="transparent" />
          {data.map((d) => {
            const fraction = total > 0 ? d.amount / total : 0;
            const dashLength = fraction * CIRCUMFERENCE;
            const strokeDashoffset = -cumulativeFraction * CIRCUMFERENCE;
            cumulativeFraction += fraction;
            return (
              <Circle
                key={d.name}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                stroke={d.color}
                strokeWidth={STROKE}
                strokeDasharray={`${dashLength} ${CIRCUMFERENCE}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="butt"
                fill="transparent"
                rotation="-90"
                origin={`${SIZE / 2}, ${SIZE / 2}`}
              />
            );
          })}
        </Svg>
        <View style={styles.centerLabel} pointerEvents="none">
          <Text style={styles.centerCaption}>{centerCaption}</Text>
          <Text style={styles.centerValue} numberOfLines={1}>{centerValue}</Text>
        </View>
      </View>
      <View style={styles.list}>
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.amount / total) * 100) : 0;
          return (
            <View key={d.name} style={[styles.row, i === 0 && styles.rowFirst]}>
              <View style={[styles.dot, { backgroundColor: d.color }]} />
              <Text style={styles.rowName} numberOfLines={1}>{d.name}</Text>
              <Text style={styles.rowPct}>{pct}%</Text>
              <Text style={styles.rowAmount}>{d.valueLabel}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    chartWrap: {
      alignSelf: 'center',
      width: SIZE,
      height: SIZE,
      marginBottom: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerLabel: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
      width: SIZE - STROKE * 2,
    },
    centerCaption: { fontSize: 11, color: theme.textSecondary },
    centerValue: { fontSize: 15, fontWeight: '700', color: theme.text, marginTop: 2 },
    list: { marginTop: 4 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    rowFirst: { borderTopWidth: 0 },
    dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
    rowName: { flex: 1, fontSize: 14, color: theme.text },
    rowPct: { fontSize: 13, color: theme.textSecondary, marginRight: 10 },
    rowAmount: { fontSize: 14, fontWeight: '600', color: theme.text },
  });
}
