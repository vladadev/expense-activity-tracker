import {
  tabCentre,
  tabCentres,
  barPath,
  wavePath,
  horizonLayout,
  smoothThrough,
  SCENE,
  bankPath,
  bankLine,
  mountainPath,
  mountainLit,
  mountainSnow,
  mountainGullies,
  treeLine,
  RANGE_FAR,
  RANGE_MID,
  reedStem,
  reedBlade,
  reedHead,
  BANK,
  REEDS_LEFT,
  REEDS_RIGHT,
  PAD_SHAPES,
  BAY_HALF,
  BAR_RADIUS,
  HORIZON_HEIGHT,
} from '../src/components/pond/geometry';

// The leaf marks which tab you are on, so a centre off by even ten pixels puts
// it beside the icon instead of under it. That happened three times during the
// design, and never because the arithmetic was wrong: the row of tabs only
// looked equal. `flexGrow: 1` hands out the SPARE space evenly while each tab
// still starts at the width of its own label, so "Kalendar" claimed more room
// than "Liste". These tests pin the arithmetic, so the next time it drifts the
// cause is the layout and not the maths.
describe('tabCentre', () => {
  const W = 358;
  const G = 6;

  it('puts four tabs where the design has them', () => {
    expect(tabCentres(4, W, G)).toEqual([49.25, 135.75, 222.25, 308.75]);
  });

  it('spaces every tab equally', () => {
    const centres = tabCentres(5, 390, 8);
    const gaps = centres.slice(1).map((x, i) => +(x - centres[i]).toFixed(6));
    expect(new Set(gaps).size).toBe(1);
  });

  it('is symmetric about the middle', () => {
    const centres = tabCentres(4, W, G);
    const first = centres[0] - G;
    const last = W - G - centres[centres.length - 1];
    expect(+first.toFixed(6)).toBe(+last.toFixed(6));
  });

  it('keeps every centre inside the bar', () => {
    for (const count of [2, 3, 4, 5, 6]) {
      for (const x of tabCentres(count, W, G)) {
        expect(x).toBeGreaterThan(G);
        expect(x).toBeLessThan(W - G);
      }
    }
  });

  it('survives being asked before the bar has been measured', () => {
    expect(tabCentre(0, 4, 0, 6)).toBe(0);
    expect(tabCentre(0, 0, 358, 6)).toBe(0);
    expect(tabCentres(0, 358, 6)).toEqual([]);
  });

  it('follows the width when the phone is turned', () => {
    const portrait = tabCentres(4, 390, 6);
    const landscape = tabCentres(4, 844, 6);
    expect(landscape[0]).toBeGreaterThan(portrait[0]);
    expect(landscape).toHaveLength(4);
  });
});

