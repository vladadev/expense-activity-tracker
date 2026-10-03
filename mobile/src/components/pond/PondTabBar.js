import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Defs, LinearGradient, RadialGradient, Stop, Ellipse, G } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { tapLight } from '../../utils/haptics';
import { TAB_ICONS } from './PondIcons';
import {
  BAND_H,
  BAR_H,
  BAY_HALF,
  PAD_WIDTH,
  GUTTER,
  LEAF_VIEWBOX,
  LEAF_BODY,
  LEAF_VEINS,
  LEAF_SHEEN,
  barPath,
  wavePath,
  tabCentres,
} from './geometry';

// The bar is the far edge of the pond.
//
// Water runs the full width above it and fades up into the screen, the bar's
// own edge dips into a bay under a lily pad, and the pad marks where you are.
// Tap another tab and it swims across with the bay travelling alongside, so
// the edge cradles the leaf the whole way rather than waiting at the far end.
//
// The bay is cut into the bar's own path, not patched over it. The first
// attempt laid a separate water-coloured shape on top of a straight edge,
// which is cheaper to animate and looks it: whatever that patch is filled with
// shows as a block against the water behind. Cutting the bay means there is
// nothing there, and the real water shows through.
//
// Reshaping a path cannot be handed to the native animation driver, so the
// crossing runs in JavaScript and the leaf is driven by the same values in the
// same pass. Two drivers would put the leaf and its bay one frame apart, which
// is exactly the tearing that drag and drop in this app was built to avoid.

const SWIM_MS = 340;
const WAVE_FAR_MS = 26000;
const WAVE_NEAR_MS = 17000;
const BOB_MS = 4600;
const RIPPLE_MS = 5200;
const LEAF_H = (PAD_WIDTH * LEAF_VIEWBOX.height) / LEAF_VIEWBOX.width;

function pondColours(isDark, theme) {
  if (isDark) {
    return {
      bar: '#16201C',
      water: '#1B4A44',
      waveFar: '#17564C',
      waveNear: '#1E6A5C',
      leafFill: '#2A6B59',
      leafDeep: '#174A3E',
      leafRim: '#36A184',
      leafVein: '#2E8C73',
      sheen: '#CFE4F2',
      ripple: '#36A184',
      active: theme.primary,
      idle: '#6F827B',
    };
  }
  return {
    bar: '#FFFFFF',
    water: '#9FD4C3',
    waveFar: '#A8DCCB',
    waveNear: '#8FCDB7',
    leafFill: '#D7EDE6',
    leafDeep: '#A8D8C5',
    leafRim: '#7FC9B2',
    leafVein: '#8FCDB7',
    sheen: '#FFFFFF',
    ripple: '#7FC9B2',
    active: theme.primary,
    idle: '#97A09A',
  };
}

// Three of them, leaving on staggered counts, so the surface is never still
// and never busy. They run whether or not anything is moving — a leaf sitting
// on water still makes rings.
function Ripple({ delay, colour, size }) {
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
      <Svg width={size} height={size * 0.42}>
        <Ellipse
          cx={size / 2}
          cy={size * 0.21}
          rx={size / 2 - 1}
          ry={size * 0.21 - 1}
          fill="none"
          stroke={colour}
          strokeWidth={1.2}
        />
      </Svg>
    </Animated.View>
  );
}

