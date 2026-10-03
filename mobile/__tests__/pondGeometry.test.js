import { tabCentre, tabCentres, barPath, wavePath, BAY_HALF, BAR_RADIUS } from '../src/components/pond/geometry';

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

  // With five tabs the outer two always reach a rounded corner, so dropping
  // the bay there left the edge flat under the leaf exactly where it showed
  // most. It narrows to fit instead.
  it('keeps the bay at the ends by squeezing it', () => {
    const first = barPath(W, TOP, BOTTOM, 43.8);
    const last = barPath(W, TOP, BOTTOM, 346.2);
    for (const path of [first, last]) {
      expect(path).toMatch(/C .*C /);
      expect(path).not.toMatch(/-\d/);
    }
  });

  it('never lets the bay cross a corner', () => {
    for (const centre of [0, 8, 20, 370, 382, 390]) {
      const path = barPath(W, TOP, BOTTOM, centre);
      const starts = path.match(/H (-?[\d.]+) C/);
      if (starts) expect(Number(starts[1])).toBeGreaterThanOrEqual(BAR_RADIUS);
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
