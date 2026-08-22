/* Duo Tracker — shared animation core (React Native).
   Pure math + one clock hook. No dependencies beyond React.
   Ovo je 1:1 port krivih iz odobrene HTML verzije. */

import { useEffect, useRef, useState } from 'react';

export const BLUE = '#378ADD';
export const ROSE = '#ED93B1';
export const NAVY = '#0C447C';

// Dve polovine znaka. viewBox je "-60 -60 120 120" pa je (0,0) centar.
export const D_BLUE = 'M0 -36 A18 18 0 0 1 0 0 A18 18 0 0 0 0 36 A36 36 0 0 0 0 -36 Z';
export const D_ROSE = 'M0 -36 A18 18 0 0 1 0 0 A18 18 0 0 0 0 36 A36 36 0 0 1 0 -36 Z';

const R_OUT = 36;
const R_IN = 18;
const SPLIT = R_OUT / (R_OUT + R_IN); // konstantna brzina zvezdice
const RAD = Math.PI / 180;

export function ramp(t, start, end) {
  if (end <= start) return t >= end ? 1 : 0;
  const p = Math.min(1, Math.max(0, (t - start) / (end - start)));
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

export function glide(t, start, end) {
  if (end <= start) return t >= end ? 1 : 0;
  const p = Math.min(1, Math.max(0, (t - start) / (end - start)));
  return 1 - Math.pow(1 - p, 3);
}

export function settle(t, start, dur, freq) {
  if (t <= start) return 0;
  const p = (t - start) / dur;
  if (p >= 1) return 0;
  return Math.sin(p * Math.PI * 2 * freq) * Math.pow(1 - p, 2.6);
}

/* Tačka na konturi jedne polovine.
   blue: vrh (0,-36) → desni obod → (0,36) → unutra po S-šavu → centar.
   rose: vrh (0,36) → levi obod → (0,-36) → unutra po S-šavu → centar. */
export function edgePoint(side, p) {
  const blue = side === 'blue';
  if (p <= SPLIT) {
    const q = p / SPLIT;
    const a = (blue ? -90 : 90) + 180 * q;
    return { x: R_OUT * Math.cos(a * RAD), y: R_OUT * Math.sin(a * RAD) };
  }
  const q = (p - SPLIT) / (1 - SPLIT);
  const cy = blue ? R_IN : -R_IN;
  const a = (blue ? 90 : 270) + 180 * q;
  return { x: R_IN * Math.cos(a * RAD), y: cy + R_IN * Math.sin(a * RAD) };
}

// Četvorokraka Disney-style zvezdica, nacrtana u jedinicnoj skali.
export const STAR_D =
  'M0 -1 C0.13 -0.3 0.3 -0.13 1 0 C0.3 0.13 0.13 0.3 0 1 C-0.13 0.3 -0.3 0.13 -1 0 C-0.3 -0.13 -0.13 -0.3 0 -1 Z';

/* Jedan sat za celu kompoziciju: vraca vreme u sekundama.
   loop=true vrti u krug (loader, splash koji se ponavlja).
   Poziva onDone kad jednom prodje ceo timeline (loop=false). */
export function useClock(duration, loop = true, onDone) {
  const [t, setT] = useState(0);
  const raf = useRef(null);
  const start = useRef(null);
  const done = useRef(false);
  // Held in a ref rather than a dependency: callers pass an inline arrow, which
  // is a new function on every render, and this component re-renders every
  // frame — as a dependency it tore the clock down and rescheduled it 60 times
  // a second.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const tick = (now) => {
      if (start.current == null) start.current = now;
      const elapsed = (now - start.current) / 1000;
      if (loop) {
        setT(elapsed % duration);
      } else if (elapsed >= duration) {
        setT(duration);
        if (!done.current) {
          done.current = true;
          if (onDoneRef.current) onDoneRef.current();
        }
        return;
      } else {
        setT(elapsed);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => raf.current && cancelAnimationFrame(raf.current);
  }, [duration, loop]);

  return t;
}
