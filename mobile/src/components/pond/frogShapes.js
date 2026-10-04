// The frog, as shapes.
//
// Drawn in code rather than dropped in as a picture, and that is the whole
// decision. A picture can be slid about and scaled and nothing else. A frog
// built from named parts can turn its head, blink, shift a foot and follow you
// with its eyes — and the reference this is drawn from cannot do any of that,
// which is why it is a reference and not the asset.
//
// Everything lives in a 200 × 200 box, so it goes on screen at any size
// without a number here changing.
//
// Two things were learned the hard way and are worth keeping written down.
// The first version was a ball: every part in the right place and none of it
// readable, because a sitting frog is not round — it is a narrow head on a
// wide pair of haunches, and that silhouette is what carries at 96 pixels.
// The second was flat and faced straight ahead, which is what made it read as
// a diagram of a frog. It is turned a few degrees now, its arms are in FRONT
// of its belly where arms can be seen, and it is shaded as a solid rather
// than filled as a shape.

export const FROG_BOX = 200;

// Where the feet actually are in that box, as a fraction of it. The toes sit
// at about 188 of 200, not at the bottom edge — so anything that stands the
// frog on something has to aim THIS line at it, not the box. Aiming the box
// left it hovering about seven points above whatever it was meant to be on.
export const FOOT_LINE = 0.94;

// How far the head is turned, in the drawing's own units. Everything in the
// head leans by this, and the far eye is smaller and nearer the edge, which is
// what a turn actually looks like — not a face slid sideways.
export const TURN = 5;

export const EYE = {
  // Near eye: larger, further from the centre line.
  near: { cx: 62 - TURN, cy: 40, rx: 23, ry: 25, irisR: 15, pupilR: 8.5 },
  // Far eye. Foreshortened and tucked in towards the middle — but only a
  // little. At four fifths of the near one it was read as one eye being bigger
  // than the other, which is a fault; at nine tenths it is read as a head
  // turned slightly away, which is the point.
  far: { cx: 135 - TURN, cy: 42, rx: 21, ry: 22.5, irisR: 13.6, pupilR: 7.8 },
  // Both irises sit in and down. Dead centre reads as a stare.
  irisDx: 2.5,
  irisDy: 3.5,
};

// The ground. A cast shadow is most of what stops a drawing floating.
export const GROUND = { cx: 100, cy: 185, rx: 72, ry: 10 };

// Haunches. The near one is bigger and overlaps the body; the far one is
// mostly hidden behind it. Equal haunches are a front view by another name.
export const HAUNCH_NEAR =
  'M 70 104 C 40 102, 14 120, 10 146 C 6 168, 18 184, 38 185 C 58 186, 74 170, 77 148 C 80 130, 78 114, 70 104 Z';
export const HAUNCH_FAR =
  'M 134 108 C 158 106, 180 122, 184 146 C 188 166, 178 180, 161 181 C 145 182, 131 169, 128 150 C 125 134, 128 117, 134 108 Z';

// The torso. Egg-shaped, leaning very slightly with the turn.
export const TORSO =
  'M 98 58 ' +
  'C 70 58, 44 84, 41 116 ' +
  'C 38 150, 54 176, 78 181 ' +
  'C 92 184, 112 184, 128 180 ' +
  'C 148 174, 163 148, 160 116 ' +
  'C 157 84, 132 58, 98 58 Z';

// The core shadow down the far side, and the light along the near one. Two
// shapes, because a gradient alone gives a ball and not a body.
export const SHADE =
  'M 138 76 C 154 98, 157 130, 147 155 C 139 174, 123 182, 108 183 ' +
  'C 132 168, 142 139, 140 111 C 139 95, 138 83, 138 76 Z';
export const SHEEN =
  'M 66 80 C 54 96, 48 114, 49 132 C 50 146, 54 158, 61 166 ' +
  'C 52 148, 52 119, 60 100 C 63 90, 65 84, 66 80 Z';

// The head, as its own mass so it can turn without the body going with it.
export const HEAD =
  'M 98 18 ' +
  'C 66 18, 40 40, 38 68 ' +
  'C 36 94, 60 110, 98 110 ' +
  'C 136 110, 160 94, 158 68 ' +
  'C 156 40, 130 18, 98 18 Z';

// The bumps the eyes sit in, in the head colour so they are part of the same
// creature rather than balls balanced on it.
export const EYE_BUMPS = [
  { cx: 62 - TURN, cy: 40, r: 29 },
  { cx: 135 - TURN, cy: 42, r: 26.5 },
];

// A ridge over each eye. Small, and the thing that gives the face an
// expression rather than two circles.
// A ridge along the top rim of each eye bump — ON the bump, following it, not
// floating above it. They used to be drawn after the whites and crossed them,
// which is the "eyebrows over the eyes" that was reported. They go on before
// the whites now, so even a stray one cannot land on an eye.
export const BROWS = [
  'M 32 33 Q 57 7, 83 31',
  'M 108 36 Q 130 12, 153 36',
];

// The muzzle: a lighter mass under the eyes, which is what makes the mouth sit
// in a face instead of on it.
export const MUZZLE = { cx: 97 - TURN, cy: 84, rx: 46, ry: 23 };

// An open mouth, because the reference smiles with one and because a closed
// line is the difference between friendly and polite. The interior is dark,
// the tongue sits at the bottom of it.
export const MOUTH_OPEN =
  'M 52 74 C 62 104, 134 104, 142 74 C 126 88, 68 88, 52 74 Z';
export const MOUTH_LINE = 'M 52 74 C 68 88, 126 88, 142 74';
export const TONGUE = { cx: 97 - TURN, cy: 92, rx: 23, ry: 9 };