export default function PondTabBar({ state, descriptors, navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const c = useMemo(() => pondColours(theme.isDark, theme), [theme]);

  const height = BAND_H + BAR_H + insets.bottom;
  const routes = state.routes;
  const centres = useMemo(() => tabCentres(routes.length, width, GUTTER), [routes.length, width]);
  const styles = useMemo(() => createStyles(theme, c, insets.bottom, height), [theme, c, insets.bottom, height]);

  // Where the leaf is, in pixels across the bar. It is state rather than an
  // Animated value alone because the bar's own path is redrawn from it.
  const [leafX, setLeafX] = useState(() => centres[state.index] || width / 2);
  const [settled, setSettled] = useState(state.index);
  const swim = useRef(new Animated.Value(centres[state.index] || width / 2)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const driftFar = useRef(new Animated.Value(0)).current;
  const driftNear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = swim.addListener(({ value }) => setLeafX(value));
    return () => swim.removeListener(id);
  }, [swim]);

  // The leaf is never still: it lifts, slides a little sideways and swings a
  // degree, which is what a leaf does when the water under it moves rather
  // than the leaf itself.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: BOB_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: BOB_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  // Two layers at different speeds, so they never line up. Movement that
  // repeats on a shared beat gets noticed, and noticed movement under a screen
  // full of figures competes with them.
  useEffect(() => {
    const far = Animated.loop(
      Animated.timing(driftFar, { toValue: 1, duration: WAVE_FAR_MS, easing: Easing.linear, useNativeDriver: true })
    );
    const near = Animated.loop(
      Animated.timing(driftNear, { toValue: 1, duration: WAVE_NEAR_MS, easing: Easing.linear, useNativeDriver: true })
    );
    far.start();
    near.start();
    return () => {
      far.stop();
      near.stop();
    };
  }, [driftFar, driftNear]);

  useEffect(() => {
    const target = centres[state.index];
    if (target == null) return undefined;
    const run = Animated.timing(swim, {
      toValue: target,
      duration: SWIM_MS,
      easing: Easing.out(Easing.cubic),
      // Not the native driver: the bar's path is rebuilt from this value, and
      // a path cannot be rebuilt off the JavaScript thread. Driving the leaf
      // the same way keeps it and its bay in the same frame.
      useNativeDriver: false,
    });
    run.start(({ finished }) => finished && setSettled(state.index));
    return () => run.stop();
  }, [state.index, centres, swim]);

  const lift = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -2.4] });
  const sway = bob.interpolate({ inputRange: [0, 1], outputRange: [-1, 1.2] });
  const tilt = bob.interpolate({ inputRange: [0, 1], outputRange: ['-1.2deg', '1.1deg'] });
  const farShift = driftFar.interpolate({ inputRange: [0, 1], outputRange: [0, -width] });
  const nearShift = driftNear.interpolate({ inputRange: [0, 1], outputRange: [0, -width] });

  const barTop = BAND_H;
  const leafTop = barTop - LEAF_H / 2 + 1;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.water} pointerEvents="none">
        <Svg width={width} height={BAND_H + 10}>
          <Defs>
            <LinearGradient id="pondWater" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.water} stopOpacity="0" />
              <Stop offset="0.45" stopColor={c.water} stopOpacity={theme.isDark ? 0.4 : 0.26} />
              <Stop offset="1" stopColor={c.water} stopOpacity={theme.isDark ? 0.8 : 0.55} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={width} height={BAND_H + 10} fill="url(#pondWater)" />
        </Svg>
        <Animated.View style={[styles.wave, { transform: [{ translateX: farShift }] }]}>
          <Svg width={width * 2} height={BAND_H + 10}>
            <Path d={wavePath(width, BAND_H * 0.52, BAND_H + 10, 4)} fill={c.waveFar} opacity={0.5} />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.wave, { transform: [{ translateX: nearShift }] }]}>
          <Svg width={width * 2} height={BAND_H + 10}>
            <Path d={wavePath(width, BAND_H * 0.74, BAND_H + 10, 5)} fill={c.waveNear} opacity={0.45} />
          </Svg>
        </Animated.View>
      </View>

      <Animated.View
        style={[styles.ripples, { left: leafX - PAD_WIDTH * 0.9, top: barTop - 5, transform: [{ translateY: lift }] }]}
        pointerEvents="none"
      >
        <Ripple delay={0} colour={c.ripple} size={PAD_WIDTH * 1.8} />
        <Ripple delay={1700} colour={c.ripple} size={PAD_WIDTH * 1.8} />
        <Ripple delay={3400} colour={c.ripple} size={PAD_WIDTH * 1.8} />
      </Animated.View>

      <View style={styles.barLayer} pointerEvents="none">
        <Svg width={width} height={height}>
          <Path d={barPath(width, barTop, height, leafX)} fill={c.bar} />
        </Svg>
      </View>

      <Animated.View
        style={[
          styles.leaf,
          {
            left: leafX - PAD_WIDTH / 2,
            top: leafTop,
            transform: [{ translateY: lift }, { translateX: sway }, { rotate: tilt }],
          },
        ]}
        pointerEvents="none"
      >
        <Svg width={PAD_WIDTH} height={LEAF_H} viewBox={`0 0 ${LEAF_VIEWBOX.width} ${LEAF_VIEWBOX.height}`}>
          <Defs>
            <RadialGradient id="pondLeaf" cx="0.42" cy="0.34" r="0.78">
              <Stop offset="0" stopColor={c.leafFill} />
              <Stop offset="1" stopColor={c.leafDeep} />
            </RadialGradient>
          </Defs>
          <G>
            <Path d={LEAF_BODY} fill="url(#pondLeaf)" stroke={c.leafRim} strokeWidth={7} strokeLinejoin="round" />
            {LEAF_VEINS.map((d) => (
              <Path key={d} d={d} stroke={c.leafVein} strokeWidth={5.5} strokeLinecap="round" />
            ))}
            <Path d={LEAF_SHEEN} stroke={c.sheen} strokeWidth={7} strokeLinecap="round" fill="none" opacity={0.45} />
          </G>
        </Svg>
      </Animated.View>

      <View style={[styles.row, { top: barTop }]}>
        {routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const Icon = TAB_ICONS[route.name] || TAB_ICONS.Calendar;
          const isActive = settled === index;
          const colour = isActive ? c.active : c.idle;
          const label = options.tabBarLabel;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isActive && !event.defaultPrevented) {
              tapLight();
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isActive ? { selected: true } : {}}
              accessibilityLabel={typeof label === 'string' ? label : route.name}
              onPress={onPress}
              style={styles.tab}
            >
              <View style={styles.icon}>
                <Icon color={colour} active={isActive} surface={c.bar} />
              </View>
              <Text style={[styles.label, isActive && styles.labelActive, { color: colour }]} numberOfLines={1}>
                {typeof label === 'string' ? label : route.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(theme, c, bottomInset, height) {
  return StyleSheet.create({
    wrap: { height, backgroundColor: 'transparent' },
    water: { position: 'absolute', left: 0, right: 0, top: 0, height: BAND_H + 10, overflow: 'hidden' },
    wave: { position: 'absolute', left: 0, top: 0 },
    ripples: { position: 'absolute', width: PAD_WIDTH * 1.8, alignItems: 'center' },
    barLayer: { position: 'absolute', left: 0, right: 0, top: 0 },
    leaf: { position: 'absolute' },
    row: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: BAR_H,
      flexDirection: 'row',
      paddingTop: 11,
      paddingHorizontal: GUTTER,
    },
    // A basis of zero, not flexGrow alone: with `auto`, every tab starts at
    // the width of its own label and the columns are never equal, which puts
    // the leaf beside the icon it is marking rather than under it.
    tab: { flex: 1, flexBasis: 0, minWidth: 0, alignItems: 'center' },
    icon: { height: 26, justifyContent: 'center' },
    label: { fontSize: 11, marginTop: 3, fontFamily: 'IBMPlexSans_400Regular' },
    labelActive: { fontFamily: 'IBMPlexSans_600SemiBold' },
  });
}
