// Where zero sits, and how far the bars reach from it.
//
// The chart used to take a maximum with a floor of zero and skip anything at
// or below it. For expenses that is harmless — nothing is ever spent
// negatively — but savings has withdrawals, so a month where more came out
// than went in drew an empty chart, and the days money left were simply not
// on it. A chart that omits the half of the data it finds awkward is worse
// than no chart, and it does it silently, which is worse again.
export function scaleFor(values, plotHeight, topPad = 0) {
  const highest = Math.max(...values, 0);
  const lowest = Math.min(...values, 0);
  // An all-zero period would divide by nothing; one unit of span puts the
  // baseline somewhere sensible and draws no bars, which is the truth.
  const span = highest - lowest || 1;
  return { highest, lowest, span, zeroY: topPad + (highest / span) * plotHeight };
}
