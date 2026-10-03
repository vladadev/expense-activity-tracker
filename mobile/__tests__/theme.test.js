import { PALETTES, DEFAULT_THEME } from '../src/theme/palettes';
import { space, radius, type, font, motion, HIT } from '../src/theme/scale';

// A missing colour token does not throw. React Native takes `undefined` as a
// colour and paints nothing, so the failure arrives as white text on white, or
// a border that is simply absent — on one theme only, which is the hardest
// kind to notice. Every palette is therefore checked against every other.
const TOKENS = Object.keys(PALETTES[DEFAULT_THEME]);

describe('palettes', () => {
  it('all define the same tokens', () => {
    const missing = {};
    for (const [name, palette] of Object.entries(PALETTES)) {
      const absent = TOKENS.filter((token) => palette[token] === undefined);
      if (absent.length) missing[name] = absent;
    }
    expect(missing).toEqual({});
  });

  it('none carries a token the others do not', () => {
    const extra = {};
    for (const [name, palette] of Object.entries(PALETTES)) {
      const unknown = Object.keys(palette).filter((token) => !TOKENS.includes(token));
      if (unknown.length) extra[name] = unknown;
    }
    expect(extra).toEqual({});
  });

  it('every colour is a hex value', () => {
    const bad = [];
    for (const [name, palette] of Object.entries(PALETTES)) {
      for (const [token, value] of Object.entries(palette)) {
        if (['label', 'isDark', 'statusBarStyle'].includes(token)) continue;
        if (!/^#[0-9A-Fa-f]{6}$/.test(value)) bad.push(`${name}.${token} = ${value}`);
      }
    }
    expect(bad).toEqual([]);
  });

  // The bar at the top is drawn by the system, not by the app: a dark theme
  // asking for dark icons gets them on a dark background, and the clock
  // disappears.
  it('each theme asks for the status bar that suits it', () => {
    const wrong = Object.entries(PALETTES)
      .filter(([, p]) => p.statusBarStyle !== (p.isDark ? 'light' : 'dark'))
      .map(([name]) => name);
    expect(wrong).toEqual([]);
  });

  it('every theme has a name to show in settings', () => {
    const unnamed = Object.entries(PALETTES)
      .filter(([, p]) => typeof p.label !== 'string' || !p.label.trim())
      .map(([name]) => name);
    expect(unnamed).toEqual([]);
  });

  it('the default theme exists', () => {
    expect(PALETTES[DEFAULT_THEME]).toBeDefined();
  });
});

describe('scale', () => {
  // The values exist so that screens stop inventing their own. A step that
  // drifted off the grid would quietly licence the next one.
  it('spacing is a multiple of four', () => {
    const offGrid = Object.entries(space).filter(([, v]) => v % 4 !== 0);
    expect(offGrid).toEqual([]);
  });

  it('spacing grows', () => {
    const values = [space.xs, space.sm, space.md, space.lg, space.xl];
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(new Set(values).size).toBe(values.length);
  });

  it('a touch target is never below 48', () => {
    expect(HIT).toBeGreaterThanOrEqual(48);
  });

  // A font family naming a weight the app never loads falls back to the system
  // face without a word, which looks almost right and is wrong everywhere.
  const LOADED = [
    'Outfit_300Light',
    'Outfit_500Medium',
    'Outfit_600SemiBold',
    'IBMPlexSans_400Regular',
    'IBMPlexSans_500Medium',
    'IBMPlexSans_600SemiBold',
  ];

  it('every font named is one the app loads', () => {
    const unknown = Object.entries(font)
      .filter(([, family]) => !LOADED.includes(family))
      .map(([key, family]) => `${key} = ${family}`);
    expect(unknown).toEqual([]);
  });

  it('every text style names a loaded font', () => {
    const unknown = Object.entries(type)
      .filter(([, style]) => !LOADED.includes(style.fontFamily))
      .map(([key, style]) => `${key} = ${style.fontFamily}`);
    expect(unknown).toEqual([]);
  });

  it('every text style has room for its own line height', () => {
    const cramped = Object.entries(type)
      .filter(([, s]) => s.lineHeight < s.fontSize)
      .map(([key]) => key);
    expect(cramped).toEqual([]);
  });

  // Digits that shift width make a column of figures ripple as it updates.
  it('amounts are tabular', () => {
    for (const key of ['amountLarge', 'amountMedium', 'amountSmall']) {
      expect(type[key].fontVariant).toEqual(['tabular-nums']);
    }
  });

  it('radii grow', () => {
    expect(radius.control).toBeLessThan(radius.card);
    expect(radius.card).toBeLessThan(radius.pill);
  });

  it('interface motion stays under a third of a second', () => {
    for (const key of ['instant', 'quick', 'settle']) {
      expect(motion[key]).toBeLessThanOrEqual(300);
    }
  });

  // The pond drifts slowly on purpose, and the layers must not share a beat:
  // movement that repeats together is noticed, and noticed movement competes
  // with the figures above it.
  //
  // There is a floor on the other side too, and it was found the hard way: at
  // 34, 24 and 17 seconds the water crossed the screen at about eleven points
  // a second and the pond was reported as a still picture. Slow is the rule.
  // Stopped is a bug.
  it('the water layers never line up', () => {
    const layers = [motion.waveFar, motion.waveMid, motion.waveNear];
    expect(new Set(layers).size).toBe(3);
    for (const ms of layers) {
      expect(ms).toBeGreaterThanOrEqual(8000);
      expect(ms).toBeLessThanOrEqual(24000);
    }
  });

  it('keeps no layer on a whole multiple of another, so they never beat together', () => {
    const layers = [motion.waveFar, motion.waveMid, motion.waveNear];
    for (const a of layers) {
      for (const b of layers) {
        if (a <= b) continue;
        expect(a % b).not.toBe(0);
      }
    }
  });

  // The horizon sits above amounts and the home screen does not, so the one
  // wave on a screen of figures is slower than any of the three on the pond.
  it('keeps the horizon calmer than the water it is a view of', () => {
    expect(motion.waveCalm).toBeGreaterThan(motion.waveFar);
  });
});
