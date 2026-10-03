import { mixHex, mixPalette, isColour } from '../src/theme/mix';
import { PALETTES } from '../src/theme/palettes';

// The crossing from day to night is a palette per frame, and a palette that is
// subtly wrong does not look broken — it looks like the app is slightly off,
// which nobody reports and nobody can point at. So the arithmetic is pinned
// here: the ends land exactly, the middle is actually the middle, and the
// things that are not quantities do not get averaged.

describe('mixHex', () => {
  it('returns the ends exactly, and the same string it was given', () => {
    expect(mixHex('#07382F', '#0E1512', 0)).toBe('#07382F');
    expect(mixHex('#07382F', '#0E1512', 1)).toBe('#0E1512');
  });

  it('goes past the ends without running off', () => {
    expect(mixHex('#000000', '#FFFFFF', -1)).toBe('#000000');
    expect(mixHex('#000000', '#FFFFFF', 2)).toBe('#FFFFFF');
  });

  it('puts the halfway colour halfway', () => {
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });

  it('blends each channel on its own', () => {
    expect(mixHex('#FF0000', '#0000FF', 0.5)).toBe('#800080');
  });

  it('expands a three-digit hex rather than reading it as a number', () => {
    expect(mixHex('#FFF', '#000', 0)).toBe('#FFF');
    expect(mixHex('#FFF', '#000', 0.5)).toBe('#808080');
  });
});

describe('isColour', () => {
  it('knows a hex colour from everything else in a palette', () => {
    expect(isColour('#0E7C66')).toBe(true);
    expect(isColour('#FFF')).toBe(true);
    expect(isColour('Pond')).toBe(false);
    expect(isColour('dark')).toBe(false);
    expect(isColour(true)).toBe(false);
    expect(isColour(undefined)).toBe(false);
  });
});

describe('mixPalette', () => {
  const day = PALETTES.pondLight;
  const night = PALETTES.pondDark;

  it('hands back the real palette at either end', () => {
    expect(mixPalette(day, night, 0)).toBe(day);
    expect(mixPalette(day, night, 1)).toBe(night);
  });

  it('blends every colour the palette has', () => {
    const mid = mixPalette(day, night, 0.5);
    for (const key of Object.keys(night)) {
      if (!isColour(day[key]) || !isColour(night[key])) continue;
      expect(mid[key]).not.toBe(day[key]);
      expect(mid[key]).not.toBe(night[key]);
      expect(mid[key]).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('leaves no colour behind, so nothing arrives late', () => {
    const mid = mixPalette(day, night, 0.25);
    expect(Object.keys(mid).sort()).toEqual(Object.keys(night).sort());
  });

  // isDark decides whether borders are drawn and which way shadows go. There
  // is no half-dark, so it belongs to the nearer side and turns over once, in
  // the middle, where the sky has also got there.
  it('does not average the things that are not quantities', () => {
    expect(mixPalette(day, night, 0.49).isDark).toBe(false);
    expect(mixPalette(day, night, 0.51).isDark).toBe(true);
    expect(mixPalette(day, night, 0.49).statusBarStyle).toBe(day.statusBarStyle);
    expect(mixPalette(day, night, 0.51).statusBarStyle).toBe(night.statusBarStyle);
  });

  it('crosses back the same way it crossed out', () => {
    expect(mixPalette(night, day, 0.3).background).toBe(mixPalette(day, night, 0.7).background);
  });
});
