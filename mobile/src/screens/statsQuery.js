// Which question Analysis is asking, as one string.
//
// Analysis draws four things at once — a headline, a breakdown, a chart and a
// comparison — and all four belong to one question: which data type, over
// which period, how far back. The data used to be four loose pieces of state
// with nothing tying them to the question that produced them, so switching
// from Troškovi to Prihodi left the old figures standing until the new request
// came back: sometimes "nothing this month", sometimes savings totals under
// the Income heading, put right several seconds later.
//
// It lives in its own file rather than in the screen because it is compared in
// two places — what is on screen, and what a request that is still in flight
// was asked for — and a key assembled twice is a guard that stops matching the
// moment one copy of it changes.
export function queryKeyFor(dataType, periodMode, monthOffset, yearOffset) {
  return `${dataType}:${periodMode}:${periodMode === 'month' ? monthOffset : yearOffset}`;
}
