import React, { useEffect, useMemo, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Ellipse, Defs, LinearGradient, RadialGradient, Stop, G } from 'react-native-svg';
import {
  FROG_BOX,
  EYE,
  HAUNCH_LEFT,
  HAUNCH_RIGHT,
  BODY,
  EYE_BUMPS,
  BELLY,
  MOUTH,
  MOUTH_CORNERS,
  NOSTRILS,
  ARM_LEFT,
  ARM_RIGHT,
  TOES,
  BACK_FEET,
  SPOTS,
  palette,
} from './frogShapes';
import { useTheme } from '../../context/ThemeContext';

// The frog.
//
// Three movements, and no more. A mascot that is always doing something is a
// distraction on a screen that also carries what you spent this month; one
// that never moves is a sticker. So it breathes, it blinks, and its eyes drift
// — all three slow, small, and on counts that do not meet.
//
// Breathing is the whole body, a fifteenth of its size, which is under the
// threshold at which movement is consciously noticed and above the one at
// which it is felt. Blinking is two lids over the eyes rather than anything
// inside the drawing, because animating an attribute of an SVG element is how
// you get a transform that silently does nothing. And the eyes drift by two
// points, which is enough to read as looking about and not enough to read as
// anything being wrong.

let frogSeq = 0;

const BREATHE_MS = 3600;
const LOOK_MS = 5400;
// A blink is 140ms of lid; the rest of this is the frog not blinking.
const BLINK_EVERY = 4800;
const BLINK_MS = 140;

function useBreath() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: BREATHE_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: BREATHE_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return v;
}

