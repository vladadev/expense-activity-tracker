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
export const BAR_RADIUS = 12; // top corners only
export const BAY_DEPTH = 7.5; // how far the edge dips under the leaf
export const BAY_HALF = 24; // half the width it takes to leave and return
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

  // The bay is the same shape under every tab, centred on the leaf, always.
  //
  // Three attempts went the other way and all three were visible. Dropping it
  // near the corners left the outer tabs with a flat edge. Squeezing it left
  // half a curve. Sliding its centre inboard made the dip sit beside the leaf
  // instead of under it. Each was a rule invented to protect the corner, and
  // each cost more than the corner was worth.
  //
  // The answer was to make the bay narrow enough that it never reaches a
  // corner in the first place: 48 across, which clears the radius even at the
  // outermost tab of five on the narrowest phone. Nothing to special-case,
  // and every tab gets the identical shape.
  const c = bayCentre;
  const left = c - BAY_HALF;
  const right = c + BAY_HALF;
  const dip = top + BAY_DEPTH;

  const edge =
    `H ${left} C ${left + 9} ${top}, ${left + 11} ${dip}, ${c} ${dip} ` +
    `C ${right - 11} ${dip}, ${right - 9} ${top}, ${right} ${top} H ${width - r}`;

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

// The horizon: the strip of pond that fits behind the header of a screen whose
// job is figures.
//
// These four numbers are the whole constraint, and they are here rather than
// in the component because getting them wrong is invisible on the phone the
// design was drawn on and obvious on the next one. A header sits across the
// top of this strip — the status bar, which is 24 to 48 points depending on
// the phone, and then 48 of header — and the bell and the gear are at the
// right-hand end of it. So the sun has to clear about 96 points from the top,
// and stay left of the icons, and still leave the waterline room to blend into
// the page below. There is not much between those.
export const HORIZON_HEIGHT = 150;
export const HORIZON_ORB_X = 0.68;
export const HORIZON_ORB_Y = 0.78;
export const HORIZON_WATERLINE = 0.86;

export function horizonLayout(width, height = HORIZON_HEIGHT, orbR = 17) {
  const crest = height * HORIZON_WATERLINE;
  const orbY = height * HORIZON_ORB_Y;
  return {
    orbX: width * HORIZON_ORB_X,
    orbY,
    crest,
    // The top of the sun, which is what has to stay out of the header, and
    // the depth left for the blend, which is what keeps the horizon from
    // being a drawn line.
    orbTop: orbY - orbR,
    blend: height - crest,
  };
}

// The far side of the pond, and the reeds standing in it.
//
// Two wrong answers came before this one, and both are worth keeping written
// down. The first was a pair of filled blobs meant to read as reeds: each
// began at the very edge of the frame, so the left one had a dead straight
// vertical side where the shape simply stopped, and it was reported as a
// rendering fault. Nothing in a landscape has that edge.
//
// The second was mountains, and they were wrong twice over. A ridge drawn to
// stand behind a POND is out of scale with it — a pond is small and near, and
// anything distant and huge behind it turns the water into a lake. And the rim
// light was stroked along the ridge's own closed path, which includes the
// bottom edge: that drew a hard line straight across the whole width, along
// the waterline, which is exactly what it looked like. Hence `bankLine` below,
// which is the silhouette and nothing else.
//
// What is here now is what a pond actually has: a low far bank, far enough to
// be hazy, and reeds standing in the shallows at either edge where reeds grow.
// The middle is left open, because that is where the greeting goes.

// Smooth a line through every one of its points.
//
// Catmull-Rom, converted to the cubic Beziers SVG actually speaks. The point
// of it is that the curve PASSES THROUGH the peaks: with plain Beziers the
// control points pull the line away from them, so a ridge drawn to a height
// never quite reaches it and the tallest peak is never where it was put.
export function smoothThrough(points) {
  if (points.length < 2) return '';
  const at = (i) => points[Math.max(0, Math.min(points.length - 1, i))];
  let d = `M ${r(points[0][0])} ${r(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${r(c1[0])} ${r(c1[1])}, ${r(c2[0])} ${r(c2[1])}, ${r(p2[0])} ${r(p2[1])}`;
  }
  return d;
}

function r(n) {
  return Math.round(n * 10) / 10;
}

// Where each layer of the home scene sits, as a fraction of its height.
//
// These are here rather than inline in the component because the whole look of
// the pond is the ORDER of these numbers, not the numbers themselves, and the
// order is checkable. Twice now something has ended up visibly sitting on top
// of the water instead of in it, and both times the cause was a depth that had
// drifted past the wave that was supposed to cover it — which is invisible in
// the source and obvious on the phone.
export const SCENE = {
  mountainBase: 0.46, // where the ranges stand, hidden behind the bank
  mountainRiseFar: 0.22,
  mountainRiseMid: 0.17,
  bankBase: 0.5, // where the far bank meets the water
  bankRise: 0.11, // how far it stands above it
  waveFar: 0.45,
  waveMid: 0.53,
  waveNear: 0.62,
  reedBase: 0.63, // the reeds enter the water under the nearest wave
};