describe('barPath', () => {
  const W = 390;
  const TOP = 46;
  const BOTTOM = 158;
  const d = barPath(W, TOP, BOTTOM, 195);

  it('draws one closed shape', () => {
    expect(d.startsWith('M')).toBe(true);
    expect(d.trimEnd().endsWith('Z')).toBe(true);
  });

  // Square at the bottom and running to the very edge of the screen. A bar
  // that stops short leaves a strip of whatever is behind it, and the eye
  // reads that strip as a mistake.
  it('runs square to the bottom', () => {
    // Down the right side, across the bottom, back up the left — three
    // straight runs with no curve between them. Asserted as one span rather
    // than "no C after the bottom", which also catches the top-left corner
    // further along the same path and fails on a shape that is correct.
    expect(d).toContain(`V ${BOTTOM} H 0 V ${TOP + BAR_RADIUS}`);
  });

  it('rounds only the top corners', () => {
    expect(d.startsWith(`M ${BAR_RADIUS} ${TOP}`)).toBe(true);
    expect(d).toContain(`${W} ${TOP + BAR_RADIUS}`);
  });

  it('dips under the leaf and returns to the straight', () => {
    expect(d).toContain(`H ${195 - BAY_HALF}`);
    expect(d).toContain(`${195 + BAY_HALF} ${TOP}`);
  });

  // A corner where the straight meets the curve is the first thing the eye
  // finds, so the bay leaves and rejoins on cubics.
  it('leaves and rejoins the edge on curves', () => {
    expect((d.match(/C /g) || []).length).toBeGreaterThanOrEqual(4);
  });

  // Three attempts protected the corner at the leaf's expense: dropping the
  // bay, squeezing it, then sliding its centre inboard. All three showed. The
  // bay is simply narrow enough never to reach a corner, so every tab gets
  // the same shape and the dip is always under the leaf.
  it('is the same shape under every tab', () => {
    const shapes = [43.8, 119.4, 195, 270.6, 346.2].map((centre) => {
      const path = barPath(W, TOP, BOTTOM, centre);
      const [, from] = path.match(/H ([\d.-]+) C/);
      const [, to] = path.match(/, ([\d.-]+) \d+ H /);
      return { width: +(Number(to) - Number(from)).toFixed(4), offset: +(centre - Number(from)).toFixed(4) };
    });
    for (const shape of shapes) {
      expect(shape.width).toBe(BAY_HALF * 2);
      expect(shape.offset).toBe(BAY_HALF);
    }
  });

  it('dips exactly under the leaf, never beside it', () => {
    for (const centre of [43.8, 195, 346.2]) {
      expect(barPath(W, TOP, BOTTOM, centre)).toContain(`, ${centre} ${TOP + 7.5}`);
    }
  });

  // 48 across clears a 12px corner even at the outermost of five tabs on the
  // narrowest phone this app runs on, so nothing has to be special-cased.
  it('clears the corner on every phone width without being moved', () => {
    for (const phone of [320, 360, 390, 412, 448]) {
      const centres = tabCentres(5, phone, 6);
      const first = barPath(phone, TOP, BOTTOM, centres[0]).match(/H ([\d.-]+) C/);
      const last = barPath(phone, TOP, BOTTOM, centres[4]).match(/, ([\d.-]+) \d+ H /);
      expect(Number(first[1])).toBeGreaterThanOrEqual(BAR_RADIUS);
      expect(Number(last[1])).toBeLessThanOrEqual(phone - BAR_RADIUS);
    }
  });

  it('has nothing in it when the bar has not been measured', () => {
    expect(barPath(0, TOP, BOTTOM, 0)).toBe('');
  });

  it('never writes NaN into the path', () => {
    for (const centre of [0, 10, 195, 380, 390]) {
      expect(barPath(W, TOP, BOTTOM, centre)).not.toMatch(/NaN/);
    }
  });
});

describe('wavePath', () => {
  // Drawn twice end to end, so sliding it one screen width and starting again
  // leaves no seam.
  it('covers twice the width so it can loop without a join', () => {
    const d = wavePath(390, 24, 56, 4);
    expect(d).toContain('L 780 56');
  });

  it('closes along the bottom', () => {
    expect(wavePath(390, 24, 56, 4).trimEnd().endsWith('L 0 56 Z')).toBe(true);
  });
});

