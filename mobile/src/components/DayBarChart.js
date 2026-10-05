import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Line, Rect, G, Text as SvgText } from 'react-native-svg';
import { BlurredText, CAN_BLUR } from './AmountText';
import { useSettings } from '../context/SettingsContext';
import { space, type, tabular } from '../theme/scale';
import { scaleFor } from './chartScale';

const HEIGHT = 190;
const TOP_PAD = 30; // room for the value label above the tallest bar
const BOTTOM_PAD = 26; // room for the x-axis day labels
const LEFT_PAD = 40; // gutter for the y-axis scale labels
const GRID_STEPS = 3; // gridlines drawn between baseline and top
const LABEL_WIDTH = 120; // fixed width for the floating max-value label
const MAX_LABELS = 6; // a month cannot print 31 dates across 286 points

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
  axisLabel: { position: 'absolute', left: 0, fontSize: 10, textAlign: 'right' },
  valueLabel: { position: 'absolute', top: 4, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm + 4, marginTop: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 1 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  caption: { ...type.secondary, fontSize: 11, marginTop: space.xs, ...tabular },
});

// data: [{ label, date, value, segments? }], where segments is
// [{ key, value, color }] stacked bottom-to-top within one bar.
//
// Every day of the period gets a column, the empty ones included. It used to
// plot the last ten days that HAD an entry, which was wrong twice over: the
// heading said September while the chart showed a tenth of it, and because it
// was keyed on days-with-entries, two neighbouring bars could be one day apart
// or nine — an axis that looked like time without being it.
//
// Nothing here animates. The bars used to grow out of the baseline, which cost
// either sixty JS-driven interpolations a frame or an animated clip rectangle
// — and the clip is what shipped, and it drew nothing at all, because an
// Animated value inside a <ClipPath> is resolved once and never updated, so
// the clip stayed at the zero height it started at and took every bar with it.
// A chart that appears is worth more than a chart that grows.
export default function DayBarChart({ data, width, theme, formatAmount, currency, onBarPress, legend, caption }) {
  const { hideAmounts } = useSettings();

  const plotHeight = HEIGHT - TOP_PAD - BOTTOM_PAD;
  const plotWidth = width - LEFT_PAD;
  // The scale spans what the data actually covers, which for savings includes
  // withdrawals. It used to be a maximum with a floor of zero, and anything at
  // or below zero was skipped outright — so a month where more came out than
  // went in drew an empty chart, and the days money left were simply not
  // there. A chart that omits the half of the data it finds awkward is worse
  // than no chart.
  const { highest, lowest, span, zeroY } = scaleFor(data.map((d) => d.value), plotHeight, TOP_PAD);

  const maxIndex = data.reduce((best, d, i, arr) => (Math.abs(d.value) > Math.abs(arr[best].value) ? i : best), 0);
  const peak = data[maxIndex]?.value || 0;
  const columnWidth = plotWidth / data.length;
  // Fat for twelve months, thin for thirty-one days, never invisible.
  const barWidth = clamp(columnWidth * 0.66, 3, 26);

  const gridLines = [];
  for (let i = 0; i <= GRID_STEPS; i++) {
    const y = TOP_PAD + (plotHeight / GRID_STEPS) * i;
    gridLines.push({ y, value: highest - (span / GRID_STEPS) * i, isBaseline: false });
  }
  // Zero gets its own line, heavier than the rest: once there are bars below
  // it, it is the thing every one of them is measured from.
  gridLines.push({ y: zeroY, value: 0, isBaseline: true, isZero: lowest < 0 });

  const labelStep = Math.max(1, Math.ceil(data.length / MAX_LABELS));
  const maxCenterX = LEFT_PAD + maxIndex * columnWidth + columnWidth / 2;
  const labelLeft = clamp(maxCenterX - LABEL_WIDTH / 2, 0, width - LABEL_WIDTH);

  // A column is nine points wide across a month, which is not a target. The
  // whole plot is one target instead, and the press lands on the column
  // nearest the finger.
  function handlePress(e) {
    if (!onBarPress) return;
    const x = e.nativeEvent.locationX;
    const i = clamp(Math.floor(x / columnWidth), 0, data.length - 1);
    onBarPress(data[i].date);
  }

  return (
    <View style={{ width }}>
      <View style={{ width, height: HEIGHT }}>
        <Svg width={width} height={HEIGHT}>
          {gridLines.map((g, i) => (
            <Line
              key={i}
              x1={LEFT_PAD}
              y1={g.y}
              x2={width}
              y2={g.y}
              stroke={g.isZero ? theme.textSecondary : theme.border}
              strokeWidth={g.isBaseline ? 1.5 : 1}
            />
          ))}

          {data.map((d, i) => {
            if (!d.value) return null;
            const x = LEFT_PAD + i * columnWidth + (columnWidth - barWidth) / 2;
            const rx = Math.min(barWidth / 2, 5);
            const parts =
              d.segments && d.segments.length
                ? d.segments.filter((s) => s.value !== 0)
                : [{ key: 'all', value: d.value, color: hexToRgba(theme.primary, i === maxIndex ? 1 : 0.55) }];

            // Stacked away from zero in both directions, so a day where one
            // person paid in and the other took out shows both.
            const ups = parts.filter((s) => s.value > 0);
            const downs = parts.filter((s) => s.value < 0);
            let up = 0;
            let down = 0;

            return parts.map((s) => {
              const h = (Math.abs(s.value) / span) * plotHeight;
              const positive = s.value > 0;
              const y = positive ? zeroY - up - h : zeroY + down;
              const outermost = positive ? s === ups[ups.length - 1] : s === downs[downs.length - 1];
              if (positive) up += h;
              else down += h;
              return (
                // G and not a Fragment: react-native-svg walks real SVG
                // elements, and a fragment in the middle of that walk is a
                // place where children quietly fail to arrive.
                <G key={`${i}-${s.key}`}>
                  <Rect x={x} y={y} width={barWidth} height={Math.max(h, 1)} rx={outermost ? rx : 0} fill={s.color} />
                  {/* Only the far end of the whole bar is rounded — rounding
                      each segment turns a stack into a string of beads. This
                      fills the notch the rounding leaves behind it. */}
                  {outermost && parts.length > 1 && h > rx && (
                    <Rect x={x} y={positive ? y + h - rx : y} width={barWidth} height={rx} fill={s.color} />
                  )}
                </G>
              );
            });
          })}

          {/* Drawn into the SVG, not laid out as views: a day label in a nine
              point column wrapped onto two lines, so "11" came out as a 1 above
              a 1 and the axis read as nonsense. */}
          {data.map((d, i) => {
            const show = i === maxIndex || (i % labelStep === 0 && Math.abs(i - maxIndex) > 2);
            if (!show) return null;
            return (
              <SvgText
                key={`l${i}`}
                x={LEFT_PAD + i * columnWidth + columnWidth / 2}
                y={HEIGHT - 9}
                textAnchor="middle"
                fontSize="10"
                fill={theme.textSecondary}
              >
                {d.label}
              </SvgText>
            );
          })}
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
          {formatAmount(peak, currency)}
        </BlurredText>

        <Pressable
          onPress={handlePress}
          style={{ position: 'absolute', left: LEFT_PAD, top: TOP_PAD, width: plotWidth, height: plotHeight + BOTTOM_PAD }}
          accessibilityRole="button"
        />
      </View>

      {caption ? <Text style={[styles.caption, { color: theme.textSecondary }]}>{caption}</Text> : null}

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