function useLook() {
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: LOOK_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(900),
        Animated.timing(v, { toValue: 0, duration: LOOK_MS * 1.3, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(1400),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return v;
}

// Shut, open, and then a long wait. Two in a row now and then would be better
// still, but a single blink on an uneven count is already far from a metronome
// at this duration.
function useBlink(delay) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: BLINK_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: BLINK_MS * 1.4, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(BLINK_EVERY),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  return v;
}

const styles = StyleSheet.create({
  lid: { position: 'absolute' },
});

export default function Frog({ size = 100, style }) {
  const { theme } = useTheme();
  const c = useMemo(() => palette(theme.isDark), [theme.isDark]);
  // Gradient ids are global in react-native-svg on Android, so two frogs on
  // screen at once would wear each other's colours.
  const uid = useRef(`frog${(frogSeq += 1)}`).current;

  const breath = useBreath();
  const look = useLook();
  const blink = useBlink(2100);

  const k = size / FROG_BOX;
  const at = (n) => n * k;

  const body = {
    transform: [
      { translateY: breath.interpolate({ inputRange: [0, 1], outputRange: [0, at(-2.5)] }) },
      { scaleY: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) },
      { scaleX: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 0.993] }) },
    ],
  };
  const eyes = {
    transform: [{ translateX: look.interpolate({ inputRange: [0, 1], outputRange: [at(-2), at(2)] }) }],
  };
  const lid = (eye) => ({
    left: at(eye.cx - EYE.rx),
    top: at(eye.cy - EYE.ry),
    width: at(EYE.rx * 2),
    height: at(EYE.ry * 2),
    borderRadius: at(EYE.rx),
    backgroundColor: c.lid,
    transformOrigin: 'top',
    transform: [{ scaleY: blink }],
  });

  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, body]}>
        <Svg width={size} height={size} viewBox={`0 0 ${FROG_BOX} ${FROG_BOX}`}>
          <Defs>
            {/* Light from above and slightly left, the same direction the pond
                is lit from, so the frog belongs to the scene it sits in. */}
            <LinearGradient {...{ id: `${uid}-body` }} x1="0.3" y1="0" x2="0.6" y2="1">
              <Stop offset="0" stopColor={c.bodyTop} />
              <Stop offset="1" stopColor={c.bodyLow} />
            </LinearGradient>
            <RadialGradient {...{ id: `${uid}-belly` }} cx="0.5" cy="0.34" r="0.78">
              <Stop offset="0" stopColor={c.bellyTop} />
              <Stop offset="1" stopColor={c.bellyLow} />
            </RadialGradient>
          </Defs>

          <Path d={HAUNCH_LEFT} fill={c.haunch} />
          <Path d={HAUNCH_RIGHT} fill={c.haunch} />
          {BACK_FEET.map((f) => (
            <Circle key={`${f.cx}`} cx={f.cx} cy={f.cy} r={f.r} fill={c.haunch} />
          ))}

          <Path d={ARM_LEFT} fill={c.bodyLow} />
          <Path d={ARM_RIGHT} fill={c.bodyLow} />
          {TOES.map((t) => (
            <Circle key={`${t.cx}-${t.cy}`} cx={t.cx} cy={t.cy} r={t.r} fill={c.bodyLow} />
          ))}

          {EYE_BUMPS.map((b) => (
            <Circle key={`${b.cx}`} cx={b.cx} cy={b.cy} r={b.r} fill={`url(#${uid}-body)`} />
          ))}
          <Path d={BODY} fill={`url(#${uid}-body)`} />

          {SPOTS.map((s) => (
            <Ellipse key={`${s.cx}-${s.cy}`} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={c.spot} opacity={0.65} />
          ))}

          <Ellipse cx={BELLY.cx} cy={BELLY.cy} rx={BELLY.rx} ry={BELLY.ry} fill={`url(#${uid}-belly)`} />

          <Path d={MOUTH} stroke={c.edge} strokeWidth={4.5} strokeLinecap="round" fill="none" />
          {MOUTH_CORNERS.map((m) => (
            <Circle key={`${m.cx}`} cx={m.cx} cy={m.cy} r={m.r} fill={c.edge} />
          ))}
          {NOSTRILS.map((n) => (
            <Circle key={`${n.cx}`} cx={n.cx} cy={n.cy} r={n.r} fill={c.edge} opacity={0.75} />
          ))}

          {[EYE.left, EYE.right].map((e) => (
            <Ellipse key={`${e.cx}`} cx={e.cx} cy={e.cy} rx={EYE.rx} ry={EYE.ry} fill={c.eyeWhite} />
          ))}
        </Svg>

        {/* The irises ride in their own layer so they can drift without the
            whole face going with them. */}
        <Animated.View style={[StyleSheet.absoluteFill, eyes]}>
          <Svg width={size} height={size} viewBox={`0 0 ${FROG_BOX} ${FROG_BOX}`}>
            <Defs>
              <RadialGradient {...{ id: `${uid}-iris2` }} cx="0.42" cy="0.36" r="0.8">
                <Stop offset="0" stopColor={c.iris} />
                <Stop offset="1" stopColor={c.pupil} />
              </RadialGradient>
            </Defs>
            {[EYE.left, EYE.right].map((e, i) => {
              // Both irises turn in towards the middle, which is what stops a
              // pair of eyes looking past you.
              const dx = i === 0 ? EYE.irisDx : -EYE.irisDx;
              return (
                <G key={`${e.cx}`}>
                  <Circle cx={e.cx + dx} cy={e.cy + EYE.irisDy} r={EYE.irisR} fill={`url(#${uid}-iris2)`} />
                  <Circle cx={e.cx + dx} cy={e.cy + EYE.irisDy} r={EYE.pupilR} fill={c.pupil} />
                  <Circle cx={e.cx + dx - 5} cy={e.cy + EYE.irisDy - 6} r={4.6} fill={c.glint} opacity={0.95} />
                  <Circle cx={e.cx + dx + 6} cy={e.cy + EYE.irisDy + 5} r={2.2} fill={c.glint} opacity={0.55} />
                </G>
              );
            })}
          </Svg>
        </Animated.View>

        {/* Lids over the eyes, not inside the drawing. Animating an attribute
            of an SVG element is how you get a transform that silently does
            nothing on Android. */}
        <Animated.View style={[styles.lid, lid(EYE.left)]} />
        <Animated.View style={[styles.lid, lid(EYE.right)]} />
      </Animated.View>
    </View>
  );
}
