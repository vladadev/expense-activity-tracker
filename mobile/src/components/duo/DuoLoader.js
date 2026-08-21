/* Duo Tracker — loader (React Native).
   <DuoLoader size={48} />           inline spinner
   <DuoLoader size={96} swing />     alternativni ritam
   Zahteva: react-native-svg. */

import React from 'react';
import Svg, { Path, G } from 'react-native-svg';
import { BLUE, ROSE, D_BLUE, D_ROSE, useClock } from './duoAnimation';

const LOOP = 1.5; // sekunde po jednom krugu

export default function DuoLoader({ size = 48, swing = false, speed = 1 }) {
  const T = useClock(LOOP / speed, true);
  const phase = (T % (LOOP / speed)) / (LOOP / speed);

  let spin;
  if (swing) {
    const t = phase * 2;
    const i = Math.floor(t);
    const f = t - i;
    const e = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;
    spin = 180 * (i + e);
  } else {
    spin = 360 * phase + 10 * Math.sin(phase * Math.PI * 4);
  }

  // Polovine se malo razmaknu i zatvore; offset nikad nije negativan pa se ne preklapaju.
  const open = (1 - Math.cos(phase * Math.PI * 2)) / 2;
  const gap = 4.6 * open;
  const breath = 1 + 0.045 * open;

  return (
    <Svg viewBox="-60 -60 120 120" width={size} height={size}>
      <G rotation={spin}><G scale={breath}>
        <G x={gap}><Path d={D_BLUE} fill={BLUE} /></G>
        <G x={-gap}><Path d={D_ROSE} fill={ROSE} /></G>
      </G></G>
    </Svg>
  );
}
