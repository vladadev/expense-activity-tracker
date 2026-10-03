// Blending one palette into another.
//
// The app crosses from day to night rather than cutting, and a cut is what you
// get for free: change the palette and every screen redraws in the new colours
// on the next frame. Crossing means there has to be a palette for every moment
// in between, and this is where it comes from — the whole set blended at once,
// so a card, its border, its text and the water behind it all arrive together
// instead of in whatever order their components happen to re-render.
//
// Pure, and separate from the context that drives it, because the arithmetic
// is the part that can be wrong without anyone noticing: a channel clamped at
// 255, a three-digit hex not expanded, a value that is 1 step short of the
// colour it was supposed to land on.

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function channels(hex) {
  const clean = hex.slice(1);
  const full = clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hex2(n) {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();
}

export function isColour(value) {
  return typeof value === 'string' && HEX.test(value);
}

// t = 0 gives a exactly, t = 1 gives b exactly. Returned verbatim at the ends
// rather than round-tripped through the arithmetic, so a palette that is not
// crossing is identical to the one in palettes.js — including its string
// identity, which is what lets a memo on the theme object stay still.
export function mixHex(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const [r1, g1, b1] = channels(a);
  const [r2, g2, b2] = channels(b);
  return `#${hex2(r1 + (r2 - r1) * t)}${hex2(g1 + (g2 - g1) * t)}${hex2(b1 + (b2 - b1) * t)}`;
}

// Every colour blends; everything else — isDark, the status bar style, the
// label — belongs to whichever side the crossing is nearer. They are not
// quantities and there is no halfway: a border is either on a dark ground or
// it is not, and the one moment it changes is the middle of the crossing,
// which is also the moment the sky has got there.
export function mixPalette(from, to, t) {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const dominant = t < 0.5 ? from : to;
  const out = {};
  for (const key of Object.keys(to)) {
    const a = from[key];
    const b = to[key];
    out[key] = isColour(a) && isColour(b) ? mixHex(a, b, t) : dominant[key];
  }
  return out;
}
