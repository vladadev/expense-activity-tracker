/* Duo Tracker — animirani splash (React Native).
   Zahteva: react-native-svg (vec u projektu).
   <DuoSplash onFinish={() => setReady(true)} />  — loop={false} za pravi splash. */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, {
  Path, Circle, Line, G, Defs, RadialGradient, Stop,
} from 'react-native-svg';
import {
  BLUE, ROSE, NAVY, D_BLUE, D_ROSE, STAR_D,
  ramp, glide, settle, edgePoint, useClock,
} from './duoAnimation';

// Timeline (sekunde) — isti raspored kao odobrena verzija.
const T_ARRIVE = 0.8;
const T_MEET = 0.7;
const T_SPIN = 0.8;
const T_HOLD = 0.5;
const T_SPARKLE = 1.1;
const T_OUT = 0.4;

const CUE_MEET = T_ARRIVE;
const CUE_SPIN = CUE_MEET + T_MEET;
const CUE_HOLD = CUE_SPIN + T_SPIN;
const CUE_SPARKLE = CUE_HOLD + T_HOLD;
const CUE_OUT = CUE_SPARKLE + T_SPARKLE;
const TOTAL = CUE_OUT + T_OUT;

// Gradient ids are global in react-native-svg on Android: two mounted
// instances sharing 'halo-blue' would resolve each other's definitions.
let instanceSeq = 0;

function Star({ side, p, tint, uid }) {
  if (p <= 0) return null;
  const head = edgePoint(side, Math.min(1, p));

  const segs = [];
  const N = 26;
  for (let k = 0; k < N; k++) {
    const p1 = p - (k / N) * 0.3;
    const p2 = p - ((k + 1) / N) * 0.3;
    if (p2 <= 0) break;
    const a = edgePoint(side, Math.min(1, p1));
    const b = edgePoint(side, Math.min(1, p2));
    const f = 1 - k / N;
    segs.push({ a, b, w: 0.45 + 3.1 * Math.pow(f, 1.8), o: 0.8 * Math.pow(f, 1.5) });
  }

  const motes = [];
  for (let k = 1; k <= 5; k++) {
    const pk = p - k * 0.045;
    if (pk <= 0) break;
    const c = edgePoint(side, pk);
    const n = Math.hypot(c.x, c.y) || 1;
    const off = (k % 2 ? 1 : -1) * (1.1 + k * 0.5);
    motes.push({
      x: c.x + (c.x / n) * off,
      y: c.y + (c.y / n) * off,
      r: Math.max(0.15, 0.85 - k * 0.11),
      o: 0.5 * (1 - k / 6),
    });
  }

  const twinkle = 1 + 0.2 * Math.sin(p * 34);
  const scale = (4.6 + 1.7 * Math.sin(p * 12)) * twinkle;
  const spin = 42 + p * 210;

  return (
    <G>
      {segs.reverse().map((s, i) => (
        <Line key={`s${i}`} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y}
          stroke={tint} strokeWidth={s.w} strokeLinecap="round" opacity={s.o} />
      ))}
      {motes.map((m, i) => (
        <Circle key={`m${i}`} cx={m.x} cy={m.y} r={m.r} fill="#FFFFFF" opacity={m.o} />
      ))}
      <G x={head.x} y={head.y}>
        <Circle r={12 * twinkle} fill={`url(#halo-${side}-${uid})`} />
        <G rotation={spin}><G scale={scale}>
          <Path d={STAR_D} fill="#FFFFFF" opacity={0.95} />
        </G></G>
        <G rotation={spin + 45}><G scale={scale * 0.5}>
          <Path d={STAR_D} fill={tint} opacity={0.85} />
        </G></G>
        <Circle r={1.4} fill="#FFFFFF" />
      </G>
    </G>
  );
}

function Bloom({ p, uid }) {
  if (p <= 0 || p >= 1) return null;
  const out = 1 - p;
  return (
    <G opacity={Math.pow(out, 0.8)}>
      <Circle r={14 * p + 3} fill={`url(#halo-bloom-${uid})`} opacity={0.9 * out} />
      <Circle r={4 + 26 * p} fill="none" stroke="#FFFFFF" strokeWidth={1.8 * out} opacity={0.7 * out} />
      <Circle r={2 + 13 * p} fill="none" stroke={ROSE} strokeWidth={1.1 * out} opacity={0.55 * out} />
      <G rotation={p * 90}><G scale={(7 + 13 * p) * out}>
        <Path d={STAR_D} fill="#FFFFFF" opacity={0.95} />
      </G></G>
      <G rotation={p * 90 + 45}><G scale={(5 + 9 * p) * out}>
        <Path d={STAR_D} fill="#CFE4FF" opacity={0.8} />
      </G></G>
    </G>
  );
}

