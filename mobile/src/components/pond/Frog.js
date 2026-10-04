import React, { useEffect, useMemo, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Ellipse, Defs, RadialGradient, Stop, G, ClipPath } from 'react-native-svg';
import {
  FROG_BOX,
  EYE,
  GROUND,
  HAUNCH_NEAR,
  HAUNCH_FAR,
  TORSO,
  SHADE,
  SHEEN,
  HEAD,
  EYE_BUMPS,
  BROWS,
  MUZZLE,
  MOUTH_OPEN,
  MOUTH_LINE,
  TONGUE,
  NOSTRILS,
  ARM_NEAR,
  ARM_FAR,
  BELLY,
  BACK_TOES,
  FRONT_TOES,
  TOE_PADS,
  SPOTS_HEAD,
  SPOTS_NEAR,
  SPOTS_FAR,
  palette,
} from './frogShapes';
import { useTheme } from '../../context/ThemeContext';

// The frog.
//
// Five movements, each on its own count, and the counts do not divide into
// each other — so the frog never arrives back where it started at the same
// moment twice, which is the whole difference between alive and looping.
//
// It breathes with its whole body. It turns its head. Its eyes travel inside
// that turn, a beat behind it, the way eyes lead and heads follow. It blinks.
// And it shifts its weight on the near haunch, slowest of all.
//
// None of it is large. A mascot that is always doing something is a
// distraction on a screen that also carries what you spent this month; the
// test of each of these is whether you would notice it if you were looking at
// the figures instead. You should not.

let frogSeq = 0;

const BREATHE_MS = 2900;
const TURN_MS = 5200;
const LOOK_MS = 4100;
const SHIFT_MS = 7300;
const NOD_MS = 3300;
const BLINK_MS = 120;
const BLINK_EVERY = 3400;
const MOUTH_HOLD = 5200;

function useLoopValue(build, deps) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(build(v));
    loop.start();
    return () => loop.stop();
  }, deps);
  return v;
}

