import { matches } from '../src/utils/search';

// The search is the one piece of this app whose correctness cannot be seen by
// looking at the screen: a query that silently matches nothing looks identical
// to a household that genuinely has no such record.
describe('diacritic folding', () => {
  it('finds accented text from plain letters', () => {
    expect(matches('secer', ['Šećer'])).toBe(true);
    expect(matches('cokolada', ['Čokolada'])).toBe(true);
    expect(matches('zvake', ['Žvake'])).toBe(true);
  });

  it('finds plain text from accented letters', () => {
    expect(matches('šećer', ['Secer'])).toBe(true);
  });

  it('ignores case', () => {
    expect(matches('SECER', ['šećer'])).toBe(true);
  });

  // Đ is its own letter rather than a D with a mark, so it needs its own rule,
  // and people type it three different ways.
  it('treats đ, dj and d as the same letter', () => {
    expect(matches('djubre', ['Đubre'])).toBe(true);
    expect(matches('dubre', ['Đubre'])).toBe(true);
    expect(matches('đubre', ['Djubre'])).toBe(true);
  });

  it('works for other languages too', () => {
    expect(matches('cafe', ['Café'])).toBe(true);
  });

  it('still refuses genuine non-matches', () => {
    expect(matches('kafa', ['Namirnice'])).toBe(false);
  });
});

describe('amount matching', () => {
  const record = ['Namirnice', 'Maxi, nedeljna kupovina', 2400, 'RSD'];

  it('matches the raw number', () => {
    expect(matches('2400', record)).toBe(true);
  });

  // Someone types the number the way the screen shows it, separators and all.
  it('matches the number as it is displayed', () => {
    expect(matches('2.400', record)).toBe(true);
    expect(matches('2,400', record)).toBe(true);
  });

  it('matches a partial number', () => {
    expect(matches('240', record)).toBe(true);
  });

  it('does not match a different number', () => {
    expect(matches('9999', record)).toBe(false);
  });

  it('handles decimals from either side', () => {
    expect(matches('1.5', ['Kafa', 1.5, 'EUR'])).toBe(true);
    expect(matches('15', ['Kafa', 1.5, 'EUR'])).toBe(true);
  });
});

describe('multiple terms', () => {
  const record = ['Namirnice', 'Maxi, nedeljna kupovina'];

  it('narrows rather than widens', () => {
    expect(matches('kupovina maxi', record)).toBe(true);
    expect(matches('maxi kafa', record)).toBe(false);
  });

  it('treats an empty query as matching everything', () => {
    expect(matches('', record)).toBe(true);
    expect(matches('   ', record)).toBe(true);
  });

  it('ignores empty fields rather than throwing', () => {
    expect(matches('maxi', [null, undefined, '', 'Maxi'])).toBe(true);
  });
});
