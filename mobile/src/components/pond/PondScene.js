import React, { useEffect, useMemo, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle, Ellipse, Defs, LinearGradient, RadialGradient, Stop, G, ClipPath } from 'react-native-svg';
import {
  wavePath,
  SCENE,
  mountainPath,
  mountainLit,
  mountainSnow,
  mountainGullies,
  treeLine,
  RANGE_FAR,
  RANGE_MID,
  reedStem,
  reedBlade,
  reedHead,
  REEDS_LEFT,
  REEDS_RIGHT,
  PAD_SHAPES,
  LEAF_VIEWBOX,
} from './geometry';
import { mixHex } from '../../theme/mix';
import { motion } from '../../theme/scale';
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

// Three pads, three leaves. `shape` picks which of the three bodies in
// geometry.js it is; `tint` shades its fill, because on a real pond no two are
// the same green either. `lift` is how far it rises on the swell — the one
// nearest the front rides highest, which is also the only depth cue water has.
const PADS = [
  { x: 0.16, y: 0.63, w: 54, delay: 0, opacity: 0.74, shape: 1, tint: 0.34, lift: 4.5, tilt: 1.6 },
  // The perch. Its place comes from SCENE so the frog's reserved slot cannot
  // drift away from the pad it is supposed to be sitting on.
  {
    x: SCENE.perchX,
    y: SCENE.perchY,
    w: 48,
    delay: 1400,
    opacity: 0.82,
    shape: 2,
    tint: 0.18,
    lift: 3.5,
    tilt: 1.1,
  },
  { x: 0.38, y: 0.76, w: 68, delay: 600, opacity: 1, shape: 0, tint: 0, lift: 6.5, tilt: 2.2 },
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
  mtnFar: '#0F5446',
  mtnFarLit: '#1A7563',
  mtnMid: '#0A463B',
  mtnMidLit: '#136356',
  snow: '#D7EFE2',
  ridgeFar: '#083A31',
  ridgeNear: '#06302A',
  ridgeLight: '#2E8A72',
  ripple: '#9FE3CC',
  padShadow: '#063029',
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
  mtnFar: '#09262E',
  mtnFarLit: '#113B47',
  mtnMid: '#061C23',
  mtnMidLit: '#0C2E39',
  snow: '#B9D4E6',
  ridgeFar: '#05191F',
  ridgeNear: '#03161C',
  ridgeLight: '#1A4A58',
  ripple: '#7FB6C9',
  padShadow: '#020E12',
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

// What the pad does to the water it sits on: a shadow that stays put, and two
// rings spreading out from under it.
//
// The rings are the point. A leaf that bobs on water nobody can see is a leaf
// bobbing in mid-air — the movement has nothing to be movement against. These
// are what say there is a surface there, and they are deliberately slower than
// the bob and out of step with it, so the two never beat together.
// One ring, leaving the pad and fading out. Lifted wholesale from the leaf in
// the tab bar, down to the counts, because they are the same pond and anything
// that behaves differently reads as a different kind of water.
const RIPPLE_MS = 5200;
const RIPPLE_STAGGER = 1700;

function PadRipple({ delay, colour, w, h }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, { toValue: 1, duration: RIPPLE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
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
        opacity: t.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.45, 0] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.5] }) }],
      }}
    >
      <Svg width={w} height={h}>
        <Ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 1} ry={h / 2 - 1} stroke={colour} strokeWidth={1.3} fill="none" />
      </Svg>
    </Animated.View>
  );
}

// What the pad does to the water it sits on: a shadow that stays put, and
// THREE rings leaving on staggered counts.
//
// Three, and staggered, is the whole thing. Two rings expanding together read
// as a halo around the leaf; one leaving every 1.7 seconds reads as a surface
// being disturbed, which is what it is. The leaf in the tab bar has done it
// this way since it was drawn, and this is the same pond.
function PadWater({ left, top, w, h, delay, colours }) {
  const box = w * 1.8;
  const boxH = box * 0.42;
  const place = {
    position: 'absolute',
    left: left + w / 2 - box / 2,
    top: top + h / 2 - boxH / 2,
    width: box,
    height: boxH,
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <>
      <Svg
        width={w * 1.1}
        height={h * 1.1}
        style={{ position: 'absolute', left: left - w * 0.05, top: top - h * 0.05 + h * 0.2 }}
        pointerEvents="none"
      >
        <Ellipse
          cx={w * 0.55}
          cy={h * 0.55}
          rx={w * 0.5}
          ry={h * 0.46}
          fill={colours.padShadow}
          opacity={0.32}
        />
      </Svg>
      <View style={place} pointerEvents="none">
        {[0, RIPPLE_STAGGER, RIPPLE_STAGGER * 2].map((offset) => (
          <PadRipple key={offset} delay={delay + offset} colour={colours.ripple} w={box} h={boxH} />
        ))}
      </View>
    </>
  );
}

