// The frog, as shapes.
//
// Drawn rather than generated, and drawn in code rather than dropped in as a
// picture, for one reason above all the others: it has to move. A PNG can be
// slid about and scaled and nothing else, while a frog made of named parts can
// blink, breathe and look around — and those three are most of what makes a
// character feel alive rather than stuck on.
//
// Everything lives in a 200 × 200 box so it can be put on screen at any size
// without a single number here changing. Nothing is centred on 100 by
// accident: the body is symmetrical about it, and the eyes are turned very
// slightly inwards from it, which is the difference between looking AT someone
// and staring past them.
//
// The first version was a ball. Every part was there and none of it read,
// because a sitting frog is not round — it is a narrow head on a wide pair of
// haunches, and what makes it legible at 96 pixels is that silhouette and not
// the detail inside it. These proportions come from measuring a reference:
// head about two thirds the width of the hips, eyes a fifth of the width
// each, the belly well under half, and four feet that each clear the body.

export const FROG_BOX = 200;

export const EYE = {
  left: { cx: 62, cy: 48 },
  right: { cx: 138, cy: 48 },
  rx: 24,
  ry: 26,
  // The iris sits in and down a little. Dead centre reads as a stare.
  irisDx: 3,
  irisDy: 4,
  irisR: 16,
  pupilR: 9,
};

// The haunches, behind the body and bulging well past it. A sitting frog is
// mostly knees, and these are what stop the silhouette being a circle.
export const HAUNCH_LEFT =
  'M 70 106 C 42 104, 18 120, 12 144 C 7 164, 16 181, 34 183 C 52 185, 70 172, 74 150 C 77 132, 76 116, 70 106 Z';
export const HAUNCH_RIGHT =
  'M 130 106 C 158 104, 182 120, 188 144 C 193 164, 184 181, 166 183 C 148 185, 130 172, 126 150 C 123 132, 124 116, 130 106 Z';

// The body and head as one shape, because a frog has no neck to draw.
// Narrow across the top where the eyes are, widest at the hips, and drawn back
// in at the bottom so it sits rather than spreads.
export const BODY =
  'M 64 40 ' +
  'C 44 50, 33 76, 32 102 ' +
  'C 31 132, 40 160, 58 174 ' +
  'C 72 184, 128 184, 142 174 ' +
  'C 160 160, 169 132, 168 102 ' +
  'C 167 76, 156 50, 136 40 ' +
  'C 124 34, 114 40, 100 41 ' +
  'C 86 40, 76 34, 64 40 Z';

// The two bumps the eyes sit in, drawn in the body colour so they read as part
// of the same creature rather than as balls balanced on it.
export const EYE_BUMPS = [
  { cx: 62, cy: 46, r: 30 },
  { cx: 138, cy: 46, r: 30 },
];

// Smaller and lower than the first attempt, so the gold of the body stays
// visible around it. A belly that fills the body turns the frog into a bib.
export const BELLY = { cx: 100, cy: 138, rx: 39, ry: 41 };

// The smile. Wide, closed, and lifted at the corners — an open mouth belongs
// to the celebrating pose, not to a frog that is simply sitting there.
export const MOUTH = 'M 50 86 C 64 118, 136 118, 150 86';
export const MOUTH_CORNERS = [
  { cx: 50, cy: 86, r: 2.8 },
  { cx: 150, cy: 86, r: 2.8 },
];

export const NOSTRILS = [
  { cx: 90, cy: 70, r: 2.4 },
  { cx: 110, cy: 70, r: 2.4 },
];

// Front arms: short, slanting in from the body to hands set near the middle,
// the way a frog props itself up.
export const ARM_LEFT = 'M 52 126 C 46 144, 54 166, 68 176 C 76 182, 88 180, 88 171 C 88 156, 72 134, 52 126 Z';
export const ARM_RIGHT = 'M 148 126 C 154 144, 146 166, 132 176 C 124 182, 112 180, 112 171 C 112 156, 128 134, 148 126 Z';

// Four feet, and they are different. The back pair are big and splayed out at
// the corners; the front pair are small and close in. Drawing all four the
// same is what made the first version look like it was standing on a fringe.
export const BACK_TOES = [
  { cx: 16, cy: 180, r: 9 },
  { cx: 31, cy: 187, r: 9.5 },
  { cx: 48, cy: 188, r: 9 },
  { cx: 184, cy: 180, r: 9 },
  { cx: 169, cy: 187, r: 9.5 },
  { cx: 152, cy: 188, r: 9 },
];

export const FRONT_TOES = [
  { cx: 70, cy: 180, r: 6.5 },
  { cx: 81, cy: 184, r: 7 },
  { cx: 92, cy: 183, r: 6.5 },
  { cx: 130, cy: 180, r: 6.5 },
  { cx: 119, cy: 184, r: 7 },
  { cx: 108, cy: 183, r: 6.5 },
];

// Dapples. Scattered, never mirrored — a symmetrical pattern reads as a
// uniform rather than as skin.
export const SPOTS = [
  { cx: 100, cy: 28, rx: 5, ry: 4 },
  { cx: 44, cy: 86, rx: 6, ry: 5 },
  { cx: 158, cy: 96, rx: 5, ry: 4.5 },
  { cx: 50, cy: 124, rx: 5.5, ry: 4.5 },
  { cx: 152, cy: 132, rx: 4.5, ry: 4 },
  { cx: 80, cy: 30, rx: 3.5, ry: 3 },
];

export function palette(night) {
  if (night) {
    return {
      bodyTop: '#D9A93B',
      bodyLow: '#A87B24',
      haunch: '#C08F2C',
      limb: '#B8862A',
      edge: '#6E4C10',
      bellyTop: '#E4D7B6',
      bellyLow: '#CBB98F',
      spot: '#B98B29',
      eyeWhite: '#EFEDE2',
      iris: '#0B5A4B',
      pupil: '#06302A',
      glint: '#FFFFFF',
      lid: '#C9982F',
    };
  }
  return {
    bodyTop: '#F9D576',
    bodyLow: '#E8A52E',
    haunch: '#F0BA42',
    limb: '#E3A02C',
    edge: '#9A6512',
    bellyTop: '#FCF5E0',
    bellyLow: '#F2E2BB',
    spot: '#DD9B26',
    eyeWhite: '#FFFDF4',
    iris: '#0E7C66',
    pupil: '#06302A',
    glint: '#FFFFFF',
    lid: '#F2BE45',
  };
}