const swing = (v, ms, hold = 0) =>
  Animated.sequence([
    Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    Animated.delay(hold),
    Animated.timing(v, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    Animated.delay(hold),
  ]);

const styles = StyleSheet.create({
  lid: { position: 'absolute' },
});

export default function Frog({ size = 100, style }) {
  const { theme } = useTheme();
  const c = useMemo(() => palette(theme.isDark), [theme.isDark]);
  // Gradient ids are global in react-native-svg on Android, so two frogs on
  // screen at once would wear each other's colours.
  const uid = useRef(`frog${(frogSeq += 1)}`).current;

  const breath = useLoopValue((v) => swing(v, BREATHE_MS), []);
  const turn = useLoopValue((v) => swing(v, TURN_MS, 1100), []);
  const look = useLoopValue((v) => swing(v, LOOK_MS, 700), []);
  const shift = useLoopValue((v) => swing(v, SHIFT_MS, 1800), []);
  const nod = useLoopValue((v) => swing(v, NOD_MS, 400), []);
  // Mostly open, and every so often it closes its mouth for a moment. A smile
  // held without interruption is a photograph of a smile.
  const mouth = useLoopValue(
    (v) =>
      Animated.sequence([
        Animated.delay(MOUTH_HOLD),
        Animated.timing(v, { toValue: 1, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(260),
        Animated.timing(v, { toValue: 0, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    []
  );
  const blink = useLoopValue(
    (v) =>
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: BLINK_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: BLINK_MS * 1.5, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(BLINK_EVERY),
      ]),
    []
  );

  const k = size / FROG_BOX;
  const at = (n) => n * k;
  const box = { width: size, height: size };

  // Breathing, anchored at the ground. The whole frog used to rise and fall,
  // which reads as the picture being moved rather than as a creature filling
  // its chest — so it is held at its feet and only swells.
  const body = {
    transformOrigin: [at(100), at(184)],
    transform: [
      { scaleY: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) },
      { scaleX: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.012] }) },
    ],
  };
  // The head turns about where it meets the body, not about the middle of the
  // picture — a head that pivots on its own chin is a head on a spike.
  const head = {
    transformOrigin: [at(98), at(112)],
    transform: [
      { rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['-4.5deg', '3.5deg'] }) },
      { translateX: turn.interpolate({ inputRange: [0, 1], outputRange: [at(-1.5), at(1.5)] }) },
      // A nod of its own, on a count that has nothing to do with the turn.
      { translateY: nod.interpolate({ inputRange: [0, 1], outputRange: [at(1.4), at(-1.8)] }) },
    ],
  };
  // Shuts about the lip line, so the jaw hinges where a jaw does.
  const jaw = {
    transformOrigin: [at(93), at(74)],
    transform: [{ scaleY: mouth.interpolate({ inputRange: [0, 1], outputRange: [1, 0.06] }) }],
  };
  const eyes = {
    transform: [
      { translateX: look.interpolate({ inputRange: [0, 1], outputRange: [at(-2.4), at(2.4)] }) },
      { translateY: look.interpolate({ inputRange: [0, 1], outputRange: [at(0.8), at(-0.6)] }) },
    ],
  };
  // Weight on and off the near leg. The slowest thing it does.
  const leg = {
    transformOrigin: [at(70), at(104)],
    transform: [{ rotate: shift.interpolate({ inputRange: [0, 1], outputRange: ['-1.6deg', '2.2deg'] }) }],
  };

  const lid = (eye) => ({
    left: at(eye.cx - eye.rx),
    top: at(eye.cy - eye.ry),
    width: at(eye.rx * 2),
    height: at(eye.ry * 2),
    borderRadius: at(eye.rx),
    backgroundColor: c.lid,
    borderBottomWidth: Math.max(1, at(2)),
    borderBottomColor: c.edge,
    transformOrigin: 'top',
    transform: [{ scaleY: blink }],
  });

  const spots = (list) =>
    list.map((t) => (
      <Ellipse key={`${t.cx}-${t.cy}`} cx={t.cx} cy={t.cy} rx={t.rx} ry={t.ry} fill={c.spot} opacity={0.45} />
    ));

  const dots = (list, fill) =>
    list.map((t) => (
      <Circle
        key={`${t.cx}-${t.cy}`}
        cx={t.cx}
        cy={t.cy}
        r={t.r}
        fill={fill}
        stroke={c.edge}
        strokeWidth={2}
        strokeOpacity={0.45}
      />
    ));

  return (
    <View style={[box, style]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, body]}>
        {/* The ground and the far side: everything that does not move on its
            own account. */}
        <Svg {...box} viewBox={`0 0 ${FROG_BOX} ${FROG_BOX}`} style={StyleSheet.absoluteFill}>
          <Defs>
            {/* Lit from above and to the near side, the same direction the
                pond is lit from, so the frog belongs to the scene. */}
            <RadialGradient {...{ id: `${uid}-body` }} cx="0.34" cy="0.22" r="0.92">
              <Stop offset="0" stopColor={c.bodyTop} />
              <Stop offset="1" stopColor={c.bodyLow} />
            </RadialGradient>
            <ClipPath {...{ id: `${uid}-cfar` }}>
              <Path d={HAUNCH_FAR} />
            </ClipPath>
          </Defs>

          <Ellipse {...GROUND} fill={c.ground} opacity={0.28} />
          <Path d={HAUNCH_FAR} fill={c.haunchFar} stroke={c.edge} strokeWidth={2.6} strokeOpacity={0.5} />
          <G clipPath={`url(#${uid}-cfar)`}>{spots(SPOTS_FAR)}</G>
          {dots(BACK_TOES.slice(3), c.haunchFar)}
        </Svg>

        {/* The near leg, which takes the weight and gives it back. */}
        <Animated.View style={[StyleSheet.absoluteFill, leg]}>
          <Svg {...box} viewBox={`0 0 ${FROG_BOX} ${FROG_BOX}`}>
            <Defs>
              <ClipPath {...{ id: `${uid}-cnear` }}>
                <Path d={HAUNCH_NEAR} />
              </ClipPath>
            </Defs>
            <Path d={HAUNCH_NEAR} fill={c.haunch} stroke={c.edge} strokeWidth={2.6} strokeOpacity={0.55} />
            <G clipPath={`url(#${uid}-cnear)`}>{spots(SPOTS_NEAR)}</G>
            {dots(BACK_TOES.slice(0, 3), c.haunch)}
          </Svg>
        </Animated.View>

        <Svg {...box} viewBox={`0 0 ${FROG_BOX} ${FROG_BOX}`} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient {...{ id: `${uid}-body2` }} cx="0.34" cy="0.22" r="0.92">
              <Stop offset="0" stopColor={c.bodyTop} />
              <Stop offset="1" stopColor={c.bodyLow} />
            </RadialGradient>
            <RadialGradient {...{ id: `${uid}-belly2` }} cx="0.44" cy="0.3" r="0.8">
              <Stop offset="0" stopColor={c.bellyTop} />
              <Stop offset="1" stopColor={c.bellyLow} />
            </RadialGradient>
            <ClipPath {...{ id: `${uid}-ctorso` }}>
              <Path d={TORSO} />
            </ClipPath>
          </Defs>
          <Path d={TORSO} fill={`url(#${uid}-body2)`} stroke={c.edge} strokeWidth={2.6} strokeOpacity={0.55} />
          {/* A core shadow down the far side and a light along the near one,
              both cut to the body. Loose, they hung outside the silhouette —
              the smudges that were reported. */}
          <G clipPath={`url(#${uid}-ctorso)`}>
            <Path d={SHADE} fill={c.shade} opacity={0.45} />
            <Path d={SHEEN} fill={c.sheen} opacity={0.38} />
          </G>
          <Ellipse {...BELLY} fill={`url(#${uid}-belly2)`} stroke={c.edge} strokeWidth={2} strokeOpacity={0.3} />
          <Path d={ARM_FAR} fill={c.haunchFar} stroke={c.edge} strokeWidth={2.6} strokeOpacity={0.6} />
          {dots(FRONT_TOES.slice(3), c.haunchFar)}
          <Path d={ARM_NEAR} fill={c.limb} stroke={c.edge} strokeWidth={2.6} strokeOpacity={0.6} />
          {dots(FRONT_TOES.slice(0, 3), c.limb)}
          {TOE_PADS.map((t) => (
            <Circle key={`${t.cx}-${t.cy}`} cx={t.cx} cy={t.cy} r={t.r} fill={c.pad} opacity={0.5} />
          ))}
        </Svg>

        {/* The head, which turns as one piece and carries its eyes with it. */}
        <Animated.View style={[StyleSheet.absoluteFill, head]}>
          <Svg {...box} viewBox={`0 0 ${FROG_BOX} ${FROG_BOX}`}>
            <Defs>
              <RadialGradient {...{ id: `${uid}-head` }} cx="0.32" cy="0.2" r="0.95">
                <Stop offset="0" stopColor={c.bodyTop} />
                <Stop offset="1" stopColor={c.bodyLow} />
              </RadialGradient>
              <ClipPath {...{ id: `${uid}-chead` }}>
                <Path d={HEAD} />
                {EYE_BUMPS.map((b) => (
                  <Circle key={`${b.cx}`} cx={b.cx} cy={b.cy} r={b.r} />
                ))}
              </ClipPath>
            </Defs>
            {EYE_BUMPS.map((b) => (
              <Circle
                key={`${b.cx}`}
                cx={b.cx}
                cy={b.cy}
                r={b.r}
                fill={`url(#${uid}-head)`}
                stroke={c.edge}
                strokeWidth={2.6}
                strokeOpacity={0.5}
              />
            ))}
            <Path d={HEAD} fill={`url(#${uid}-head)`} stroke={c.edge} strokeWidth={2.6} strokeOpacity={0.5} />
            {/* Spots and brows cut to the head, and the brows laid on BEFORE
                the whites, so a stray one cannot end up across an eye — which
                is exactly what happened when they went on last. */}
            <G clipPath={`url(#${uid}-chead)`}>
              {spots(SPOTS_HEAD)}
              {BROWS.map((d) => (
                <Path key={d} d={d} stroke={c.edge} strokeWidth={3.6} strokeLinecap="round" fill="none" opacity={0.32} />
              ))}
            </G>
            <Ellipse {...MUZZLE} fill={c.muzzle} opacity={0.5} />
          </Svg>

          {/* The jaw, hinged on the lip line. */}
          <Animated.View style={[StyleSheet.absoluteFill, jaw]}>
            <Svg {...box} viewBox={`0 0 ${FROG_BOX} ${FROG_BOX}`}>
              <Path d={MOUTH_OPEN} fill={c.mouth} />
              <Ellipse {...TONGUE} fill={c.tongue} />
            </Svg>
          </Animated.View>

          <Svg {...box} viewBox={`0 0 ${FROG_BOX} ${FROG_BOX}`} style={StyleSheet.absoluteFill}>
            <Path d={MOUTH_LINE} stroke={c.edge} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.75} />
            {NOSTRILS.map((n) => (
              <Circle key={`${n.cx}`} cx={n.cx} cy={n.cy} r={n.r} fill={c.edge} opacity={0.65} />
            ))}
            {[EYE.near, EYE.far].map((e) => (
              <Ellipse
                key={`${e.cx}`}
                cx={e.cx}
                cy={e.cy}
                rx={e.rx}
                ry={e.ry}
                fill={c.eyeWhite}
                stroke={c.edge}
                strokeWidth={2}
                strokeOpacity={0.4}
              />
            ))}
          </Svg>

          {/* The eyes travel inside the turn, and a beat behind it. */}
          <Animated.View style={[StyleSheet.absoluteFill, eyes]}>
            <Svg {...box} viewBox={`0 0 ${FROG_BOX} ${FROG_BOX}`}>
              <Defs>
                <RadialGradient {...{ id: `${uid}-iris` }} cx="0.4" cy="0.34" r="0.82">
                  <Stop offset="0" stopColor={c.iris} />
                  <Stop offset="1" stopColor={c.pupil} />
                </RadialGradient>
              </Defs>
              {[EYE.near, EYE.far].map((e) => {
                const cx = e.cx + EYE.irisDx;
                const cy = e.cy + EYE.irisDy;
                return (
                  <G key={`${e.cx}`}>
                    <Circle cx={cx} cy={cy} r={e.irisR} fill={`url(#${uid}-iris)`} />
                    <Circle cx={cx} cy={cy} r={e.pupilR} fill={c.pupil} />
                    <Circle cx={cx - e.irisR * 0.34} cy={cy - e.irisR * 0.42} r={e.irisR * 0.3} fill={c.glint} opacity={0.95} />
                    <Circle cx={cx + e.irisR * 0.4} cy={cy + e.irisR * 0.34} r={e.irisR * 0.15} fill={c.glint} opacity={0.5} />
                  </G>
                );
              })}
            </Svg>
          </Animated.View>

          {/* Lids laid over the eyes rather than drawn inside them: animating
              an attribute of an SVG element is how you get a transform that
              silently does nothing on Android. */}
          <Animated.View style={[styles.lid, lid(EYE.near)]} />
          <Animated.View style={[styles.lid, lid(EYE.far)]} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