// A clump of reeds, leaning on the wind.
//
// The whole clump turns together, about where it stands rather than about the
// middle of the screen — `transformOrigin` is given the clump's own feet, so
// the tips travel and the bases do not, which is the only way a plant bends.
// The two clumps are on periods that do not divide into each other, so the
// pond never looks like it is breathing.
// A slow lean with a quick flutter riding on top of it.
//
// One rotation on its own is a metronome, whatever its size — the eye finds
// the period in about two passes and then the reeds are a pendulum. Wind is
// not one motion: it is a long push that the plant leans into, and a fast
// jitter on top that never quite repeats with it. Two rotations whose periods
// do not divide into each other give that for almost nothing, because the
// combined angle only comes back to where it started after both have.
function useSway(period, delay) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, { toValue: 1, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [value, period, delay]);
  return value;
}

function ReedClump({ reeds, width, height, colour, period, delay = 0 }) {
  const lean = useSway(period, delay);
  // Roughly a fifth of the long period, offset, and never a whole fraction of
  // it.
  const gust = useSway(Math.round(period * 0.19), delay + 700);

  const base = height * SCENE.reedBase;
  const middle = (reeds.reduce((sum, reed) => sum + reed.x, 0) / reeds.length) * width;
  const origin = { transformOrigin: [middle, base] };

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        ...StyleSheet.absoluteFillObject,
        ...origin,
        transform: [{ rotate: lean.interpolate({ inputRange: [0, 1], outputRange: ['-5.4deg', '5.8deg'] }) }],
      }}
    >
    <Animated.View
      pointerEvents="none"
      style={{
        ...StyleSheet.absoluteFillObject,
        ...origin,
        transform: [{ rotate: gust.interpolate({ inputRange: [0, 1], outputRange: ['-1.6deg', '1.9deg'] }) }],
      }}
    >
      <Svg width={width} height={height}>
        {reeds.map((reed) => {
          const x = width * reed.x;
          const h = height * reed.h;
          const head = reed.head ? reedHead(x, base, h, reed.lean) : null;
          return (
            <G key={`${reed.x}`}>
              {reed.blade !== 0 && <Path d={reedBlade(x, base, h * 0.82, reed.blade)} fill={colour} opacity={0.85} />}
              <Path
                d={reedStem(x, base, h, reed.lean)}
                stroke={colour}
                strokeWidth={reed.head ? 2.2 : 1.6}
                strokeLinecap="round"
                fill="none"
              />
              {head && <Ellipse cx={head.cx} cy={head.cy} rx={head.rx} ry={head.ry} fill={colour} />}
            </G>
          );
        })}
      </Svg>
    </Animated.View>
    </Animated.View>
  );
}

