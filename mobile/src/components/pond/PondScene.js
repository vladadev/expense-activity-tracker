import React, { useEffect, useMemo, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle, Ellipse, Defs, LinearGradient, RadialGradient, Stop, G, ClipPath } from 'react-native-svg';
import { wavePath, LEAF_VIEWBOX, LEAF_BODY, LEAF_VEINS, LEAF_SHEEN } from './geometry';
import { mixHex } from '../../theme/mix';
import { useTheme } from '../../context/ThemeContext';

// The pond behind the top of a screen.
//
// Sky, a light source, three layers of water at different speeds, a few lily
// pads, and the light broken across the surface. It fades out before the first
// figure on the screen below it: the scene is behind the app, never behind a
// number.
//
// The reflection is the part worth getting right. Light on water has no edges
// and no shape — an early version drew it as a soft-edged wedge and it read as
// a yellow rectangle. It is a column of separate glints, each narrower than
// the last, sliding and fading on counts that never line up.

const GLINTS = [
  { y: 0.47, rx: 19, delay: 0 },
  { y: 0.51, rx: 26, delay: 900 },
  { y: 0.55, rx: 15, delay: 1800 },
  { y: 0.6, rx: 30, delay: 400 },
  { y: 0.64, rx: 12, delay: 2300 },
  { y: 0.69, rx: 23, delay: 1300 },
  { y: 0.74, rx: 10, delay: 2700 },
  { y: 0.79, rx: 18, delay: 700 },
];

const PADS = [
  { x: 0.16, y: 0.63, w: 54, delay: 0, opacity: 0.72 },
  { x: 0.86, y: 0.68, w: 48, delay: 1400, opacity: 0.8 },
  { x: 0.38, y: 0.76, w: 68, delay: 600, opacity: 1 },
];

const DAY = {
  skyTop: '#07382F',
  skyMid: '#0C5648',
  skyLow: '#14735F',
  halo: '#F7C863',
  glint: '#FFE6A8',
  waveFar: '#0B5247',
  waveMid: '#116352',
  waveNear: '#17795F',
  padFill: '#2BB694',
  padRim: '#33C7A3',
  padVein: '#1E9B7E',
  sheen: '#FFFFFF',
  reed: '#06302A',
};

const NIGHT = {
  skyTop: '#040F14',
  skyMid: '#07202A',
  skyLow: '#0A3138',
  halo: '#CFE4F2',
  glint: '#DCEAF4',
  waveFar: '#06252E',
  waveMid: '#082E37',
  waveNear: '#0A3A42',
  padFill: '#136056',
  padRim: '#1C7A68',
  padVein: '#176B5E',
  sheen: '#CFE4F2',
  reed: '#03161C',
};

// Not a choice between two sets any more: every colour in the pond is somewhere
// between them, at whatever hour the app currently thinks it is.
function palette(p) {
  if (p <= 0) return DAY;
  if (p >= 1) return NIGHT;
  const out = {};
  for (const key of Object.keys(DAY)) out[key] = mixHex(DAY[key], NIGHT[key], p);
  return out;
}

const styles = StyleSheet.create({
  // overflow matters now that the light travels: without it the sun carries on
  // across the cards below the scene on its way out.
  wrap: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  layer: { position: 'absolute', left: 0, top: 0 },
});

// The box each light source is drawn in, big enough to hold its halo. Both get
// the same one so they can be swapped without the geometry changing.
const ORB_BOX = 200;
const ORB_C = ORB_BOX / 2;

function useLoop(duration, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration, delay]);
  return v;
}

function FloatingPad({ width, height, pad, colours }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(pad.delay),
        Animated.timing(t, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 4200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t, pad.delay]);

  const h = (pad.w * LEAF_VIEWBOX.height) / LEAF_VIEWBOX.width;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: width * pad.x - pad.w / 2,
        top: height * pad.y - h / 2,
        opacity: pad.opacity,
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -3.5] }) },
          { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-1.2deg', '1.4deg'] }) },
        ],
      }}
    >
      <Svg width={pad.w} height={h} viewBox={`0 0 ${LEAF_VIEWBOX.width} ${LEAF_VIEWBOX.height}`}>
        <Path d={LEAF_BODY} fill={colours.padFill} stroke={colours.padRim} strokeWidth={5} strokeLinejoin="round" />
        {LEAF_VEINS.map((d) => (
          <Path key={d} d={d} stroke={colours.padVein} strokeWidth={4.5} strokeLinecap="round" />
        ))}
        <Path d={LEAF_SHEEN} stroke={colours.sheen} strokeWidth={6} strokeLinecap="round" fill="none" opacity={0.35} />
      </Svg>
    </Animated.View>
  );
}

