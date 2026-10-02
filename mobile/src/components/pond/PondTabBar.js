import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Defs, LinearGradient, RadialGradient, Stop, Ellipse, G } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import { tapLight } from '../../utils/haptics';
import { TAB_ICONS } from './PondIcons';
import {
  BAR_TOP,
  BAY_DEPTH,
  BAY_HALF,
  PAD_WIDTH,
  PAD_CENTRE_Y,
  LEAF_BODY,
  LEAF_VEINS,
  LEAF_SHEEN,
  tabCentres,
} from './geometry';

// The bar is the far edge of the pond.
//
// Water runs the full width above it and fades up into the screen; the bar's
// own edge dips into a bay under a lily pad, and the pad carries the mark of
// where you are. Tap another tab and the pad swims across, the bay travelling
// with it so the edge cradles the leaf the whole way rather than waiting at
// the far end.
//
// How it is put together matters, because the obvious way does not work. An
// SVG path cannot be animated by changing the string sixty times a second
// without pushing every frame through JavaScript. So the bay is not cut out of
// the bar at all: it is a separate layer painted in the same water, laid over
// the bar's straight edge and slid sideways with an ordinary transform. As
// long as its gradient runs through the same vertical space as the band
// behind, the join is invisible and the bar appears to bend.

const BAND_TOP = 6;
const BAND_BOTTOM = 48;
const BAR_HEIGHT = 64;
const BAR_RADIUS = 26;
const GUTTER = 6;
const LEAF_W = 140;
const LEAF_H = 64;

const SWIM_MS = 320;
const WAVE_FAR_MS = 26000;
const WAVE_NEAR_MS = 17000;

function pondColours(isDark, theme) {
  if (isDark) {
    return {
      bar: '#16201C',
      barEdge: '#27332E',
      waterTop: '#1B4A44',
      waveFar: '#17564C',
      waveNear: '#1A6155',
      leafFill: '#235F4F',
      leafDeep: '#143C33',
      leafRim: '#2E8C73',
      leafVein: '#2A7A66',
      sheen: '#CFE4F2',
      ripple: '#2E8C73',
      active: theme.primary,
      idle: '#6F827B',
      onActive: '#16201C',
    };
  }
  return {
    bar: '#FFFFFF',
    barEdge: 'transparent',
    waterTop: '#9FD4C3',
    waveFar: '#8ACFB8',
    waveNear: '#7FC9B2',
    leafFill: '#DFF2EA',
    leafDeep: '#A8D8C5',
    leafRim: '#8ACFB8',
    leafVein: '#93D3BD',
    sheen: '#FFFFFF',
    ripple: '#7FC9B2',
    active: theme.primary,
    idle: '#97A09A',
    onActive: '#FFFFFF',
  };
}

// Two layers of it, drifting at different speeds so they never line up.
// Movement that repeats on a shared beat gets noticed, and noticed movement
// above a screen full of figures is movement competing with them.
function waveBand({ width, colour, opacity, offset }) {
  const w = width;
  const seg = (x0) =>
    `C ${x0 + w * 0.17} ${offset - 4}, ${x0 + w * 0.3} ${offset + 4}, ${x0 + w * 0.47} ${offset} ` +
    `S ${x0 + w * 0.78} ${offset - 6}, ${x0 + w} ${offset}`;
  return {
    d: `M0 ${offset} ${seg(0)} ${seg(w)} L${w * 2} ${BAND_BOTTOM} L0 ${BAND_BOTTOM} Z`,
    colour,
    opacity,
  };
}