// The mouth does not shut by shrinking. It shuts because the lower lip comes
// up over it.
//
// Shrinking was tried twice and is wrong in principle: a scale maps a curve to
// a flatter curve, so a mouth squeezed towards the lip line collapses onto a
// STRAIGHT line while the lip itself stays an arc dipping ten points below it.
// The two cannot meet, and what you get at the end of the close is a straight
// dark line above the smile — a second mouth. That is what was reported, twice,
// and no amount of easing fixes a shape that cannot reach its target.
//
// This is the lip curve with a body hanging under it, in the muzzle's own
// colour. Slid down it is inside the muzzle and invisible; slid up its top edge
// IS the lip curve, so the mouth behind it is covered exactly, with no seam to
// line up and nothing left over.
export const MOUTH_COVER = 'M 52 74 C 68 88, 126 88, 142 74 L 142 114 L 52 114 Z';

// How far down it waits while the mouth is open. Far enough that the muzzle
// clips all of it.
export const COVER_DROP = 34;

export const NOSTRILS = [
  { cx: 86 - TURN, cy: 62, r: 2.4 },
  { cx: 108 - TURN, cy: 62, r: 2.4 },
];

// Arms, in FRONT of the belly. This is the fix for arms that could not be
// seen: behind the body they are a silhouette change and nothing more.
export const ARM_NEAR =
  'M 48 112 C 32 128, 28 152, 38 168 C 46 180, 64 180, 68 168 C 73 150, 64 124, 48 112 Z';
export const ARM_FAR =
  'M 152 116 C 166 132, 168 155, 159 168 C 152 178, 137 178, 133 167 C 129 150, 138 128, 152 116 Z';

export const BELLY = { cx: 98 - TURN, cy: 140, rx: 43, ry: 42 };

// Four feet, and they are not the same. The back pair splay out at the
// corners; the front pair are small and set in. Toe pads catch the light.
export const BACK_TOES = [
  { cx: 14, cy: 180, r: 9 },
  { cx: 29, cy: 187, r: 9.5 },
  { cx: 47, cy: 188, r: 9 },
  { cx: 186, cy: 178, r: 8 },
  { cx: 172, cy: 185, r: 8.5 },
  { cx: 156, cy: 186, r: 8 },
];

// Set ON the hands. They used to be drawn beside them — the first toe of each
// hand sat clear of the arm it belonged to, which is the fingers "not square"
// that was reported. The near hand ends about x 40 to 66, the far one about
// 135 to 157, and these are inside both.
export const FRONT_TOES = [
  { cx: 42, cy: 177, r: 6.5 },
  { cx: 53, cy: 182, r: 7 },
  { cx: 64, cy: 180, r: 6.5 },
  { cx: 155, cy: 176, r: 6 },
  { cx: 145, cy: 181, r: 6.5 },
  { cx: 135, cy: 180, r: 6 },
];

// Dapples belong to the part they are on and are cut to its shape. Scattered
// over the whole drawing they landed on edges and on things that were not
// there — the stray circles that were reported. Each list here is clipped to
// its own piece, so a spot cannot leave the frog.
export const SPOTS_HEAD = [
  { cx: 92, cy: 23, rx: 4, ry: 3.2 },
  { cx: 108, cy: 20, rx: 3, ry: 2.4 },
  { cx: 46, cy: 66, rx: 3.4, ry: 2.8 },
  { cx: 146, cy: 68, rx: 3, ry: 2.4 },
];

export const SPOTS_NEAR = [
  { cx: 36, cy: 132, rx: 4.6, ry: 3.8 },
  { cx: 26, cy: 155, rx: 3.6, ry: 3 },
  { cx: 48, cy: 152, rx: 3.2, ry: 2.6 },
];

export const SPOTS_FAR = [
  { cx: 162, cy: 138, rx: 4, ry: 3.2 },
  { cx: 170, cy: 158, rx: 3.2, ry: 2.6 },
];

// Pale tips, taken from the toes themselves rather than listed by hand. Listed
// they covered one side only, which is exactly how it looked: dots on the toes
// down one side and none down the other. Derived, there is no side to forget.
export function toePads(toes) {
  return toes.map((t) => ({ cx: t.cx - t.r * 0.18, cy: t.cy - t.r * 0.34, r: t.r * 0.46 }));
}

export function palette(night) {
  if (night) {
    return {
      bodyTop: '#DCAE40',
      bodyLow: '#9E7220',
      haunch: '#C28F2B',
      haunchFar: '#A77B24',
      limb: '#CE9A31',
      edge: '#5E400C',
      shade: '#7A560F',
      sheen: '#F0CC73',
      bellyTop: '#E6D9B8',
      bellyLow: '#C6B288',
      muzzle: '#D2B268',
      spot: '#B2851F',
      eyeWhite: '#F2F0E6',
      iris: '#0B5A4B',
      pupil: '#05231E',
      glint: '#FFFFFF',
      lid: '#C9982F',
      mouth: '#4A1E22',
      tongue: '#A05259',
      ground: '#02100C',
      pad: '#E8D9A8',
    };
  }
  return {
    bodyTop: '#FBDE8A',
    bodyLow: '#E09A24',
    haunch: '#F2BE45',
    haunchFar: '#DCA42F',
    limb: '#F0B63C',
    edge: '#8A5A0E',
    shade: '#C07F15',
    sheen: '#FFF0BC',
    bellyTop: '#FDF8E8',
    bellyLow: '#F0DFB4',
    muzzle: '#F4CF7D',
    spot: '#D9951F',
    eyeWhite: '#FFFDF4',
    iris: '#0E7C66',
    pupil: '#05231E',
    glint: '#FFFFFF',
    lid: '#F4C44E',
    mouth: '#6E2A2F',
    tongue: '#D97C84',
    ground: '#063029',
    pad: '#FFF1C4',
  };
}
