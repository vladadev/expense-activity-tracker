import React, { useEffect, useMemo, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle, Defs, LinearGradient, RadialGradient, Stop, G, ClipPath } from 'react-native-svg';
import { wavePath, horizonLayout, HORIZON_HEIGHT } from './geometry';
import { mixHex } from '../../theme/mix';
import { motion } from '../../theme/scale';
import { useTheme } from '../../context/ThemeContext';

// The pond seen from further off.
//
// PondScene is the whole view — three layers of water, floating pads, the
// light broken into glints — and it belongs on a screen with nothing to read.
// This is the sliver of it that fits behind a header on a screen whose job is
// figures: sky, the sun or the moon low over the water, one wave, and then
// calm ground.
//
// One wave, not three, and that is the whole difference. Three layers moving
// at three speeds are noticed, and movement that is noticed above an amount
// competes with the amount. Here the water is a strip at the bottom of the
// strip, and the eye reads it once and leaves it alone.
//
// The sun sits low and clear of the header: the title is on the left, the bell
// and the gear are top right, and anything bright behind either of them makes
// both harder to read. Below the waterline is where nothing else is — and
// where it sits exactly is in geometry.js, with the tests.
//
// It crosses from day to night with the rest of the app: the light goes down
// on one side and the other comes up from the opposite one. Smaller travel
// than the home screen's, because there is less sky here to cross.

const DAY = {
  skyTop: '#07382F',
  skyMid: '#0C5648',
  skyLow: '#14735F',
  wave: '#17795F',
};

const NIGHT = {
  skyTop: '#040F14',
  skyMid: '#07202A',
  skyLow: '#0A3138',
  wave: '#0A3A42',
};

const SUN_HALO = '#F7C863';
const MOON_HALO = '#CFE4F2';

function palette(p) {
  if (p <= 0) return DAY;
  if (p >= 1) return NIGHT;
  const out = {};
  for (const key of Object.keys(DAY)) out[key] = mixHex(DAY[key], NIGHT[key], p);
  return out;
}

const ORB_BOX = 120;
const ORB_C = ORB_BOX / 2;

const styles = StyleSheet.create({
  // The light travels out of the strip, so the strip has to hold it in.
  wrap: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  layer: { position: 'absolute', left: 0, top: 0 },
});

// Gradient ids are global in react-native-svg on Android rather than scoped to
// the component that declares them, so two of these on screen at once — or one
// of these beside a PondScene — would steal each other's fills. Every id this
// component writes carries its own instance's prefix.
let horizonSeq = 0;

export default function PondHorizon({ width, height = HORIZON_HEIGHT, fadeTo }) {
  const { nightness, nightT } = useTheme();
  const c = useMemo(() => palette(nightness), [nightness]);
  const uid = useRef(`horizon${(horizonSeq += 1)}`).current;

  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(drift, {
        toValue: 1,
        duration: motion.waveNear,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  if (!width) return null;

  const { orbX, orbY, crest } = horizonLayout(width, height, 17);

  const sunStyle = {
    opacity: nightT.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 0.12, 0] }),
    transform: [
      { translateX: nightT.interpolate({ inputRange: [0, 1], outputRange: [0, width * 0.42] }) },
      { translateY: nightT.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.3] }) },
    ],
  };
  const moonStyle = {
    opacity: nightT.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0.12, 1] }),
    transform: [
      { translateX: nightT.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.5, 0] }) },
      { translateY: nightT.interpolate({ inputRange: [0, 1], outputRange: [height * 0.3, 0] }) },
    ],
  };

  return (
    <View style={[styles.wrap, { width, height }]} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient {...{ id: `${uid}-sky` }} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.skyTop} />
            <Stop offset="0.5" stopColor={c.skyMid} />
            <Stop offset="1" stopColor={c.skyLow} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill={`url(#${uid}-sky)`} />
      </Svg>

      <Animated.View style={[styles.layer, { left: orbX - ORB_C, top: orbY - ORB_C }, sunStyle]}>
        <Svg width={ORB_BOX} height={ORB_BOX}>
          <Defs>
            {/* 3 radii, not the scene's 3.6: the glow has the header above it
                here, and a wider one reaches the bell. */}
            <RadialGradient {...{ id: `${uid}-sunHalo` }} cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={SUN_HALO} stopOpacity="0.66" />
              <Stop offset="0.45" stopColor={SUN_HALO} stopOpacity="0.22" />
              <Stop offset="1" stopColor={SUN_HALO} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient {...{ id: `${uid}-sun` }} cx="0.5" cy="0.42" r="0.78">
              <Stop offset="0" stopColor="#FFF0CE" />
              <Stop offset="1" stopColor="#F2B33D" />
            </RadialGradient>
          </Defs>
          <Circle cx={ORB_C} cy={ORB_C} r={51} fill={`url(#${uid}-sunHalo)`} />
          <Circle cx={ORB_C} cy={ORB_C} r={17} fill={`url(#${uid}-sun)`} />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.layer, { left: orbX - ORB_C, top: orbY - ORB_C }, moonStyle]}>
        <Svg width={ORB_BOX} height={ORB_BOX}>
          <Defs>
            <RadialGradient {...{ id: `${uid}-moonHalo` }} cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={MOON_HALO} stopOpacity="0.42" />
              <Stop offset="0.45" stopColor={MOON_HALO} stopOpacity="0.12" />
              <Stop offset="1" stopColor={MOON_HALO} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient {...{ id: `${uid}-moon` }} cx="0.38" cy="0.34" r="0.78">
              <Stop offset="0" stopColor="#FFFDF6" />
              <Stop offset="1" stopColor="#C2BAA9" />
            </RadialGradient>
            <ClipPath {...{ id: `${uid}-moonClip` }}>
              <Circle cx={ORB_C} cy={ORB_C} r={15} />
            </ClipPath>
          </Defs>
          <Circle cx={ORB_C} cy={ORB_C} r={45} fill={`url(#${uid}-moonHalo)`} />
          <Circle cx={ORB_C} cy={ORB_C} r={15} fill={`url(#${uid}-moon)`} />
          <G clipPath={`url(#${uid}-moonClip)`}>
            <Circle cx={ORB_C - 5} cy={ORB_C - 6} r={4.2} fill="#C8BFAE" opacity={0.55} />
            <Circle cx={ORB_C + 5} cy={ORB_C + 6} r={3.2} fill="#C8BFAE" opacity={0.5} />
            <Circle cx={ORB_C + 2} cy={ORB_C - 9} r={1.9} fill="#CCC3B2" opacity={0.5} />
          </G>
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          styles.layer,
          { transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -width] }) }] },
        ]}
      >
        <Svg width={width * 2} height={height}>
          <Path d={wavePath(width, crest, height, 4)} fill={c.wave} opacity={0.9} />
        </Svg>
      </Animated.View>

      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient {...{ id: `${uid}-fade` }} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={fadeTo} stopOpacity="0" />
            <Stop offset="0.55" stopColor={fadeTo} stopOpacity="0.55" />
            <Stop offset="1" stopColor={fadeTo} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        {/* The blend starts at the waterline, not above it: the horizon has to
            read as an edge, and an edge that has already begun dissolving by
            the time it arrives reads as fog. */}
        <Rect x="0" y={crest} width={width} height={height - crest} fill={`url(#${uid}-fade)`} />
      </Svg>
    </View>
  );
}
