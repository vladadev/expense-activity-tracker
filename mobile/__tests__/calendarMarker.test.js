const { DAY, DAY_RADIUS } = require('../src/components/WeekRow');

// The chosen day is drawn twice: by the calendar library when the month is
// open, and by WeekRow when it is folded. They have to agree, or the marker
// changes shape under the finger that just tapped it — which is exactly what
// happened. WeekRow was 34 across with a radius of 999, the grid is 32 with a
// radius of 16, and an oversized radius is not reliably clamped on Android
// under Fabric, so the folded week showed a square.
//
// The library's numbers are read from its own stylesheet rather than written
// down here, so this fails if a library upgrade moves them.
const libraryDay = require('react-native-calendars/src/calendar/day/basic/style');

function grid() {
  const sheet = libraryDay.default ? libraryDay.default({}) : libraryDay({});
  const base = sheet.base || sheet.selected || {};
  return { width: base.width, height: base.height, borderRadius: sheet.selected?.borderRadius };
}

describe('the chosen day', () => {
  it('is a circle, not a rounded box', () => {
    expect(DAY_RADIUS).toBe(DAY / 2);
  });

  it('is the same size in the folded week as in the open month', () => {
    const g = grid();
    expect(g.width).toBe(DAY);
    expect(g.height).toBe(DAY);
  });

  it('carries the same radius the grid uses', () => {
    expect(grid().borderRadius).toBe(DAY_RADIUS);
  });
});
