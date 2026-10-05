import { queryKeyFor } from '../src/screens/statsQuery';

// Analysis draws four things at once — a headline, a breakdown, a chart and a
// comparison — and all four belong to one question: which data type, over
// which period, how far back. The data used to be four loose pieces of state
// with nothing tying them to the question that produced them, so switching
// from Troškovi to Prihodi left the old figures standing until the new request
// came back: sometimes "nothing this month", sometimes savings totals under
// the Income heading, corrected several seconds later.
//
// Everything now carries this key, and a response that comes back for a
// question nobody is asking any more is dropped. That matters because three
// taps start three requests and they can return in any order.

describe('the stats query key', () => {
  it('separates the three data types', () => {
    const month = ['month', 0, 0];
    expect(queryKeyFor('expenses', ...month)).not.toBe(queryKeyFor('income', ...month));
    expect(queryKeyFor('income', ...month)).not.toBe(queryKeyFor('savings', ...month));
  });

  it('separates one period from the next', () => {
    expect(queryKeyFor('expenses', 'month', 0, 0)).not.toBe(queryKeyFor('expenses', 'month', -1, 0));
    expect(queryKeyFor('expenses', 'year', 0, 0)).not.toBe(queryKeyFor('expenses', 'year', 0, -1));
  });

  it('separates a month from a year', () => {
    expect(queryKeyFor('expenses', 'month', 0, 0)).not.toBe(queryKeyFor('expenses', 'year', 0, 0));
  });

  // The month view is told by monthOffset and the year view by yearOffset.
  // Reading the wrong one would make stepping back a month look like the same
  // question, and the screen would keep showing the month it had.
  it('reads the offset that belongs to the period it is in', () => {
    expect(queryKeyFor('expenses', 'month', -3, 0)).toBe(queryKeyFor('expenses', 'month', -3, -9));
    expect(queryKeyFor('expenses', 'year', 0, -3)).toBe(queryKeyFor('expenses', 'year', -9, -3));
  });

  it('is the same string for the same question, so the guard can compare it', () => {
    expect(queryKeyFor('savings', 'month', -2, 0)).toBe(queryKeyFor('savings', 'month', -2, 0));
  });
});
