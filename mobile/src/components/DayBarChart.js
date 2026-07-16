import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const HEIGHT = 190;
const TOP_PAD = 30; // room for the value label above the tallest bar
const BOTTOM_PAD = 24; // room for the x-axis day labels
const LEFT_PAD = 40; // gutter for the y-axis scale labels
const GRID_STEPS = 3; // gridlines drawn between baseline and top
const LABEL_WIDTH = 120; // fixed width for the floating max-value label

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Short thousands form for the y-axis scale, e.g. 36270 -> "36k".
function compact(v) {
  if (v >= 1000000) return `${Math.round(v / 100000) / 10}M`;
  if (v >= 1000) return `${Math.round(v / 100) / 10}k`;
  return String(Math.round(v));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// data: [{ label, value, date }]. Evenly-spaced rounded bars with faint
// gridlines and a y-axis scale; the tallest bar is drawn in the full theme
// colour (others in a lighter tint) with its value printed above it. Each bar
// column is a full tap target that calls onBarPress(date).
export default function DayBarChart({ data, width, theme, formatAmount, currency, onBarPress }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 600, useNativeDriver: false }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.map((d) => d.value).join(','), width]);

  const plotHeight = HEIGHT - TOP_PAD - BOTTOM_PAD;
  const plotWidth = width - LEFT_PAD;
  const baselineY = TOP_PAD + plotHeight;
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const maxIndex = data.reduce((best, d, i, arr) => (d.value > arr[best].value ? i : best), 0);
  const columnWidth = plotWidth / data.length;
  const barWidth = Math.min(26, columnWidth * 0.5);

  // Gridlines + their scale values, from top (maxValue) down to the baseline (0).
  const gridLines = [];
  for (let i = 0; i <= GRID_STEPS; i++) {
    const y = TOP_PAD + (plotHeight / GRID_STEPS) * i;
    const value = maxValue * (1 - i / GRID_STEPS);
    gridLines.push({ y, value, isBaseline: i === GRID_STEPS });
  }

  const maxCenterX = LEFT_PAD + maxIndex * columnWidth + columnWidth / 2;
  const labelLeft = clamp(maxCenterX - LABEL_WIDTH / 2, 0, width - LABEL_WIDTH);

  return (
    <View style={{ width, height: HEIGHT }}>
      <Svg width={width} height={HEIGHT}>
        {gridLines.map((g, i) => (
          <Line
            key={i}
            x1={LEFT_PAD}
            y1={g.y}
            x2={width}
            y2={g.y}
            stroke={theme.border}
            strokeWidth={g.isBaseline ? 1.5 : 1}
          />
        ))}

        {data.map((d, i) => {
          const fullHeight = d.value > 0 ? (d.value / maxValue) * plotHeight : 0;
          const x = LEFT_PAD + i * columnWidth + (columnWidth - barWidth) / 2;
          const isMax = i === maxIndex && d.value > 0;
          const animatedHeight = progress.interpolate({ inputRange: [0, 1], outputRange: [0, fullHeight] });
          const animatedY = progress.interpolate({ inputRange: [0, 1], outputRange: [baselineY, baselineY - fullHeight] });
          return (
            <AnimatedRect
              key={i}
              x={x}
              y={animatedY}
              width={barWidth}
              height={animatedHeight}
              rx={5}
              fill={isMax ? theme.primary : hexToRgba(theme.primary, 0.3)}
            />
          );
        })}
      </Svg>

      {gridLines.map((g, i) => (
        <Text
          key={i}
          style={[styles.axisLabel, { color: theme.textSecondary, top: g.y - 7, width: LEFT_PAD - 8 }]}
          numberOfLines={1}
        >
          {compact(g.value)}
        </Text>
      ))}

      <Text
        style={[styles.valueLabel, { color: theme.primary, left: labelLeft, width: LABEL_WIDTH }]}
        numberOfLines={1}
      >
        {formatAmount(maxValue, currency)}
      </Text>

      <View style={[StyleSheet.absoluteFill, { paddingLeft: LEFT_PAD }]} pointerEvents="box-none">
        <View style={styles.overlay}>
          {data.map((d, i) => (
            <TouchableOpacity
              key={i}
              style={styles.column}
              activeOpacity={0.6}
              onPress={() => onBarPress?.(d.date)}
            >
              <Text style={[styles.dayLabel, { color: theme.textSecondary }]}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row' },
  column: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  dayLabel: { fontSize: 11, height: BOTTOM_PAD, textAlignVertical: 'center' },
  axisLabel: { position: 'absolute', left: 0, fontSize: 10, textAlign: 'right' },
  valueLabel: { position: 'absolute', top: 4, fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
