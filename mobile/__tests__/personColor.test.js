import { colorFor, toColorOrder, PALETTE, NO_PERSON } from '../src/utils/personColor';

// The point of assigning by position: two people in one household must never
// get the same colour. A hash of the name cannot promise that — with seven
// colours, two random names collide roughly one time in seven, and this app
// used to avoid it only by hardcoding the two names it knew about.
describe('colorFor with a household order', () => {
  const order = toColorOrder([{ name: 'Ana' }, { name: 'Marko' }, { name: 'Jelena' }]);

  it('gives each member a different colour', () => {
    const colors = ['Ana', 'Marko', 'Jelena'].map((n) => colorFor(n, order));
    expect(new Set(colors).size).toBe(3);
  });

  it('assigns by position, not by name', () => {
    expect(colorFor('Ana', order)).toBe(PALETTE[0]);
    expect(colorFor('Marko', order)).toBe(PALETTE[1]);
    expect(colorFor('Jelena', order)).toBe(PALETTE[2]);
  });

  it('ignores case and surrounding spaces', () => {
    expect(colorFor('  ANA ', order)).toBe(colorFor('Ana', order));
  });

  // Someone who left the household still has their name on old records.
  it('still gives a colour to a name that is not in the list', () => {
    const color = colorFor('Nikola', order);
    expect(PALETTE).toContain(color);
  });

  it('gives that name the same colour every time', () => {
    expect(colorFor('Nikola', order)).toBe(colorFor('Nikola', order));
  });
});

describe('colorFor without a list', () => {
  // Offline, or before the member list has arrived.
  it('falls back to a palette colour rather than nothing', () => {
    expect(PALETTE).toContain(colorFor('Ana'));
    expect(PALETTE).toContain(colorFor('Ana', []));
  });

  it('returns the neutral colour when there is no name at all', () => {
    expect(colorFor(null)).toBe(NO_PERSON);
    expect(colorFor('')).toBe(NO_PERSON);
    expect(colorFor('   ')).toBe(NO_PERSON);
  });
});

describe('toColorOrder', () => {
  it('accepts member objects and plain names alike', () => {
    expect(toColorOrder([{ name: 'Ana' }, 'Marko'])).toEqual(['ana', 'marko']);
  });

  it('drops entries with no name instead of shifting everyone else', () => {
    expect(toColorOrder([{ name: 'Ana' }, {}, { name: 'Marko' }])).toEqual(['ana', 'marko']);
  });

  it('survives a response that is not a list', () => {
    expect(toColorOrder(undefined)).toEqual([]);
    expect(toColorOrder(null)).toEqual([]);
  });
});