// The horizon has a header across the top of it, which is the only reason
// these numbers are hard. The status bar is 24 points on one phone and 48 on
// another, the header is 48 more, and the bell and the gear sit at the right
// end of it. A sun that clears all that on the phone the design was drawn on
// and tucks under the bell on the next one is exactly the kind of defect that
// is never found by looking at the file.
describe('horizonLayout', () => {
  // The worst case: the tallest status bar this app has seen plus the header.
  const HEADER_BAND = 96;
  // The widest phones leave the icons roughly here.
  const ICONS_FROM = 0.76;

  it('keeps the sun out of the header at the design height', () => {
    expect(horizonLayout(390).orbTop).toBeGreaterThanOrEqual(HEADER_BAND);
  });

  it('keeps the sun out of the header on every width and both orb sizes', () => {
    for (const width of [320, 360, 390, 412, 448]) {
      for (const orbR of [15, 17]) {
        const { orbTop } = horizonLayout(width, HORIZON_HEIGHT, orbR);
        expect(orbTop).toBeGreaterThanOrEqual(HEADER_BAND);
      }
    }
  });

  // The glow may reach under the icons — it has no edge and almost no opacity
  // out there. The sun itself may not: it is the one bright, hard thing in the
  // strip, and a bell on top of it is a bell that cannot be read.
  it('keeps the sun itself left of the bell and the gear', () => {
    for (const width of [320, 360, 390, 412, 448]) {
      expect(horizonLayout(width).orbX + 17).toBeLessThan(width * ICONS_FROM);
    }
  });

  it('leaves the waterline enough depth to blend rather than draw a line', () => {
    expect(horizonLayout(390).blend).toBeGreaterThanOrEqual(16);
  });

  it('holds the sun above the waterline, not under it', () => {
    const { orbY, crest } = horizonLayout(390);
    expect(orbY).toBeLessThan(crest);
  });
});

// The far bank went through two wrong answers before this one, and the second
// is the reason this block exists. The rim light was stroked along the bank's
// own FILLED path — which includes the bottom edge — so it drew a hard line
// straight across the whole width, along the waterline. On the phone it read
// as a mountain-shaped thing lying on top of the river, and that is how it was
// reported. The silhouette and the shape are two different paths now, and the
// difference is pinned here.
describe('bankPath and bankLine', () => {
  const W = 390;
  const BASE = 157;
  const RISE = 35;

  it('fills a shape that closes along the waterline', () => {
    const d = bankPath(W, BASE, RISE);
    expect(d.trimEnd().endsWith('Z')).toBe(true);
    expect(d).toContain(`${BASE}`);
  });

  it('strokes the skyline and nothing else — no bottom edge, no closing', () => {
    const d = bankLine(W, BASE, RISE);
    expect(d.trimEnd().endsWith('Z')).toBe(false);
    expect(d).not.toContain('Z');
    // The waterline is where the line was wrongly drawn. It must not be in it.
    expect(d).not.toMatch(new RegExp(`L [-\\d.]+ ${BASE}`));
  });

  it('draws the same silhouette in both, so the light sits on the shape', () => {
    expect(bankPath(W, BASE, RISE).startsWith(bankLine(W, BASE, RISE))).toBe(true);
  });

  it('starts off the left edge and ends off the right', () => {
    expect(BANK[0][0]).toBeLessThan(0);
    expect(BANK[BANK.length - 1][0]).toBeGreaterThan(1);
  });

  it('is clumps, not peaks — every height well under the top', () => {
    for (const [, h] of BANK) {
      expect(h).toBeGreaterThan(0.4);
      expect(h).toBeLessThanOrEqual(1);
    }
  });

  it('has nothing in either before the scene has been measured', () => {
    expect(bankPath(0, BASE, RISE)).toBe('');
    expect(bankLine(0, BASE, RISE)).toBe('');
  });

  it('never writes NaN, at any width', () => {
    for (const width of [0, 320, 360, 390, 412, 448]) {
      expect(bankPath(width, BASE, RISE)).not.toMatch(/NaN/);
      expect(bankLine(width, BASE, RISE)).not.toMatch(/NaN/);
    }
  });
});

