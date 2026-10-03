// Where each tab's centre falls, and the shapes drawn around it.
//
// Kept apart from the component and tested, because getting this wrong is not
// a wobble — it is a leaf floating beside the icon it is meant to mark. The
// design went through three rounds of that, and the cause was never the
// arithmetic: it was a row of tabs that only looked equal. `flexGrow: 1`
// shares out the SPARE space evenly while every tab still starts at the width
// of its own label, so "Kalendar" took more room than "Liste". Equal columns
// need a basis of zero.

export const BAND_H = 46; // water above the bar
export const BAR_H = 64; // the bar itself, before the phone's own inset
export const BAR_RADIUS = 16; // top corners only
export const BAY_DEPTH = 7.5; // how far the edge dips under the leaf
export const BAY_HALF = 32; // half the width it takes to leave and return
export const PAD_WIDTH = 30;
export const GUTTER = 6;

export function tabCentre(index, count, width, gutter = GUTTER) {
  if (!count || !width) return 0;
  const inner = width - gutter * 2;
  const each = inner / count;
  return gutter + each * (index + 0.5);
}

export function tabCentres(count, width, gutter = GUTTER) {
  return Array.from({ length: count }, (_, i) => tabCentre(i, count, width, gutter));
}

// The bar, as ONE path, with the bay cut into its own top edge.
//
// Drawn this way rather than as a separate patch laid over a straight edge: a
// patch has to be filled with something, and whatever it is filled with is
// visible as a block against the water behind it. Cutting the bay into the bar
// means there is nothing there at all, and the water simply shows through.
//
// The bottom corners are square and the path runs to the very bottom of the
// screen, under the phone's gesture area. A bar that stops short leaves a
// strip of whatever is behind it, and the eye reads that strip as a mistake.
export function barPath(width, top, bottom, bayCentre, radius = BAR_RADIUS) {
  if (!width) return '';
  const r = Math.min(radius, width / 2);
  const c = bayCentre;
  const left = c - BAY_HALF;
  const right = c + BAY_HALF;
  const dip = top + BAY_DEPTH;

  // A bay near either end would run into a rounded corner. Dropping it there
  // was the first attempt and it was wrong: with five tabs the outer two
  // ALWAYS reach the corner, so the edge went flat under the leaf exactly
  // where it was most noticeable. The bay is squeezed instead — its sides
  // pulled in to clear the corner while the dip stays under the leaf, so it
  // narrows rather than disappearing.
  const clear = r + 4;
  const from = Math.max(left, clear);
  const to = Math.min(right, width - clear);
  const lead = Math.max(6, Math.min(11, (c - from) * 0.42));
  const tail = Math.max(6, Math.min(11, (to - c) * 0.42));

  const edge =
    to - from > 12
      ? `H ${from} C ${from + lead} ${top}, ${from + lead + 2} ${dip}, ${c} ${dip} ` +
        `C ${to - tail - 2} ${dip}, ${to - tail} ${top}, ${to} ${top} H ${width - r}`
      : `H ${width - r}`;

  return (
    `M ${r} ${top} ${edge} ` +
    `C ${width - r / 2} ${top}, ${width} ${top + r / 2}, ${width} ${top + r} ` +
    `V ${bottom} H 0 V ${top + r} ` +
    `C 0 ${top + r / 2}, ${r / 2} ${top}, ${r} ${top} Z`
  );
}

// One long wave, drawn twice end to end so it can slide a full screen width
// and start again without a seam.
export function wavePath(width, crest, bottom, amplitude) {
  const w = width;
  const run = (x) =>
    `C ${x + w * 0.18} ${crest - amplitude}, ${x + w * 0.32} ${crest + amplitude}, ${x + w * 0.5} ${crest} ` +
    `S ${x + w * 0.82} ${crest - amplitude}, ${x + w} ${crest}`;
  return `M 0 ${crest} ${run(0)} ${run(w)} L ${w * 2} ${bottom} L 0 ${bottom} Z`;
}

// The leaf, in its own space so it can be scaled anywhere without these
// numbers changing. The wedge runs from the rim to the centre, where the stem
// meets it and where every vein starts — that is what makes it a lily pad
// rather than an oval with a nick in it.
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