function Glint({ x, y, rx, delay, colour }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t, delay]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - rx,
        top: y - 3,
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.16] }),
        transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) }],
      }}
    >
      <Svg width={rx * 2} height={6}>
        <Ellipse cx={rx} cy={3} rx={rx} ry={2.4} fill={colour} />
      </Svg>
    </Animated.View>
  );
}

let sceneSeq = 0;

export default function PondScene({ width, height, fadeTo, children }) {
  // The hour of day comes from the theme rather than a prop, so the scene is
  // never a frame behind the screen it sits on, and so a crossing started from
  // anywhere reaches it.
  const { nightness, nightT } = useTheme();
  const c = useMemo(() => palette(nightness), [nightness]);
  // Gradient ids are global in react-native-svg on Android, not scoped to the
  // component, so two scenes rendered at once would steal each other's fills.
  const uid = useRef(`pond${(sceneSeq += 1)}`).current;
  const far = useLoop(34000);
  const mid = useLoop(24000);
  const near = useLoop(17000);
  const shift = (v) => v.interpolate({ inputRange: [0, 1], outputRange: [0, -width] });

  // The light sits high and to the right, and everything else in the scene
  // answers to it: the glints fall below it, the pads carry their sheen on the
  // same side.
  const orbX = width * 0.78;
  const orbY = height * 0.2;

  // The crossing. The sun does not fade where it stands and the moon does not
  // appear in its place — one leaves and the other arrives, from the other
  // side, and for a moment in the middle neither of them is really there.
  //
  // Position is interpolated off the native value, so this runs at the
  // screen's own rate however busy the JS side is repainting the palette.
  const sunStyle = {
    opacity: nightT.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 0.12, 0] }),
    transform: [
      { translateX: nightT.interpolate({ inputRange: [0, 1], outputRange: [0, width * 0.55] }) },
      { translateY: nightT.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.5] }) },
    ],
  };
  const moonStyle = {
    opacity: nightT.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0.12, 1] }),
    transform: [
      { translateX: nightT.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.62, 0] }) },
      { translateY: nightT.interpolate({ inputRange: [0, 1], outputRange: [height * 0.5, 0] }) },
    ],
  };
  // The reflection belongs to whatever is above it, so it dims while nothing
  // is: a column of glints sitting bright under an empty sky is the one thing
  // that would give the crossing away.
  const reflection = {
    opacity: nightT.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.18, 1] }),
  };

  return (
    <View style={[styles.wrap, { width, height }]} pointerEvents="box-none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient {...{ id: `${uid}-pondSky` }} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.skyTop} />
            <Stop offset="0.45" stopColor={c.skyMid} />
            <Stop offset="1" stopColor={c.skyLow} />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width={width} height={height} fill={`url(#${uid}-pondSky)`} />

        <Path
          d={`M0 ${height * 0.38} q ${width * 0.05} -26 ${width * 0.09} -4 q ${width * 0.02} -34 ${width * 0.06} -2 q ${width * 0.035} -22 ${width * 0.06} 2 L${width * 0.21} ${height * 0.46} L0 ${height * 0.46} Z`}
          fill={c.reed}
          opacity={0.5}
        />
        <Path
          d={`M${width} ${height * 0.4} q -${width * 0.04} -30 -${width * 0.08} -6 q -${width * 0.03} -28 -${width * 0.08} -2 L${width * 0.84} ${height * 0.47} L${width} ${height * 0.47} Z`}
          fill={c.reed}
          opacity={0.45}
        />
      </Svg>

      {/* The sun, on its way out. Each light keeps its own colour through the
          crossing — only the sky and the water are in between. */}
      <Animated.View
        style={[styles.layer, { left: orbX - ORB_C, top: orbY - ORB_C }, sunStyle]}
        pointerEvents="none"
      >
        <Svg width={ORB_BOX} height={ORB_BOX}>
          <Defs>
            <RadialGradient {...{ id: `${uid}-sunHalo` }} cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={DAY.halo} stopOpacity="0.8" />
              <Stop offset="0.45" stopColor={DAY.halo} stopOpacity="0.26" />
              <Stop offset="1" stopColor={DAY.halo} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient {...{ id: `${uid}-sun` }} cx="0.5" cy="0.42" r="0.78">
              <Stop offset="0" stopColor="#FFF0CE" />
              <Stop offset="1" stopColor="#F2B33D" />
            </RadialGradient>
          </Defs>
          <Circle cx={ORB_C} cy={ORB_C} r={75.6} fill={`url(#${uid}-sunHalo)`} />
          <Circle cx={ORB_C} cy={ORB_C} r={21} fill={`url(#${uid}-sun)`} />
        </Svg>
      </Animated.View>

      {/* The moon, rising on the other side into the place the sun left. */}
      <Animated.View
        style={[styles.layer, { left: orbX - ORB_C, top: orbY - ORB_C }, moonStyle]}
        pointerEvents="none"
      >
        <Svg width={ORB_BOX} height={ORB_BOX}>
          <Defs>
            <RadialGradient {...{ id: `${uid}-moonHalo` }} cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={NIGHT.halo} stopOpacity="0.5" />
              <Stop offset="0.45" stopColor={NIGHT.halo} stopOpacity="0.14" />
              <Stop offset="1" stopColor={NIGHT.halo} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient {...{ id: `${uid}-moon` }} cx="0.38" cy="0.34" r="0.78">
              <Stop offset="0" stopColor="#FFFDF6" />
              <Stop offset="1" stopColor="#C2BAA9" />
            </RadialGradient>
            <RadialGradient {...{ id: `${uid}-moonTerm` }} cx="0.26" cy="0.3" r="0.95">
              <Stop offset="0.55" stopColor="#0A2028" stopOpacity="0" />
              <Stop offset="1" stopColor="#0A2028" stopOpacity="0.42" />
            </RadialGradient>
            <ClipPath {...{ id: `${uid}-moonClip` }}>
              <Circle cx={ORB_C} cy={ORB_C} r={26} />
            </ClipPath>
          </Defs>
          <Circle cx={ORB_C} cy={ORB_C} r={93.6} fill={`url(#${uid}-moonHalo)`} />
          <Circle cx={ORB_C} cy={ORB_C} r={26} fill={`url(#${uid}-moon)`} />
          <G clipPath={`url(#${uid}-moonClip)`}>
            <Circle cx={ORB_C - 8} cy={ORB_C - 10} r={7} fill="#C8BFAE" opacity={0.55} />
            <Circle cx={ORB_C - 8} cy={ORB_C - 10} r={4.6} fill="#D9D1C1" opacity={0.6} />
            <Circle cx={ORB_C + 9} cy={ORB_C + 10} r={5.4} fill="#C8BFAE" opacity={0.5} />
            <Circle cx={ORB_C + 3} cy={ORB_C - 15} r={3} fill="#CCC3B2" opacity={0.5} />
            <Circle cx={ORB_C - 14} cy={ORB_C + 8} r={3.6} fill="#CCC3B2" opacity={0.45} />
            <Rect x={ORB_C - 26} y={ORB_C - 26} width={52} height={52} fill={`url(#${uid}-moonTerm)`} />
          </G>
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.layer, { transform: [{ translateX: shift(far) }] }]} pointerEvents="none">
        <Svg width={width * 2} height={height}>
          <Path d={wavePath(width, height * 0.45, height, 7)} fill={c.waveFar} opacity={0.62} />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, { transform: [{ translateX: shift(mid) }] }]} pointerEvents="none">
        <Svg width={width * 2} height={height}>
          <Path d={wavePath(width, height * 0.53, height, 8)} fill={c.waveMid} opacity={0.7} />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, { transform: [{ translateX: shift(near) }] }]} pointerEvents="none">
        <Svg width={width * 2} height={height}>
          <Path d={wavePath(width, height * 0.62, height, 9)} fill={c.waveNear} opacity={0.72} />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.layer, { width, height }, reflection]} pointerEvents="none">
        {GLINTS.map((g) => (
          <Glint key={`${g.y}-${g.rx}`} x={orbX} y={height * g.y} rx={g.rx} delay={g.delay} colour={c.glint} />
        ))}
      </Animated.View>

      {PADS.map((p) => (
        <FloatingPad key={`${p.x}-${p.y}`} width={width} height={height} pad={p} colours={c} />
      ))}

      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient {...{ id: `${uid}-pondFade` }} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={fadeTo} stopOpacity="0" />
            <Stop offset="0.6" stopColor={fadeTo} stopOpacity="0.72" />
            <Stop offset="0.88" stopColor={fadeTo} stopOpacity="0.98" />
            <Stop offset="1" stopColor={fadeTo} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y={height * 0.5} width={width} height={height * 0.5} fill={`url(#${uid}-pondFade)`} />
      </Svg>

      {children}
    </View>
  );
}