// The ranges behind the bank.
//
// Straight segments meeting at angles, and that is the whole lesson from the
// attempt before this one. The bank is drawn through a Catmull-Rom, which
// rounds everything it touches — perfect for distant planting and useless for
// rock, because a smoothed outline has no facets and reads as one curved line
// however many bumps are in it. Mountains are made of slopes, and a slope is
// straight.
//
// Neither range crosses the whole screen. The far one climbs out of the left
// edge and runs down into the water around two thirds across; the middle one
// starts behind it and carries on out to the right. They overlap, which is
// what makes it a landscape rather than a backdrop — and it also means no
// single silhouette spans the frame, which is the shape that kept reading as a
// line.

// Each range is a list of mountains rather than one zig-zag line, because a
// mountain has to be shaded on its own to be a mountain at all. The zig-zag
// came back as "triangles thrown one over another", and it was right: a single
// flat silhouette has no faces, so there is nothing for light to fall on.
//
// `x` is the apex across the frame, `h` its height from 0 at the foot to 1 at
// the top of the range, `l` and `r` how far its feet reach either side, and
// `snow` whether it is high enough to hold any. Feet overlap their neighbours
// on purpose — mountains stand in each other's way, and the gaps between
// evenly spaced triangles are most of what made the last attempt read as a
// row of tents.
export const RANGE_FAR = [
  { x: -0.03, h: 0.74, l: 0.16, r: 0.13, snow: false },
  { x: 0.1, h: 0.93, l: 0.12, r: 0.14, snow: true },
  { x: 0.2, h: 0.66, l: 0.09, r: 0.11, snow: false },
  { x: 0.33, h: 1.0, l: 0.14, r: 0.15, snow: true },
  { x: 0.45, h: 0.6, l: 0.1, r: 0.12, snow: false },
  { x: 0.58, h: 0.79, l: 0.12, r: 0.16, snow: true },
];

export const RANGE_MID = [
  { x: 0.4, h: 0.56, l: 0.14, r: 0.13, snow: false },
  { x: 0.53, h: 0.76, l: 0.12, r: 0.15, snow: false },
  { x: 0.67, h: 0.58, l: 0.11, r: 0.12, snow: false },
  { x: 0.8, h: 0.82, l: 0.14, r: 0.16, snow: true },
  { x: 0.96, h: 0.61, l: 0.13, r: 0.19, snow: false },
];

// How far the slopes bow in. A straight line from foot to apex is a tent; a
// real slope is concave — it flares at the bottom and steepens near the top —
// and that one curve is most of the difference between a drawing of a mountain
// and a triangle.
const BOW = 0.3;

function mountainPoints(width, baseY, rise, peak) {
  const apexX = width * peak.x;
  const apexY = baseY - rise * peak.h;
  return {
    apexX,
    apexY,
    leftX: apexX - width * peak.l,
    rightX: apexX + width * peak.r,
    dropY: baseY - (baseY - apexY) * BOW,
  };
}

// A point along one of the slopes, `t` from the foot to the apex. Used to put
// the snowline on the slope itself rather than on a straight line near it.
function onSlope(footX, baseY, ctrlX, ctrlY, apexX, apexY, t) {
  const u = 1 - t;
  return [
    u * u * footX + 2 * u * t * ctrlX + t * t * apexX,
    u * u * baseY + 2 * u * t * ctrlY + t * t * apexY,
  ];
}

export function mountainPath(width, baseY, rise, peak) {
  if (!width) return '';
  const m = mountainPoints(width, baseY, rise, peak);
  const lc = m.leftX + (m.apexX - m.leftX) * 0.62;
  const rc = m.apexX + (m.rightX - m.apexX) * 0.38;
  return (
    `M ${r(m.leftX)} ${r(baseY)} ` +
    `Q ${r(lc)} ${r(m.dropY)}, ${r(m.apexX)} ${r(m.apexY)} ` +
    `Q ${r(rc)} ${r(m.dropY)}, ${r(m.rightX)} ${r(baseY)} Z`
  );
}

// The half turned towards the light, as its own shape to fill a shade lighter.
// Two values meeting along the ridgeline is what gives a mountain a near side
// and a far one; a stroke along the top only outlines it.
export function mountainLit(width, baseY, rise, peak) {
  if (!width) return '';
  const m = mountainPoints(width, baseY, rise, peak);
  const rc = m.apexX + (m.rightX - m.apexX) * 0.38;
  return (
    `M ${r(m.apexX)} ${r(m.apexY)} ` +
    `Q ${r(rc)} ${r(m.dropY)}, ${r(m.rightX)} ${r(baseY)} ` +
    `L ${r(m.apexX)} ${r(baseY)} Z`
  );
}

