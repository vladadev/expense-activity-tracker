// The measurements, separate from the colours.
//
// A palette answers "what colour"; this answers "how big, how far apart, how
// round, how long". None of it changes between themes, which is why it is not
// in palettes.js: a spacing that shifted when somebody picked a different
// theme would be a bug, not a feature.
//
// The point is that these are the ONLY values used. A screen reaching for 13
// or 17 is a screen drifting away from every other screen, and it shows up as
// the vague, slightly-off feeling that cannot be pointed at.

// 4 is the unit everything is a multiple of. Anything between two steps
// belongs to one of them.
export const space = {
  xs: 4, // hairline gaps, a dot beside a word
  sm: 8, // inside a row
  md: 16, // the screen gutter, and the gap between cards
  lg: 24, // between blocks within a section
  xl: 40, // between sections
};

export const radius = {
  control: 10, // inputs and small buttons
  card: 16, // cards, sheets, list containers
  pill: 22, // chips, segmented controls, avatars
  full: 999,
};

// Outfit for anything that should be noticed — titles and, above all, amounts.
// IBM Plex Sans for anything that is read rather than looked at.
//
// Amounts always carry `tabular`, so digits occupy the same width: a column of
// figures lines up, and a total does not shift sideways as it changes.
export const font = {
  display: 'Outfit_600SemiBold',
  displayMedium: 'Outfit_500Medium',
  body: 'IBMPlexSans_400Regular',
  bodyMedium: 'IBMPlexSans_500Medium',
  bodySemiBold: 'IBMPlexSans_600SemiBold',
};

export const tabular = { fontVariant: ['tabular-nums'] };

export const type = {
  // Screen titles and the one figure a screen exists to show.
  hero: { fontFamily: font.display, fontSize: 40, lineHeight: 42 },
  title: { fontFamily: font.display, fontSize: 22, lineHeight: 28 },
  section: { fontFamily: font.display, fontSize: 15, lineHeight: 20 },
  // Amounts, at the three sizes the app actually uses.
  amountLarge: { fontFamily: font.display, fontSize: 38, lineHeight: 40, ...tabular },
  amountMedium: { fontFamily: font.display, fontSize: 22, lineHeight: 26, ...tabular },
  amountSmall: { fontFamily: font.displayMedium, fontSize: 15, lineHeight: 20, ...tabular },
  // Everything that is read.
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: font.bodySemiBold, fontSize: 15, lineHeight: 22 },
  secondary: { fontFamily: font.body, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: font.bodySemiBold, fontSize: 11, lineHeight: 14, letterSpacing: 1.1, textTransform: 'uppercase' },
};

// Nothing tappable is smaller than this. It is not a style choice: a thumb is
// about this wide, and a target below it is one people miss and then blame
// themselves for.
export const HIT = 48;

// Durations, in milliseconds. Short enough that the app never feels like it is
// performing, long enough that a change is seen rather than discovered.
export const motion = {
  instant: 120, // a press, a toggle
  quick: 180, // a sheet opening, a row settling
  settle: 260, // a screen's content arriving
  // The pond. Slow, and deliberately out of step with each other: movement
  // that repeats on a shared beat is noticed, and noticed movement competes
  // with the figures it sits above.
  waveFar: 34000,
  waveMid: 24000,
  waveNear: 17000,
  bob: 9000,
  // Day into night. Far longer than anything else here, and deliberately: this
  // is the one change in the app that is meant to be watched rather than
  // merely noticed. Shorter and the sun looks like it was deleted; much
  // longer and you are waiting for your own app.
  crossing: 1400,
};