export default function PondTabBar({ state, descriptors, navigation }) {
  const { theme } = useTheme();
  const { t } = useSettings();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const c = useMemo(() => pondColours(theme.isDark, theme), [theme]);
  const styles = useMemo(() => createStyles(theme, c, insets.bottom), [theme, c, insets.bottom]);

  const routes = state.routes;
  const centres = useMemo(() => tabCentres(routes.length, width, GUTTER), [routes.length, width]);

  // Where the leaf is now, in pixels across the bar.
  const [settled, setSettled] = useState(state.index);
  const swimX = useRef(new Animated.Value(centres[state.index] || 0)).current;
  const landing = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const driftFar = useRef(new Animated.Value(0)).current;
  const driftNear = useRef(new Animated.Value(0)).current;

  // The leaf never sits still: it lifts, drifts a little sideways and swings a
  // degree, which is what a leaf does when the water under it moves rather
  // than the leaf itself.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 4500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 4500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

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

  // Crossing to another tab. Nothing claims to be selected until the leaf has
  // arrived, which is why `settled` lags the navigator's own index.
  useEffect(() => {
    const target = centres[state.index];
    if (target == null) return undefined;
    landing.setValue(0);
    const run = Animated.sequence([
      Animated.timing(swimX, {
        toValue: target,
        duration: SWIM_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(landing, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    run.start(({ finished }) => {
      if (finished) setSettled(state.index);
    });
    const id = setTimeout(() => setSettled(state.index), SWIM_MS);
    return () => {
      run.stop();
      clearTimeout(id);
    };
  }, [state.index, centres, swimX, landing]);

  const leafTranslate = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -2.2] });
  const leafDrift = bob.interpolate({ inputRange: [0, 1], outputRange: [-0.9, 1.1] });
  const leafTilt = bob.interpolate({ inputRange: [0, 1], outputRange: ['-1.1deg', '1deg'] });
  const rippleScale = landing.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.45] });
  const rippleFade = landing.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] });

  const farShift = driftFar.interpolate({ inputRange: [0, 1], outputRange: [0, -width] });
  const nearShift = driftNear.interpolate({ inputRange: [0, 1], outputRange: [0, -width] });

  const far = waveBand({ width, colour: c.waveFar, opacity: theme.isDark ? 0.5 : 0.4, offset: 30 });
  const near = waveBand({ width, colour: c.waveNear, opacity: theme.isDark ? 0.45 : 0.35, offset: 35 });

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.band} pointerEvents="none">
        <Svg width={width} height={BAND_BOTTOM}>
          <Defs>
            <LinearGradient id="pondBand" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.waterTop} stopOpacity="0" />
              <Stop offset="0.62" stopColor={c.waterTop} stopOpacity={theme.isDark ? 0.62 : 0.44} />
              <Stop offset="1" stopColor={c.waterTop} stopOpacity={theme.isDark ? 0.85 : 0.62} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y={BAND_TOP} width={width} height={BAND_BOTTOM - BAND_TOP} fill="url(#pondBand)" />
        </Svg>
        <Animated.View style={[styles.waveLayer, { transform: [{ translateX: farShift }] }]}>
          <Svg width={width * 2} height={BAND_BOTTOM}>
            <Path d={far.d} fill={far.colour} opacity={far.opacity} />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.waveLayer, { transform: [{ translateX: nearShift }] }]}>
          <Svg width={width * 2} height={BAND_BOTTOM}>
            <Path d={near.d} fill={near.colour} opacity={near.opacity} />
          </Svg>
        </Animated.View>
      </View>

      <View style={styles.barLayer} pointerEvents="none">
        <Svg width={width} height={BAR_TOP + BAR_HEIGHT}>
          <Rect
            x="0"
            y={BAR_TOP}
            width={width}
            height={BAR_HEIGHT}
            rx={BAR_RADIUS}
            fill={c.bar}
            stroke={c.barEdge}
            strokeWidth={theme.isDark ? 1 : 0}
          />
        </Svg>
      </View>

      <Animated.View
        style={[styles.moving, { transform: [{ translateX: Animated.subtract(swimX, BAY_HALF) }] }]}
        pointerEvents="none"
      >
        <Svg width={BAY_HALF * 2} height={BAND_BOTTOM}>
          <Defs>
            <LinearGradient id="pondBay" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
              <Stop offset="0" stopColor={c.waterTop} stopOpacity="0" />
              <Stop offset="0.62" stopColor={c.waterTop} stopOpacity={theme.isDark ? 0.62 : 0.44} />
              <Stop offset="1" stopColor={c.waterTop} stopOpacity={theme.isDark ? 0.85 : 0.62} />
            </LinearGradient>
          </Defs>
          {/* The bay: water laid over the bar's straight edge, which is what
              makes the edge look bent without any path being animated. */}
          <Path
            d={
              `M0 ${BAR_TOP} ` +
              `C 12 ${BAR_TOP}, 14 ${BAR_TOP + BAY_DEPTH}, ${BAY_HALF} ${BAR_TOP + BAY_DEPTH} ` +
              `C ${BAY_HALF * 2 - 14} ${BAR_TOP + BAY_DEPTH}, ${BAY_HALF * 2 - 12} ${BAR_TOP}, ${BAY_HALF * 2} ${BAR_TOP} ` +
              `L${BAY_HALF * 2} ${BAR_TOP - 1} L0 ${BAR_TOP - 1} Z`
            }
            fill={c.bar}
          />
          <Path
            d={
              `M0 ${BAR_TOP} ` +
              `C 12 ${BAR_TOP}, 14 ${BAR_TOP + BAY_DEPTH}, ${BAY_HALF} ${BAR_TOP + BAY_DEPTH} ` +
              `C ${BAY_HALF * 2 - 14} ${BAR_TOP + BAY_DEPTH}, ${BAY_HALF * 2 - 12} ${BAR_TOP}, ${BAY_HALF * 2} ${BAR_TOP} ` +
              `L${BAY_HALF * 2} ${BAND_TOP} L0 ${BAND_TOP} Z`
            }
            fill="url(#pondBay)"
          />
        </Svg>

        <Animated.View
          style={[
            styles.ripple,
            { transform: [{ scale: rippleScale }], opacity: rippleFade },
          ]}
        >
          <Svg width={PAD_WIDTH * 2} height={20}>
            <Ellipse
              cx={PAD_WIDTH}
              cy={10}
              rx={PAD_WIDTH * 0.8}
              ry={6}
              fill="none"
              stroke={c.ripple}
              strokeWidth={1.3}
            />
          </Svg>
        </Animated.View>

        <Animated.View
          style={[
            styles.leaf,
            {
              transform: [{ translateY: leafTranslate }, { translateX: leafDrift }, { rotate: leafTilt }],
            },
          ]}
        >
          <Svg width={PAD_WIDTH} height={(PAD_WIDTH * LEAF_H) / LEAF_W} viewBox={`0 0 ${LEAF_W} ${LEAF_H}`}>
            <Defs>
              <RadialGradient id="pondLeaf" cx="0.42" cy="0.34" r="0.78">
                <Stop offset="0" stopColor={c.leafFill} />
                <Stop offset="1" stopColor={c.leafDeep} />
              </RadialGradient>
            </Defs>
            <G>
              <Path d={LEAF_BODY} fill="url(#pondLeaf)" stroke={c.leafRim} strokeWidth={7} strokeLinejoin="round" />
              {LEAF_VEINS.map((d) => (
                <Path key={d} d={d} stroke={c.leafVein} strokeWidth={6} strokeLinecap="round" />
              ))}
              <Path d={LEAF_SHEEN} stroke={c.sheen} strokeWidth={8} strokeLinecap="round" fill="none" opacity={0.5} />
            </G>
          </Svg>
        </Animated.View>
      </Animated.View>

      <View style={styles.row}>
        {routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const Icon = TAB_ICONS[route.name] || TAB_ICONS.Calendar;
          const isActive = settled === index;
          const colour = isActive ? c.active : c.idle;
          const label = options.tabBarLabel || route.name;

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
              android_ripple={null}
            >
              <View style={styles.icon}>
                <Icon color={colour} active={isActive} surface={c.bar} />
              </View>
              <Text style={[styles.label, isActive && styles.labelActive, { color: colour }]} numberOfLines={1}>
                {typeof label === 'string' ? label : t('nav.calendar')}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(theme, c, bottomInset) {
  return StyleSheet.create({
    wrap: {
      height: BAR_TOP + BAR_HEIGHT + bottomInset,
      backgroundColor: 'transparent',
    },
    band: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: BAND_BOTTOM,
      overflow: 'hidden',
    },
    waveLayer: { position: 'absolute', left: 0, top: 0 },
    barLayer: { position: 'absolute', left: 0, right: 0, top: 0 },
    moving: { position: 'absolute', left: 0, top: 0, width: BAY_HALF * 2 },
    ripple: {
      position: 'absolute',
      left: BAY_HALF - PAD_WIDTH,
      top: PAD_CENTRE_Y,
      width: PAD_WIDTH * 2,
      alignItems: 'center',
    },
    leaf: {
      position: 'absolute',
      left: BAY_HALF - PAD_WIDTH / 2,
      top: PAD_CENTRE_Y - (PAD_WIDTH * LEAF_H) / LEAF_W / 2,
    },
    row: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: BAR_TOP,
      height: BAR_HEIGHT,
      flexDirection: 'row',
      paddingTop: 11,
      paddingHorizontal: GUTTER,
    },
    // A basis of zero, not flexGrow alone: with `auto`, every tab starts at the
    // width of its own label and the columns are never equal, which puts the
    // leaf beside the icon it is marking rather than under it.
    tab: { flex: 1, flexBasis: 0, minWidth: 0, alignItems: 'center' },
    icon: { height: 26, justifyContent: 'center' },
    label: { fontSize: 11, marginTop: 3, fontFamily: 'IBMPlexSans_400Regular' },
    labelActive: { fontFamily: 'IBMPlexSans_600SemiBold' },
  });
}
