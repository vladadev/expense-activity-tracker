// Where each tab's centre falls, and the shapes drawn around it.
//
// Kept apart from the component and tested, because getting this wrong is not
// a wobble — it is a leaf floating beside the icon it is meant to mark. The
// design went through three rounds of that, and the cause was never the
// arithmetic: it was a row of tabs that only looked equal. `flexGrow: 1`
// shares out the SPARE space evenly while every tab still starts at the width
// of its own label, so "Kalendar" took more room than "Liste". Equal columns
// need a basis of zero.

// The bay in the bar's top edge, and the leaf that sits in it.
export const BAR_TOP = 34; // where the bar's own edge sits
export const BAY_DEPTH = 7.5; // how far the edge dips under the leaf
export const BAY_HALF = 34; // half the width it takes to leave and return
export const PAD_WIDTH = 29;
export const PAD_CENTRE_Y = 28.6;

export function tabCentre(index, count, width, gutter) {
  if (!count || !width) return 0;
  const inner = width - gutter * 2;
  const each = inner / count;
  return gutter + each * (index + 0.5);
}

export function tabCentres(count, width, gutter) {
  return Array.from({ length: count }, (_, i) => tabCentre(i, count, width, gutter));
}

// The bar, with its top edge easing down into a bay and back out again. Drawn
// as one path so the edge has no joint anywhere: a corner where the straight
// meets the curve is the first thing the eye finds.
export function barPath(width, height, radius, bayCentre) {
  const c = bayCentre;
  const left = c - BAY_HALF;
  const right = c + BAY_HALF;
  const dip = BAR_TOP + BAY_DEPTH;
  return [
    `M${radius} ${BAR_TOP}`,
    `H ${left}`,
    `C ${left + 12} ${BAR_TOP}, ${left + 14} ${dip}, ${c} ${dip}`,
    `C ${right - 14} ${dip}, ${right - 12} ${BAR_TOP}, ${right} ${BAR_TOP}`,
    `H ${width - radius}`,
    `C ${width - radius / 2} ${BAR_TOP}, ${width} ${BAR_TOP + radius / 2}, ${width} ${BAR_TOP + radius}`,
    `V ${height - radius}`,
    `C ${width} ${height - radius / 2}, ${width - radius / 2} ${height}, ${width - radius} ${height}`,
    `H ${radius}`,
    `C ${radius / 2} ${height}, 0 ${height - radius / 2}, 0 ${height - radius}`,
    `V ${BAR_TOP + radius}`,
    `C 0 ${BAR_TOP + radius / 2}, ${radius / 2} ${BAR_TOP}, ${radius} ${BAR_TOP}`,
    'Z',
  ].join(' ');
}

// The leaf itself, in its own 140x64 space so it can be scaled to any size
// without the numbers below changing. The wedge runs from the rim to the
// centre, where the stem meets it and where every vein starts — it is what
// makes the shape a lily pad rather than an oval with a nick in it.
export const LEAF_VIEWBOX = { width: 140, height: 64 };
export const LEAF_BODY = 'M70 32 L36 8.6 A66 29 0 1 0 104 8.6 Z';
export const LEAF_VEINS = [
  'M70 32 L12 24',
  'M70 32 L22 50',
  'M70 32 L64 61',
  'M70 32 L112 52',
  'M70 32 L130 26',
];
export const LEAF_SHEEN = 'M30 20 C 44 11, 62 8, 76 9';