// The ranges were rebuilt as individually shaded mountains after the zig-zag
// version came back as "triangles thrown one over another": one flat
// silhouette has no faces, so there is nothing for light to fall on.
describe('mountainPath', () => {
  const W = 390;
  const BASE = 144;
  const RISE = 69;

  it('closes each mountain on its own feet', () => {
    for (const peak of [...RANGE_FAR, ...RANGE_MID]) {
      const d = mountainPath(W, BASE, RISE, peak);
      expect(d.trimEnd().endsWith('Z')).toBe(true);
      expect(d).not.toMatch(/NaN/);
    }
  });

  it('has nothing in it before the scene has been measured', () => {
    expect(mountainPath(0, BASE, RISE, RANGE_FAR[0])).toBe('');
  });

  it('overlaps its neighbours, so they stand in each other away', () => {
    for (const range of [RANGE_FAR, RANGE_MID]) {
      for (let i = 0; i < range.length - 1; i += 1) {
        const rightFoot = range[i].x + range[i].r;
        const nextLeftFoot = range[i + 1].x - range[i + 1].l;
        expect(rightFoot).toBeGreaterThan(nextLeftFoot);
      }
    }
  });

  it('keeps the snow for the high ones only', () => {
    for (const range of [RANGE_FAR, RANGE_MID]) {
      for (const peak of range) if (peak.snow) expect(peak.h).toBeGreaterThan(0.7);
    }
  });

  // A straight line from foot to apex is a tent. A real slope flares at the
  // bottom and steepens near the top, and that one curve is most of the
  // difference between a mountain and a triangle — so the path has to be
  // curves, and they have to bow the right way.
  it('bows the slopes instead of running them straight', () => {
    const d = mountainPath(W, BASE, RISE, RANGE_FAR[3]);
    expect((d.match(/Q /g) || []).length).toBe(2);
    expect(d).not.toMatch(/ L [-\d.]+ [-\d.]+ Q/);
  });

  it('puts the bend below the straight line, so the slope is concave', () => {
    const peak = RANGE_FAR[3];
    const d = mountainPath(W, BASE, RISE, peak);
    const [, ctrlX, ctrlY] = d.match(/Q ([-\d.]+) ([-\d.]+),/).map(Number);
    const apexY = BASE - RISE * peak.h;
    const footX = W * peak.x - W * peak.l;
    // Where the straight foot-to-apex line would be at the control's x.
    const straight = BASE + ((apexY - BASE) * (ctrlX - footX)) / (W * peak.x - footX);
    expect(ctrlY).toBeGreaterThan(straight);
  });
});

// Two values meeting along the ridgeline is what gives a mountain a near side
// and a far one. A stroke along the top only outlines it, which is what the
// attempt before this one did.
describe('mountainLit', () => {
  const W = 390;
  const BASE = 144;
  const RISE = 69;

  it('covers exactly the half turned towards the light', () => {
    for (const peak of RANGE_FAR) {
      const d = mountainLit(W, BASE, RISE, peak);
      const apexX = +(W * peak.x).toFixed(1);
      // It begins at the apex and comes back to the foot directly below it, so
      // the shape is the right half and never crosses into the shadowed one.
      expect(d.startsWith(`M ${apexX} `)).toBe(true);
      expect(d).toContain(`L ${apexX} ${BASE} Z`);
    }
  });

  it('follows the same slope as the body it sits on', () => {
    const peak = RANGE_MID[1];
    const body = mountainPath(W, BASE, RISE, peak);
    const lit = mountainLit(W, BASE, RISE, peak);
    const rightSlope = body.split('Q').pop().split('Z')[0].trim();
    expect(lit).toContain(rightSlope.split(' L ')[0].trim());
  });

  it('has nothing in it before the scene has been measured', () => {
    expect(mountainLit(0, BASE, RISE, RANGE_FAR[0])).toBe('');
  });
});

