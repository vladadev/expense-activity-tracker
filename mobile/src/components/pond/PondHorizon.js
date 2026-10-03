import React, { useEffect, useMemo, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle, Defs, LinearGradient, RadialGradient, Stop, G, ClipPath } from 'react-native-svg';
import { wavePath, horizonLayout, HORIZON_HEIGHT } from './geometry';
import { motion } from '../../theme/scale';

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

function palette(night) {
  if (night) {
    return {
      skyTop: '#040F14',
      skyMid: '#07202A',
      skyLow: '#0A3138',
      orb: '#F1EADA',
      orbEdge: '#C2BAA9',
      halo: '#CFE4F2',
      wave: '#0A3A42',
    };
  }
  return {
    skyTop: '#07382F',
    skyMid: '#0C5648',
    skyLow: '#14735F',
    orb: '#F7C863',
    orbEdge: '#F2B33D',
    halo: '#F7C863',
    wave: '#17795F',
  };
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, top: 0 },
  layer: { position: 'absolute', left: 0, top: 0 },
});

// Gradient ids are global in react-native-svg on Android rather than scoped to
// the component that declares them, so two of these on screen at once — or one
// of these beside a PondScene — would steal each other's fills. Every id this
// component writes carries its own instance's prefix.
let horizonSeq = 0;

export default function PondHorizon({ width, height = HORIZON_HEIGHT, night, fadeTo }) {
  const c = useMemo(() => palette(night), [night]);
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

  const orbR = night ? 15 : 17;
  const { orbX, orbY, crest } = horizonLayout(width, height, orbR);

  return (
    <View style={[styles.wrap, { width, height }]} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient {...{ id: `${uid}-sky` }} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.skyTop} />
            <Stop offset="0.5" stopColor={c.skyMid} />
            <Stop offset="1" stopColor={c.skyLow} />
          </LinearGradient>
          <RadialGradient {...{ id: `${uid}-halo` }} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={c.halo} stopOpacity={night ? 0.42 : 0.66} />
            <Stop offset="0.45" stopColor={c.halo} stopOpacity={night ? 0.12 : 0.22} />
            <Stop offset="1" stopColor={c.halo} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient {...{ id: `${uid}-orb` }} cx={night ? '0.38' : '0.5'} cy={night ? '0.34' : '0.42'} r="0.78">
            <Stop offset="0" stopColor={night ? '#FFFDF6' : '#FFF0CE'} />
            <Stop offset="1" stopColor={c.orbEdge} />
          </RadialGradient>
          <ClipPath {...{ id: `${uid}-orbClip` }}>
            <Circle cx={orbX} cy={orbY} r={orbR} />
          </ClipPath>
        </Defs>

        <Rect x="0" y="0" width={width} height={height} fill={`url(#${uid}-sky)`} />

        {/* 3 radii, not the scene's 3.6: the glow has the header above it
            here, and a wider one reaches the bell. */}
        <Circle cx={orbX} cy={orbY} r={orbR * 3} fill={`url(#${uid}-halo)`} />
        <Circle cx={orbX} cy={orbY} r={orbR} fill={`url(#${uid}-orb)`} />
        {night && (
          <G clipPath={`url(#${uid}-orbClip)`}>
            <Circle cx={orbX - 5} cy={orbY - 6} r={4.2} fill="#C8BFAE" opacity={0.55} />
            <Circle cx={orbX + 5} cy={orbY + 6} r={3.2} fill="#C8BFAE" opacity={0.5} />
            <Circle cx={orbX + 2} cy={orbY - 9} r={1.9} fill="#CCC3B2" opacity={0.5} />
          </G>
        )}
      </Svg>

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