// Snow, on the ones high enough to hold it. The underside is ragged because
// snow lies in the gullies and melts off the ridges, and a straight snowline
// is the one thing that makes a painted mountain look painted.
export function mountainSnow(width, baseY, rise, peak, drop = 0.26) {
  if (!width || !peak.snow) return '';
  const m = mountainPoints(width, baseY, rise, peak);
  const lc = m.leftX + (m.apexX - m.leftX) * 0.62;
  const rc = m.apexX + (m.rightX - m.apexX) * 0.38;
  const t = 1 - drop;
  const [lx, ly] = onSlope(m.leftX, baseY, lc, m.dropY, m.apexX, m.apexY, t);
  const [rx, ry] = onSlope(m.rightX, baseY, rc, m.dropY, m.apexX, m.apexY, t);
  const span = rx - lx;
  const dip = (ry - m.apexY) * 0.42;
  return (
    `M ${r(lx)} ${r(ly)} L ${r(m.apexX)} ${r(m.apexY)} L ${r(rx)} ${r(ry)} ` +
    `L ${r(lx + span * 0.78)} ${r(ry - dip)} ` +
    `L ${r(lx + span * 0.58)} ${r(ry + dip * 0.5)} ` +
    `L ${r(lx + span * 0.36)} ${r(ly - dip * 0.8)} ` +
    `L ${r(lx + span * 0.18)} ${r(ly + dip * 0.4)} Z`
  );
}

// Gullies: the creases that run down from the ridge. Two per mountain, short,
// and only on the lit side where they would actually be seen as shadow.
export function mountainGullies(width, baseY, rise, peak) {
  if (!width) return [];
  const m = mountainPoints(width, baseY, rise, peak);
  const rc = m.apexX + (m.rightX - m.apexX) * 0.38;
  return [0.34, 0.6].map((reach) => {
    const [ex, ey] = onSlope(m.rightX, baseY, rc, m.dropY, m.apexX, m.apexY, 1 - reach);
    const midX = m.apexX + (ex - m.apexX) * 0.45;
    const midY = m.apexY + (ey - m.apexY) * 0.62;
    return `M ${r(m.apexX)} ${r(m.apexY)} Q ${r(midX)} ${r(midY)}, ${r(ex)} ${r(ey)}`;
  });
}

// The treeline at the foot of the ranges.
//
// It replaces a smoothed silhouette that was reported as "an unknown curved
// line" — which is fair, because a soft wave between mountains and water is
// not obviously anything. A row of small, uneven conifer tops is read as trees
// immediately and as a line never.
//
// The jitter is from a fixed seed rather than Math.random: the far shore must
// be the same shore on every render, or it crawls.
export function treeLine(width, baseY, rise, step = 9, seed = 7) {
  if (!width) return '';
  let state = seed;
  const next = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
  const from = -step * 2;
  const to = width + step * 2;
  let d = `M ${r(from)} ${r(baseY)}`;
  for (let x = from; x < to; x += step) {
    const tip = baseY - rise * (0.42 + 0.58 * next());
    const foot = baseY - rise * 0.14 * next();
    d += ` L ${r(x + step * 0.5)} ${r(tip)} L ${r(x + step)} ${r(foot)}`;
  }
  return `${d} L ${r(to)} ${r(baseY)} L ${r(from)} ${r(baseY)} Z`;
}

export const BANK = [
  [-0.12, 0.54],
  [0.05, 0.93],
  [0.17, 0.6],
  [0.29, 0.88],
  [0.42, 0.56],
  [0.55, 0.96],
  [0.68, 0.62],
  [0.81, 0.86],
  [0.93, 0.58],
  [1.12, 0.8],
];

function bankPoints(width, baseY, rise, profile) {
  return profile.map(([fx, fh]) => [width * fx, baseY - rise * fh]);
}

// The bank as a shape to fill: the silhouette, then down to the waterline and
// back along it.
export function bankPath(width, baseY, rise, profile = BANK) {
  if (!width) return '';
  const pts = bankPoints(width, baseY, rise, profile);
  const first = pts[0];
  const last = pts[pts.length - 1];
  return `${smoothThrough(pts)} L ${r(last[0])} ${r(baseY)} L ${r(first[0])} ${r(baseY)} Z`;
}

// The bank as a line to stroke: the silhouette ONLY, open at both ends.
//
// This exists because stroking the filled path instead drew the bottom edge
// too — a hard line along the waterline, all the way across. A rim light
// belongs on the skyline and nowhere else.
export function bankLine(width, baseY, rise, profile = BANK) {
  if (!width) return '';
  return smoothThrough(bankPoints(width, baseY, rise, profile));
}