export default function DuoSplash({
  loop = true,
  onFinish,
  showName = true,
  showTagline = true,
  sparkle = true,
  tagline = 'Two people, one plan',
  fontFamily,
}) {
  const uid = React.useMemo(() => ++instanceSeq, []);
  const T = useClock(TOTAL, loop, onFinish);
  const { width } = Dimensions.get('window');
  const size = Math.min(width * 0.52, 260);

  const approach = ramp(T, 0, CUE_SPIN);
  const gap = 520 * (1 - approach) + 26 * settle(T, CUE_SPIN, 0.85, 1.15);
  const halfSpin = 400 * (1 - approach);
  const arriveScale = 0.62 + 0.38 * approach;
  const halfOpacity = glide(T, 0, CUE_MEET * 0.5);

  const unitSpin = 360 * ramp(T, CUE_SPIN, CUE_HOLD + 0.15);

  const breathAmp = 0.03 * ramp(T, CUE_SPIN, CUE_HOLD + 0.25);
  const breath = 1 + breathAmp * Math.sin(((T - CUE_SPIN) / 1.05) * Math.PI * 2);

  const outP = ramp(T, CUE_OUT, TOTAL);
  const outFade = 1 - ramp(T, CUE_OUT, TOTAL - 0.05);
  const coinScale = arriveScale * breath * (1 + 0.12 * outP);

  const nameIn = ramp(T, CUE_SPIN + 0.05, CUE_HOLD + 0.05);
  const nameOpacity = nameIn * (1 - ramp(T, CUE_OUT, TOTAL - 0.12));
  const nameLs = 0.16 + 0.34 * (1 - nameIn) + 0.26 * outP;
  const nameY = 24 * (1 - nameIn);
  const tagIn = ramp(T, CUE_SPIN + 0.35, CUE_HOLD + 0.3);
  const tagOpacity = tagIn * (1 - ramp(T, CUE_OUT, TOTAL - 0.12));

  const runEnd = CUE_SPARKLE + 0.62;
  const starP = sparkle ? ramp(T, CUE_SPARKLE, runEnd) : 0;
  const starFade = glide(T, CUE_SPARKLE, CUE_SPARKLE + 0.1) * (1 - ramp(T, runEnd, runEnd + 0.08));
  const bloomP = sparkle ? ramp(T, runEnd - 0.05, runEnd + 0.5) : 0;

  // letterSpacing u RN je u px, ne u em — pretvaramo preko font size.
  const nameSize = Math.round(size * 0.19);
  const tagSize = Math.round(size * 0.075);

  return (
    <View style={styles.root}>
      <View style={{ width: size, height: size, opacity: outFade, transform: [{ scale: coinScale }] }}>
        <Svg viewBox="-60 -60 120 120" width={size} height={size}>
          <Defs>
            <RadialGradient id={`halo-blue-${uid}`}>
              <Stop offset="0%" stopColor="#EAF4FF" stopOpacity={0.95} />
              <Stop offset="35%" stopColor="#9CC8FF" stopOpacity={0.42} />
              <Stop offset="100%" stopColor="#378ADD" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id={`halo-rose-${uid}`}>
              <Stop offset="0%" stopColor="#FFF0F6" stopOpacity={0.95} />
              <Stop offset="35%" stopColor="#FFC0D8" stopOpacity={0.42} />
              <Stop offset="100%" stopColor="#ED93B1" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id={`halo-bloom-${uid}`}>
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.95} />
              <Stop offset="45%" stopColor="#DCEBFF" stopOpacity={0.45} />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>

          <G rotation={unitSpin} opacity={halfOpacity}>
            <G x={gap * 0.13}><G rotation={halfSpin}>
              <Path d={D_BLUE} fill={BLUE} />
            </G></G>
            <G x={-gap * 0.13}><G rotation={-halfSpin}>
              <Path d={D_ROSE} fill={ROSE} />
            </G></G>
          </G>

          <G opacity={starFade}>
            <Star side="blue" p={starP} tint="#BFDCFF" uid={uid} />
            <Star side="rose" p={starP} tint="#FFCBDD" uid={uid} />
          </G>
          <Bloom p={bloomP} uid={uid} />
        </Svg>
      </View>

      {showName ? (
        <View style={styles.type}>
          <Text style={[styles.name, {
            fontFamily, fontSize: nameSize, opacity: nameOpacity,
            letterSpacing: nameLs * nameSize,
            marginLeft: nameLs * nameSize,
            transform: [{ translateY: nameY }],
          }]}>DUO TRACKER</Text>
          {showTagline ? (
            <Text style={[styles.tag, {
              fontFamily, fontSize: tagSize, opacity: tagOpacity,
              letterSpacing: 0.24 * tagSize, marginLeft: 0.24 * tagSize,
            }]}>{tagline.toUpperCase()}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  type: { marginTop: 56, alignItems: 'center' },
  name: { color: '#F2F6FC', fontWeight: '500' },
  tag: { color: 'rgba(215,230,248,0.66)', fontWeight: '300', marginTop: 14 },
});
