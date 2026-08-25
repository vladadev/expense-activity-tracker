import { formatLongDate, formatMonthYear, formatDayHeader, formatTime } from '../src/i18n/dateFormat';

// Dates are formatted by hand rather than through Intl, because Hermes ships
// without full locale data and silently falls back to English on device even
// though it looks right in a browser. Hand-rolled formatting is only safe if
// something checks it.
describe('formatLongDate', () => {
  it('renders Serbian with the day first and a trailing full stop', () => {
    expect(formatLongDate('2026-08-24', 'sr')).toBe('Ponedeljak, 24. avgust 2026.');
  });

  it('renders English with the month first', () => {
    expect(formatLongDate('2026-08-24', 'en')).toBe('Monday, August 24, 2026');
  });

  // The date is parsed with an explicit midnight so it cannot shift a day.
  it('does not shift the day across a timezone', () => {
    expect(formatLongDate('2026-01-01', 'en')).toContain('January 1');
    expect(formatLongDate('2026-12-31', 'en')).toContain('December 31');
  });

  it('falls back to English for an unknown language', () => {
    expect(formatLongDate('2026-08-24', 'de')).toBe('Monday, August 24, 2026');
  });
});

describe('formatMonthYear', () => {
  it('uses the Serbian lowercase month and a trailing full stop', () => {
    expect(formatMonthYear(new Date(2026, 7, 1), 'sr')).toBe('avgust 2026.');
  });

  it('uses the English capitalised month', () => {
    expect(formatMonthYear(new Date(2026, 7, 1), 'en')).toBe('August 2026');
  });
});

describe('formatDayHeader', () => {
  const thisYear = new Date().getFullYear();

  it('omits the year for the current one', () => {
    expect(formatDayHeader(`${thisYear}-08-24`, 'sr')).not.toContain(String(thisYear));
  });

  // Search results span years; a header without one would be ambiguous.
  it('includes the year for any other', () => {
    expect(formatDayHeader('2024-08-24', 'sr')).toContain('2024');
    expect(formatDayHeader('2024-08-24', 'en')).toContain('2024');
  });

  it('abbreviates the weekday', () => {
    expect(formatDayHeader('2026-08-24', 'sr')).toMatch(/^pon,/);
    expect(formatDayHeader('2026-08-24', 'en')).toMatch(/^Mon,/);
  });
});

describe('formatTime', () => {
  it('pads to two digits', () => {
    expect(formatTime(new Date(2026, 7, 24, 9, 5))).toBe('09:05');
  });
});
