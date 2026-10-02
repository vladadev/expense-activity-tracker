import { tabCentre, tabCentres, barPath, BAR_TOP, BAY_HALF } from '../src/components/pond/geometry';

// The leaf marks which tab you are on, so a centre that is off by even ten
// pixels puts it beside the icon instead of under it. That happened three
// times in the design, and never because the arithmetic was wrong: the row of
// tabs only looked equal. `flexGrow: 1` hands out the SPARE space evenly while
// each tab still starts at the width of its own label, so a long word like
// "Kalendar" claimed more room than "Liste". These tests pin the arithmetic so
// that when it drifts again, the cause is the layout and not the maths.
describe('tabCentre', () => {
  // 358 wide with 6 either side, four tabs of 86.5: the numbers from the
  // design, kept here so the code and the drawing cannot disagree.
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
  const d = barPath(358, 98, 26, 222.25);

  it('draws one closed shape', () => {
    expect(d.startsWith('M')).toBe(true);
    expect(d.trimEnd().endsWith('Z')).toBe(true);
  });

  it('dips under the leaf and comes back to the straight', () => {
    expect(d).toContain(`H ${222.25 - BAY_HALF}`);
    expect(d).toContain(`${222.25 + BAY_HALF} ${BAR_TOP}`);
  });

  // A corner where the straight meets the curve is the first thing the eye
  // finds, so the bay is cubic at both ends rather than an arc dropped in.
  it('leaves and rejoins the edge on curves, not corners', () => {
    const curves = d.match(/C /g) || [];
    expect(curves.length).toBeGreaterThanOrEqual(6);
  });

  it('has no NaN in it when the bar has not been measured', () => {
    expect(barPath(0, 0, 26, 0)).not.toMatch(/NaN/);
  });
});
