import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

// Placeholder blocks shaped like the content that is coming.
//
// The highlight is a band that TRANSLATES across each block, not a gradient
// whose stop offsets move: SVG clamps stop offsets to 0..1, so animating them
// past the edge simply pins the gradient and nothing appears to happen.
// Translating a fixed gradient also runs on the native driver, so the sweep
// costs nothing per frame on the JS thread.
//
// One shared clock drives every block, and each block delays by its vertical
// position, so the highlight crosses the screen as a single wave rather than
// every block blinking on its own. react-native-svg is already a dependency;
// expo-linear-gradient would have been a native module and a new build.

const SWEEP_MS = 1600;
const WAVE_REACH = 700; // px of page the wave is spread across at any moment
const MAX_LAG = 0.45; // never delay a block more than this share of one sweep

const SweepContext = createContext(null);

export function SkeletonProvider({ children }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: SWEEP_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  return <SweepContext.Provider value={progress}>{children}</SweepContext.Provider>;
}

export function SkeletonBlock({ width, height, radius = 6, y = 0, style }) {
  const { theme } = useTheme();
  const progress = useContext(SweepContext);
  const [measured, setMeasured] = useState(0);

  const base = theme.isDark ? '#333F4D' : '#E4E7EC';
  const high = theme.isDark ? '#4B5B6E' : '#F3F5F8';

  const lag = Math.min(MAX_LAG, (y / WAVE_REACH) * MAX_LAG);
  const travel = measured * 1.6;

  const translateX = progress
    ? progress.interpolate({
        // Held off the left edge until this block's turn, then swept across.
        inputRange: [0, lag, 1],
        outputRange: [-travel, -travel, travel],
      })
    : null;

  return (
    <View
      style={[{ width, height, borderRadius: radius, backgroundColor: base, overflow: 'hidden' }, style]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w && Math.abs(w - measured) > 1) setMeasured(w);
      }}
    >
      {translateX && measured > 0 ? (
        <Animated.View
          style={{ ...StyleSheet.absoluteFillObject, transform: [{ translateX }] }}
          pointerEvents="none"
        >
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="skSweep" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={high} stopOpacity="0" />
                <Stop offset="0.5" stopColor={high} stopOpacity="1" />
                <Stop offset="1" stopColor={high} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#skSweep)" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

// A skeleton that flashes past reads as a glitch, not as an answer. This
// withholds it until loading has clearly taken a moment, and once shown holds
// it long enough to be seen.
const SHOW_AFTER_MS = 200;
const MIN_VISIBLE_MS = 400;

export function useDeferredSkeleton(loading) {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    let showTimer;
    let hideTimer;
    if (loading && !visible) {
      showTimer = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, SHOW_AFTER_MS);
    } else if (!loading && visible) {
      const held = Date.now() - shownAt.current;
      hideTimer = setTimeout(() => setVisible(false), Math.max(0, MIN_VISIBLE_MS - held));
    }
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [loading, visible]);

  return visible;
}

export function SkeletonCard({ children, style }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return <View style={[styles.card, style]}>{children}</View>;
}

function createStyles(theme) {
  return StyleSheet.create({
    card: { backgroundColor: theme.surface, borderRadius: 12, padding: 14, marginBottom: 10 },
  });
}