// Reeds, in the shallows at either edge.
//
// They are at the edges for two reasons and both matter. Reeds grow where the
// water is shallow, which is at the bank, not in the middle of a pond — and
// the middle of this particular pond has the greeting across it, so anything
// standing there is behind type.
//
// `x` is a fraction of the width, `h` a fraction of the scene height, `lean`
// the sideways drift of the tip in points, `blade` the reach of a leaf if it
// has one, and `head` whether it is a bulrush rather than a plain reed. No two
// are the same height or lean the same way: a row of identical uprights is a
// fence.
export const REEDS_LEFT = [
  { x: 0.012, h: 0.2, lean: -7, head: false, blade: 0 },
  { x: 0.042, h: 0.28, lean: 5, head: true, blade: 0 },
  { x: 0.072, h: 0.16, lean: -4, head: false, blade: 30 },
  { x: 0.1, h: 0.24, lean: 8, head: false, blade: 0 },
  { x: 0.128, h: 0.13, lean: -3, head: false, blade: 0 },
];

export const REEDS_RIGHT = [
  { x: 0.988, h: 0.19, lean: 6, head: false, blade: 0 },
  { x: 0.962, h: 0.26, lean: -6, head: true, blade: 0 },
  { x: 0.934, h: 0.15, lean: 4, head: false, blade: -28 },
  { x: 0.906, h: 0.22, lean: -8, head: false, blade: 0 },
  { x: 0.879, h: 0.12, lean: 3, head: false, blade: 0 },
];

// A stem: one curve from the waterline to the tip, bending the way it leans.
export function reedStem(x, baseY, h, lean) {
  return (
    `M ${r(x)} ${r(baseY)} ` +
    `Q ${r(x + lean * 0.18)} ${r(baseY - h * 0.56)}, ${r(x + lean)} ${r(baseY - h)}`
  );
}

// A blade: out to the tip and back to the base, so it has width at the bottom
// and comes to a point at the top, the way a leaf does.
export function reedBlade(x, baseY, h, spread) {
  const foot = x + (spread > 0 ? 3.5 : -3.5);
  return (
    `M ${r(x)} ${r(baseY)} ` +
    `Q ${r(x + spread * 0.16)} ${r(baseY - h * 0.7)}, ${r(x + spread)} ${r(baseY - h)} ` +
    `Q ${r(x + spread * 0.52)} ${r(baseY - h * 0.44)}, ${r(foot)} ${r(baseY)} Z`
  );
}

// The bulrush head, sitting just under the tip of its own stem.
export function reedHead(x, baseY, h, lean) {
  return { cx: r(x + lean * 0.84), cy: r(baseY - h * 0.84), rx: 2.7, ry: r(h * 0.13) };
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

// Three pads, and no two the same.
//
// They used to be one leaf drawn three times at three sizes, which is what a
// pattern looks like rather than what a pond looks like. The thing that makes
// each one its own is where the stem enters — the wedge — because that is the
// one feature of a lily pad that is never in the same place twice, and
// everything else follows it: the veins all start at the stem, so moving the
// wedge rearranges the whole leaf.
//
// They differ in build as well as in cut: one is round, one is wide and flat,
// one sits between. All live in the same 140 × 64 box so they can be swapped
// and scaled without anything around them changing.
export const PAD_SHAPES = [
  {
    // The stem enters from the top, and the leaf is the standard build.
    body: LEAF_BODY,
    veins: LEAF_VEINS,
    sheen: LEAF_SHEEN,
    rim: 5,
  },
  {
    // Rounder and deeper, with the stem entering from the upper left, so most
    // of the veins fan to the right.
    body: 'M70 32 L11.7 21.4 A62 31 0 1 0 48.8 2.9 Z',
    veins: [
      'M70 32 L130 32',
      'M70 32 L112 53',
      'M70 32 L70 61',
      'M70 32 L28 53',
      'M70 32 L112 11',
      'M70 32 L82 3',
    ],
    sheen: 'M84 10 C 98 9, 112 13, 122 19',
    rim: 4.5,
  },
  {
    // Wide and flat — the one lying nearly edge-on to you — with the stem
    // coming in from the right.
    body: 'M70 32 L133 22.3 A68 26 0 1 0 133 41.7 Z',
    veins: [
      'M70 32 L4 32',
      'M70 32 L23 50',
      'M70 32 L70 57',
      'M70 32 L117 50',
      'M70 32 L23 14',
      'M70 32 L117 14',
    ],
    sheen: 'M28 20 C 40 12, 56 9, 70 9',
    rim: 5.5,
  },
];