function FloatingPad({ left, top, w, h, pad, colours }) {
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

  const shape = PAD_SHAPES[pad.shape];
  // No two the same green. The tint walks the fill toward the vein colour,
  // which keeps every pad inside the palette rather than beside it.
  const fill = pad.tint ? mixHex(colours.padFill, colours.padVein, pad.tint) : colours.padFill;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left,
        top,
        opacity: pad.opacity,
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -pad.lift] }) },
          {
            rotate: t.interpolate({
              inputRange: [0, 1],
              outputRange: [`-${pad.tilt}deg`, `${pad.tilt * 1.15}deg`],
            }),
          },
        ],
      }}
    >
      <Svg width={w} height={h} viewBox={`0 0 ${LEAF_VIEWBOX.width} ${LEAF_VIEWBOX.height}`}>
        <Path d={shape.body} fill={fill} stroke={colours.padRim} strokeWidth={shape.rim} strokeLinejoin="round" />
        {shape.veins.map((d) => (
          <Path key={d} d={d} stroke={colours.padVein} strokeWidth={4.2} strokeLinecap="round" opacity={0.85} />
        ))}
        <Path d={shape.sheen} stroke={colours.sheen} strokeWidth={6} strokeLinecap="round" fill="none" opacity={0.32} />
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
  const far = useLoop(motion.waveFar);
  const mid = useLoop(motion.waveMid);
  const near = useLoop(motion.waveNear);
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
          <LinearGradient {...{ id: `${uid}-pondHaze` }} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.skyLow} stopOpacity="0" />
            <Stop offset="1" stopColor={c.skyLow} stopOpacity="0.85" />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width={width} height={height} fill={`url(#${uid}-pondSky)`} />

        {/* Each mountain is shaded on its own: a dark body, a lit half
            meeting it along the ridgeline, snow on the high ones and a couple
            of gullies creasing the lit side. One flat silhouette has no faces
            for light to fall on, which is why the last attempt came back as
            triangles thrown one over another. */}
        {[
          { peaks: RANGE_FAR, rise: SCENE.mountainRiseFar, fill: c.mtnFar, lit: c.mtnFarLit, opacity: 0.9 },
          { peaks: RANGE_MID, rise: SCENE.mountainRiseMid, fill: c.mtnMid, lit: c.mtnMidLit, opacity: 0.96 },
        ].map((range) => {
          const base = height * SCENE.mountainBase;
          const rise = height * range.rise;
          return (
            <G key={range.fill} opacity={range.opacity}>
              {range.peaks.map((peak) => (
                <G key={peak.x}>
                  <Path d={mountainPath(width, base, rise, peak)} fill={range.fill} />
                  <Path d={mountainLit(width, base, rise, peak)} fill={range.lit} />
                  {mountainGullies(width, base, rise, peak).map((d) => (
                    <Path key={d} d={d} stroke={range.fill} strokeWidth={1.1} fill="none" opacity={0.55} />
                  ))}
                  {peak.snow && <Path d={mountainSnow(width, base, rise, peak)} fill={c.snow} opacity={0.9} />}
                </G>
              ))}
            </G>
          );
        })}

        {/* Haze at the feet, so the ranges dissolve into distance instead of
            being cut off by whatever is in front of them. */}
        <Rect
          x="0"
          y={height * (SCENE.mountainBase - SCENE.mountainRiseFar * 0.5)}
          width={width}
          height={height * SCENE.mountainRiseFar * 0.5}
          fill={`url(#${uid}-pondHaze)`}
        />

        {/* The treeline on the far shore. It replaces a smoothed silhouette
            that read as an unknown curved line — a soft wave between mountains
            and water is not obviously anything, and a row of uneven conifer
            tops is read as trees at once. */}
        <Path d={treeLine(width, height * SCENE.bankBase, height * SCENE.bankRise)} fill={c.ridgeFar} />
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
          <Path d={wavePath(width, height * SCENE.waveFar, height, 7)} fill={c.waveFar} opacity={0.62} />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, { transform: [{ translateX: shift(mid) }] }]} pointerEvents="none">
        <Svg width={width * 2} height={height}>
          <Path d={wavePath(width, height * SCENE.waveMid, height, 8)} fill={c.waveMid} opacity={0.7} />
        </Svg>
      </Animated.View>
      {/* Reeds stand between the second wave and the third, so the water in
          front covers where they enter it. A plant whose base you can see
          sitting on the surface is a plant lying on the water.
          Each clump leans as one, about its own feet, on its own count — wind
          moves a clump, not a plant. */}
      <ReedClump reeds={REEDS_LEFT} width={width} height={height} colour={c.ridgeNear} period={11000} />
      <ReedClump reeds={REEDS_RIGHT} width={width} height={height} colour={c.ridgeNear} period={14500} delay={2600} />

      <Animated.View style={[styles.layer, { transform: [{ translateX: shift(near) }] }]} pointerEvents="none">
        <Svg width={width * 2} height={height}>
          <Path d={wavePath(width, height * SCENE.waveNear, height, 9)} fill={c.waveNear} opacity={0.72} />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.layer, { width, height }, reflection]} pointerEvents="none">
        {GLINTS.map((g) => (
          <Glint key={`${g.y}-${g.rx}`} x={orbX} y={height * g.y} rx={g.rx} delay={g.delay} colour={c.glint} />
        ))}
      </Animated.View>

      {PADS.map((p) => {
        const w = p.w;
        const h = (w * LEAF_VIEWBOX.height) / LEAF_VIEWBOX.width;
        const left = width * p.x - w / 2;
        const top = height * p.y - h / 2;
        return (
          <React.Fragment key={`${p.x}-${p.y}`}>
            {/* The water first, so the leaf sits on it rather than under it. */}
            <PadWater left={left} top={top} w={w} h={h} delay={p.delay + 900} colours={c} />
            <FloatingPad left={left} top={top} w={w} h={h} pad={p} colours={c} />
          </React.Fragment>
        );
      })}

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
