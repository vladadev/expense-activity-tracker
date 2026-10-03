import {
  tabCentre,
  tabCentres,
  barPath,
  wavePath,
  horizonLayout,
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
