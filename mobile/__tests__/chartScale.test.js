import { scaleFor } from '../src/components/chartScale';

// The day chart took a maximum with a floor of zero and skipped anything at or
// below it. Expenses are never negative so it looked fine for a year; savings
// has withdrawals, and a month where more came out than went in drew an empty
// chart with the days money left simply missing from it.

const H = 136; // the plot height the chart actually uses
const TOP = 30;
const FOOT = TOP + H;

describe('the chart scale', () => {
  it('puts zero at the foot when nothing is negative', () => {
    const { zeroY, span } = scaleFor([10, 40, 0, 25], H, TOP);
    expect(zeroY).toBe(FOOT);
    expect(span).toBe(40);
  });

  it('puts zero at the top when nothing is positive', () => {
    const { zeroY, span } = scaleFor([-10, -40, 0], H, TOP);
    expect(zeroY).toBe(TOP);
    expect(span).toBe(40);
  });

  it('places zero between them when the period went both ways', () => {
    // 30 above, 10 below: zero sits three quarters of the way down.
    const { zeroY, span, highest, lowest } = scaleFor([30, -10], H, TOP);
    expect(highest).toBe(30);
    expect(lowest).toBe(-10);
    expect(span).toBe(40);
    expect(zeroY).toBeCloseTo(TOP + H * 0.75, 5);
  });

  it('covers the whole of the data, so no bar is ever clipped', () => {
    const values = [12, -40, 3, 55, -7];
    const { highest, lowest, span } = scaleFor(values, H, TOP);
    expect(highest).toBeGreaterThanOrEqual(Math.max(...values));
    expect(lowest).toBeLessThanOrEqual(Math.min(...values));
    for (const v of values) expect(Math.abs(v) / span).toBeLessThanOrEqual(1);
  });

  // An empty month must not divide by nothing and hand the chart a NaN, which
  // react-native-svg draws as nothing at all and reports as nothing at all.
  it('survives a period with no movement in it', () => {
    for (const values of [[], [0, 0, 0]]) {
      const { span, zeroY } = scaleFor(values, H, TOP);
      expect(span).toBe(1);
      expect(Number.isFinite(zeroY)).toBe(true);
    }
  });
});