describe('mountainSnow', () => {
  const W = 390;
  const BASE = 144;
  const RISE = 69;

  it('gives snow only to the mountains marked for it', () => {
    for (const peak of [...RANGE_FAR, ...RANGE_MID]) {
      const d = mountainSnow(W, BASE, RISE, peak);
      expect(d === '').toBe(!peak.snow);
    }
  });

  it('keeps the cap near the top, nowhere near the foot', () => {
    const peak = RANGE_FAR[3];
    const apexY = BASE - RISE * peak.h;
    const ys = [...mountainSnow(W, BASE, RISE, peak).matchAll(/[ML] [-\d.]+ ([-\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBeCloseTo(apexY, 1);
    // Nothing in the cap reaches even halfway down the mountain.
    expect(Math.max(...ys)).toBeLessThan(apexY + (BASE - apexY) * 0.5);
  });

  // A straight snowline is the one thing that makes a painted mountain look
  // painted: snow lies in the gullies and melts off the ridges.
  it('leaves the underside ragged rather than level', () => {
    const d = mountainSnow(W, BASE, RISE, RANGE_FAR[1]);
    const ys = [...d.matchAll(/L [-\d.]+ ([-\d.]+)/g)].map((m) => Number(m[1]));
    expect(new Set(ys).size).toBeGreaterThan(3);
    expect(d.trimEnd().endsWith('Z')).toBe(true);
  });
});

describe('mountainGullies', () => {
  const W = 390;
  const BASE = 144;
  const RISE = 69;

  it('creases each mountain twice, from the ridge down', () => {
    for (const peak of RANGE_FAR) {
      const gullies = mountainGullies(W, BASE, RISE, peak);
      expect(gullies).toHaveLength(2);
      const apexX = +(W * peak.x).toFixed(1);
      for (const d of gullies) {
        expect(d.startsWith(`M ${apexX} `)).toBe(true);
        expect(d).not.toContain('Z');
      }
    }
  });

  it('has none before the scene has been measured', () => {
    expect(mountainGullies(0, BASE, RISE, RANGE_FAR[0])).toEqual([]);
  });
});

// The far shore has to be the same shore on every render. Jittered from
// Math.random it would be redrawn differently each frame the palette changes,
// and a treeline that crawls is worse than no treeline.
describe('treeLine', () => {
  const W = 390;
  const BASE = 196;
  const RISE = 43;

  it('draws the same shore twice', () => {
    expect(treeLine(W, BASE, RISE)).toBe(treeLine(W, BASE, RISE));
  });

  it('runs off both edges and closes along the shore', () => {
    const d = treeLine(W, BASE, RISE);
    const xs = [...d.matchAll(/[ML] ([-\d.]+) /g)].map((m) => Number(m[1]));
    expect(Math.min(...xs)).toBeLessThan(0);
    expect(Math.max(...xs)).toBeGreaterThan(W);
    expect(d.trimEnd().endsWith('Z')).toBe(true);
  });

  it('makes trees of uneven height, not a comb', () => {
    const d = treeLine(W, BASE, RISE);
    const tips = [...d.matchAll(/L [-\d.]+ ([-\d.]+)/g)].map((m) => Number(m[1]));
    expect(new Set(tips).size).toBeGreaterThan(20);
    for (const y of tips) expect(y).toBeLessThanOrEqual(BASE);
  });

  it('keeps every tree inside the height it was given', () => {
    const d = treeLine(W, BASE, RISE);
    const ys = [...d.matchAll(/[ML] [-\d.]+ ([-\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(BASE - RISE);
  });

  it('has nothing in it before the scene has been measured', () => {
    expect(treeLine(0, BASE, RISE)).toBe('');
  });
});

// The look of the pond is the ORDER of these depths, not the depths. Twice
// something ended up visibly lying on top of the water instead of standing in
// it, and both times the cause was one number drifting past the wave that was
// supposed to cover it. That is invisible in the source and the first thing
// anyone sees on the phone, so it is pinned here.
describe('SCENE depths', () => {
  it('runs the three waves from far to near', () => {
    expect(SCENE.waveFar).toBeLessThan(SCENE.waveMid);
    expect(SCENE.waveMid).toBeLessThan(SCENE.waveNear);
  });

  it('buries the foot of the bank under the first wave', () => {
    expect(SCENE.bankBase).toBeGreaterThan(SCENE.waveFar);
  });

  it('hides where the ranges stand behind the bank, at its lowest point', () => {
    const lowestBankTop = SCENE.bankBase - SCENE.bankRise * Math.min(...BANK.map(([, h]) => h));
    expect(SCENE.mountainBase).toBeGreaterThan(lowestBankTop);
  });

  it('keeps the ranges above the bank, so they are seen over it', () => {
    const bankTop = SCENE.bankBase - SCENE.bankRise;
    expect(SCENE.mountainBase - SCENE.mountainRiseFar).toBeLessThan(bankTop);
    expect(SCENE.mountainBase - SCENE.mountainRiseMid).toBeLessThan(bankTop);
  });

  it('stands the far range taller than the one in front of it', () => {
    expect(SCENE.mountainRiseFar).toBeGreaterThan(SCENE.mountainRiseMid);
  });

  // The frog sits on a pad, so the reserved slot and the pad under it come
  // from the same pair of numbers. Placed separately they drifted: the slot
  // ended up hanging over open water with a lily pad floating through its
  // middle and its foot in the notice below.
  it('floats the perch where the frog can be seen, clear of the reeds', () => {
    const halfPad = 48 / 2 / 390;
    expect(SCENE.perchX + halfPad).toBeLessThan(Math.min(...REEDS_RIGHT.map((reed) => reed.x)));
    expect(SCENE.perchX - halfPad).toBeGreaterThan(0.5);
  });

  // The pad floats in front of everything, so it belongs nearer than the reeds
  // standing behind it — but not so near that the fade into the page has
  // started eating it.
  it('floats the perch on open water, in front of the reeds', () => {
    expect(SCENE.perchY).toBeGreaterThan(SCENE.reedBase);
    expect(SCENE.perchY).toBeLessThan(0.85);
  });

  it('still leaves the bank visible above that wave', () => {
    const top = SCENE.bankBase - SCENE.bankRise;
    expect(top).toBeLessThan(SCENE.waveFar);
  });

  it('stands the reeds in the water, not on it', () => {
    // They are drawn in front of the middle wave, so the nearest one is what
    // has to cover where they enter.
    expect(SCENE.reedBase).toBeGreaterThanOrEqual(SCENE.waveNear);
  });

  it('keeps every reed tip clear of the water it stands in', () => {
    for (const reed of [...REEDS_LEFT, ...REEDS_RIGHT]) {
      expect(SCENE.reedBase - reed.h).toBeLessThan(SCENE.waveNear);
    }
  });

  it('gets the tallest reeds above the bank, so they read against the sky', () => {
    const bankTop = SCENE.bankBase - SCENE.bankRise;
    const tallest = Math.max(...[...REEDS_LEFT, ...REEDS_RIGHT].map((x) => x.h));
    expect(SCENE.reedBase - tallest).toBeLessThan(bankTop);
  });
});

// Reeds grow where the water is shallow, which is at the edges. The middle of
// this pond has the greeting across it, so a reed standing there is a reed
// behind type.
describe('reeds', () => {
  const ALL = [...REEDS_LEFT, ...REEDS_RIGHT];

  it('keeps the middle of the pond clear', () => {
    for (const reed of ALL) {
      expect(reed.x < 0.15 || reed.x > 0.85).toBe(true);
    }
  });

  it('gives no two the same height, so the row is not a fence', () => {
    for (const side of [REEDS_LEFT, REEDS_RIGHT]) {
      expect(new Set(side.map((x) => x.h)).size).toBe(side.length);
      expect(new Set(side.map((x) => x.lean)).size).toBe(side.length);
    }
  });

  it('leans some one way and some the other', () => {
    for (const side of [REEDS_LEFT, REEDS_RIGHT]) {
      expect(side.some((x) => x.lean > 0)).toBe(true);
      expect(side.some((x) => x.lean < 0)).toBe(true);
    }
  });

  it('stands each stem on the waterline and takes it to its own tip', () => {
    const d = reedStem(40, 180, 60, 7);
    expect(d.startsWith('M 40 180')).toBe(true);
    expect(d.trimEnd().endsWith('47 120')).toBe(true);
  });

  it('closes every blade, so it is a leaf and not a stroke', () => {
    const d = reedBlade(40, 180, 50, 30);
    expect(d.startsWith('M 40 180')).toBe(true);
    expect(d.trimEnd().endsWith('Z')).toBe(true);
  });

  it('puts the bulrush head under its own tip, not above it', () => {
    const h = reedHead(40, 180, 60, 8);
    expect(h.cy).toBeGreaterThan(180 - 60);
    expect(h.cx).toBeGreaterThan(40);
    expect(h.ry).toBeGreaterThan(h.rx);
  });

  it('never writes NaN into a reed', () => {
    for (const width of [320, 360, 390, 412, 448]) {
      for (const reed of ALL) {
        expect(reedStem(width * reed.x, 180, 60, reed.lean)).not.toMatch(/NaN/);
        if (reed.blade) expect(reedBlade(width * reed.x, 180, 50, reed.blade)).not.toMatch(/NaN/);
      }
    }
  });
});

// Catmull-Rom rather than plain Beziers for one reason: the curve has to pass
// through the peaks. With control points chosen by eye the line is pulled away
// from them, and the tallest peak ends up lower than the number that put it
// there — which looks like nothing at all and is impossible to debug by
// reading the path.
describe('smoothThrough', () => {
  it('passes through every point it is given', () => {
    const pts = [
      [0, 10],
      [50, 60],
      [100, 20],
      [150, 40],
    ];
    const d = smoothThrough(pts);
    expect(d.startsWith('M 0 10')).toBe(true);
    for (const [x, y] of pts.slice(1)) expect(d).toContain(`, ${x} ${y}`);
  });

  it('writes one curve per gap between points', () => {
    const pts = [
      [0, 0],
      [10, 10],
      [20, 0],
      [30, 10],
      [40, 0],
    ];
    expect((smoothThrough(pts).match(/C /g) || []).length).toBe(pts.length - 1);
  });

  it('has nothing to draw through fewer than two points', () => {
    expect(smoothThrough([])).toBe('');
    expect(smoothThrough([[1, 2]])).toBe('');
  });
});

// Three pads that are three leaves, not one leaf at three sizes. The stem is
// what tells them apart — it is never in the same place twice on a real pond,
// and every vein starts there, so moving it rearranges the whole leaf.
describe('PAD_SHAPES', () => {
  it('gives every pad a closed body, veins and a sheen', () => {
    expect(PAD_SHAPES).toHaveLength(3);
    for (const pad of PAD_SHAPES) {
      expect(pad.body.trimEnd().endsWith('Z')).toBe(true);
      expect(pad.body.startsWith('M70 32 L')).toBe(true);
      expect(pad.veins.length).toBeGreaterThanOrEqual(5);
      expect(pad.sheen).toMatch(/^M/);
      expect(pad.rim).toBeGreaterThan(0);
    }
  });

  it('starts every vein at the stem, where they actually start', () => {
    for (const pad of PAD_SHAPES) {
      for (const vein of pad.veins) expect(vein.startsWith('M70 32 L')).toBe(true);
    }
  });

  it('puts the stem somewhere different on each one', () => {
    const stems = PAD_SHAPES.map((p) => p.body.split('A')[0]);
    expect(new Set(stems).size).toBe(PAD_SHAPES.length);
  });

  it('builds each one differently, not just cut differently', () => {
    const radii = PAD_SHAPES.map((p) => p.body.match(/A([\d.]+) ([\d.]+)/).slice(1, 3).join('x'));
    expect(new Set(radii).size).toBe(PAD_SHAPES.length);
  });
});
