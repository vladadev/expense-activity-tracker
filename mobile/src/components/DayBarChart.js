import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Svg, { Line, Rect, G, Defs, ClipPath } from 'react-native-svg';
import { BlurredText, CAN_BLUR } from './AmountText';
import { useSettings } from '../context/SettingsContext';
import { space, type, tabular } from '../theme/scale';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const HEIGHT = 190;
const TOP_PAD = 30; // room for the value label above the tallest bar
const BOTTOM_PAD = 24; // room for the x-axis day labels
const LEFT_PAD = 40; // gutter for the y-axis scale labels
const GRID_STEPS = 3; // gridlines drawn between baseline and top
const LABEL_WIDTH = 120; // fixed width for the floating max-value label
const MAX_LABELS = 7; // a whole month cannot print 31 dates in 286 points

// Clip ids are global on Android in react-native-svg, not scoped to the
// component — two charts on one screen would share a wipe. See rn-gotchas.
let seq = 0;

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

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row' },
  column: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  dayLabel: { fontSize: 10, height: BOTTOM_PAD, textAlignVertical: 'center', ...tabular },
  axisLabel: { position: 'absolute', left: 0, fontSize: 10, textAlign: 'right' },
  valueLabel: { position: 'absolute', top: 4, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm + 4, marginTop: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 1 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
});

// data: [{ label, date, value, segments? }], where segments is
// [{ key, value, color }] stacked bottom-to-top within the day's bar.
//
// Every day in the period gets a column, including the empty ones. It used to
// be the last ten days that HAD an entry, which was wrong twice over: the
// heading said "September" while the chart showed a tenth of it, and two
// neighbouring bars could be one day apart or nine, so the x-axis looked like
// time and was not.
//
// The bars grow out of the baseline under a single clip rectangle rather than
// each animating its own height. A month of stacked bars is sixty-odd rects,
// and sixty JS-driven interpolations a frame is exactly the kind of work
// nobody sees and everybody feels.
export default function DayBarChart({
  data,
  width,
  theme,
  formatAmount,
  currency,
  onBarPress,
  legend,
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const uid = useRef(`dbc${(seq += 1)}`).current;
  const { hideAmounts } = useSettings();

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
  // Fat when there are twelve months, thin when there are thirty-one days,
  // never thinner than something a finger can see it has hit.
  const barWidth = clamp(columnWidth * 0.66, 3, 26);

  // Gridlines + their scale values, from top (maxValue) down to the baseline (0).
  const gridLines = [];
  for (let i = 0; i <= GRID_STEPS; i++) {
    const y = TOP_PAD + (plotHeight / GRID_STEPS) * i;
    const value = maxValue * (1 - i / GRID_STEPS);
    gridLines.push({ y, value, isBaseline: i === GRID_STEPS });
  }

  const labelStep = Math.max(1, Math.ceil(data.length / MAX_LABELS));

  const maxCenterX = LEFT_PAD + maxIndex * columnWidth + columnWidth / 2;
  const labelLeft = clamp(maxCenterX - LABEL_WIDTH / 2, 0, width - LABEL_WIDTH);

  const wipeHeight = progress.interpolate({ inputRange: [0, 1], outputRange: [0, plotHeight + TOP_PAD] });
  const wipeY = progress.interpolate({ inputRange: [0, 1], outputRange: [baselineY, 0] });

  return (
    <View style={{ width }}>
      <View style={{ width, height: HEIGHT }}>
        <Svg width={width} height={HEIGHT}>
          <Defs>
            <ClipPath id={`${uid}-wipe`}>
              <AnimatedRect x={0} y={wipeY} width={width} height={wipeHeight} />
            </ClipPath>
          </Defs>

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

          <G clipPath={`url(#${uid}-wipe)`}>
            {data.map((d, i) => {
              if (!(d.value > 0)) return null;
              const x = LEFT_PAD + i * columnWidth + (columnWidth - barWidth) / 2;
              const isMax = i === maxIndex;
              const rx = Math.min(barWidth / 2, 5);
              const parts =
                d.segments && d.segments.length
                  ? d.segments.filter((s) => s.value > 0)
                  : [{ key: 'all', value: d.value, color: isMax ? theme.primary : hexToRgba(theme.primary, 0.45) }];

              // Stacked from the baseline up. Only the top of the whole bar is
              // rounded: rounding every segment turns a stack into a string of
              // beads and stops the parts reading as one day.
              let cursor = 0;
              return parts.map((s, n) => {
                const h = (s.value / maxValue) * plotHeight;
                const y = baselineY - cursor - h;
                cursor += h;
                const top = n === parts.length - 1;
                return (
                  <G key={`${i}-${s.key}`}>
                    <Rect x={x} y={y} width={barWidth} height={Math.max(h, 0.5)} rx={top ? rx : 0} fill={s.color} />
                    {/* The rounded top leaves a notch where it meets the
                        segment under it; this fills it back in. */}
                    {top && parts.length > 1 && h > rx && (
                      <Rect x={x} y={y + h - rx} width={barWidth} height={rx} fill={s.color} />
                    )}
                  </G>
                );
              });
            })}
          </G>
        </Svg>

        {/* Blur keeps the scale in place. Where blur isn't available the labels
            are dropped instead of masked: the gutter is only 32px wide, so
            "•••••k" would just truncate. The bars still carry the shape. */}
        {(!hideAmounts || CAN_BLUR) &&
          gridLines.map((g, i) => (
            <BlurredText
              key={i}
              style={[styles.axisLabel, { color: theme.textSecondary, top: g.y - 7, width: LEFT_PAD - 8 }]}
              numberOfLines={1}
            >
              {compact(g.value)}
            </BlurredText>
          ))}

        <BlurredText
          style={[styles.valueLabel, { color: theme.primary, left: labelLeft, width: LABEL_WIDTH }]}
          numberOfLines={1}
        >
          {formatAmount(maxValue, currency)}
        </BlurredText>

        <View style={[StyleSheet.absoluteFill, { paddingLeft: LEFT_PAD }]} pointerEvents="box-none">
          <View style={styles.overlay}>
            {data.map((d, i) => (
              <TouchableOpacity
                key={i}
                style={styles.column}
                activeOpacity={0.6}
                onPress={() => onBarPress?.(d.date)}
                accessibilityRole="button"
                accessibilityLabel={`${d.label}: ${formatAmount(d.value, currency)}`}
              >
                {/* Every nth day, plus the biggest one — and the nth is
                    dropped when it would land on top of the biggest, because
                    two dates nineteen points apart touch. */}
                <Text style={[styles.dayLabel, { color: theme.textSecondary }]}>
                  {i === maxIndex || (i % labelStep === 0 && Math.abs(i - maxIndex) > 2) ? d.label : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {legend && legend.length > 1 && (
        <View style={styles.legend}>
          {legend.map((l) => (
            <View key={l.key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: l.color }]} />
              <Text style={[type.secondary, { color: theme.textSecondary }]}>{l.name}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
