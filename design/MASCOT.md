# The mascot

A frog, because the app is called Pond and because a household is easier to
recognise as faces than as colours. It is not decoration: it does a job on four
screens and is banned from every screen showing an amount.

## Where it appears

The canvas has these as framed slots, at the sizes the screens have room for.

| Moment | Size | Pose |
|---|---|---|
| Onboarding | 130 × 130 | Waving, facing the reader |
| Empty states | 96 × 96 | Sitting, unbothered — never sad, an empty list is not a failure |
| Privacy mode | covers the figure | Holding a lily pad over the amounts |
| Moments worth marking | 96 × 96 | Both arms up, celebrating |

**Never beside a figure.** Not next to a total, not in the corner of the money
screen, not in a transaction row. An amount is read in a hurry and in bad
light, and anything competing with it costs trust. The frog may cover an
amount; it may not stand next to one.

**One per household member.** A household of five is five frogs, told apart by
face as well as by colour. Colour alone stops working past two people, and it
never worked for anyone who cannot tell two of them apart.

## Colours

Golden yellow body `#F2B33D`, cream belly `#F4F2EC`, deep teal-green for eyes
and outlines `#0E7C66`.

Warm against the app's cool brand green, so the character stands out without
fighting anything. It sits one shade richer than the interface accent
`#E8A33D`, close enough to look like the same family rather than something
stuck on afterwards.

One thing to watch: that warm tone also carries "something wants your
attention" — the dot on the bell, the banner for writes waiting on a
connection. If the two start competing once the frog is real, the alert colour
moves and the frog stays.

## How it is made

**Drawn in code, as SVG, not generated as a picture.** Decided on 4 October
2026, after a generated frog was used as the reference for the look.

The reason is the second half of what was asked for: it has to move. A picture
can be slid about and scaled and nothing else. A frog built from named parts —
body, haunches, eye whites, irises, lids — can blink, breathe and look around,
and those three are most of what separates a character that is alive from one
that is stuck on. It also comes in both themes from one source, renders at any
size, and costs nothing to ship.

`src/components/pond/frogShapes.js` holds the shapes and the two palettes;
`Frog.js` holds the three movements. Nothing about the drawing is in the
component and nothing about the animation is in the shapes.

**The style moved too.** This file used to say flat, no gradients, no shading.
It now has soft shading, because the pond it sits in is built the same way —
the sky, the light and the water are all gradients — and a hard flat frog in
front of them reads as a sticker on a photograph.

**Every detail is cut to the part it belongs to.** Shading, dapples and brow
ridges were laid on loose and landed on edges, over the eyes and outside the
silhouette — reported as smudges and stray circles, which is what they were.
Nudging coordinates does not fix that in general: a spot on the head is clipped
by the head, shading on the body is clipped by the body, and the brows go on
BEFORE the whites so a stray one cannot end up across an eye.

**What it does, and only this.** It breathes — the body swells while the feet
stay on the ground. The whole frog used to rise and fall, which reads as the
picture being moved rather than as a creature filling its chest. It turns its
head — about where the head meets the body, because a head that pivots on its
own chin is a head on a spike. Its eyes travel inside that turn and a beat
behind it, the way eyes lead and heads follow. It blinks. And it shifts its
weight on the near haunch, slowest of all. And every so often it shuts its
mouth for a moment, because a smile held without interruption is a photograph
of a smile.

**The mouth shuts because the lower lip comes up over it**, and it took three
goes to learn why nothing else works. The lip is an arc that dips ten points
below where it starts. Any scale maps a curve to a flatter curve, so a mouth
squeezed towards the lip line lands on a STRAIGHT line the lip can never meet —
and what you see at the end is a dark line above the smile, a second mouth. It
is not an easing problem and no amount of fading hides it: fading a dark mouth
over a gold face just turns it into a pale band halfway through. The cover's
top edge IS the lip curve, so there is no seam to line up and nothing left
over, and it is in the muzzle's own colour so it cannot be told from the muzzle
it slides on.

None of the six divides into another, so it never returns to where it started
at the same moment twice, which is the difference between alive and looping.
The test for each is whether you would notice it while reading the figures. You
should not.

**Turned, not facing front.** A frog drawn square-on reads as a diagram of a
frog. It is turned a few degrees: the far eye is smaller and tucked towards the
middle, the near haunch is bigger and overlaps the body, the far one is mostly
behind it. A face slid sideways is not a turn; foreshortening is.

**Arms in front of the belly, and a contour on everything.** Arms behind the
body are a change in the silhouette and nothing more — they could not be seen
and were reported missing. Every part now carries a darker contour, which is
what separates an arm from the body it is in front of, and it is most of what
the reference had that the first drawings did not.

**The proportions are the likeness.** The first attempt had every part in the
right place and read as a ball, because a sitting frog is not round — it is a
narrow head on a wide pair of haunches. Head about two thirds the width of the
hips, eyes a fifth of the width each, belly well under half, and four feet that
each clear the body: that silhouette is what makes it legible at 96 pixels, not
the detail inside it.

## The prompt

Kept for reference, and for anyone generating a pose to draw from rather than
to ship.

Step one, the character itself:

```
A friendly frog mascot character for a household finance app.
Flat vector illustration style, thick rounded shapes, bold clean
forms, no gradients, no texture, no shading. Body in warm golden
yellow #F2B33D, belly in soft cream #F4F2EC, eyes and outlines in
deep teal-green #0E7C66. Calm, warm and trustworthy, slightly
playful — not childish, not cartoonish, not realistic.
Front-facing, standing, symmetrical, simple geometric shapes,
clearly readable at 96 pixels. Plain white background, no scene,
no shadow, full body visible with margin around it.
```

Step two, each pose separately, with the character from step one given back as
a reference or ingredient:

```
The same frog character, identical colours and proportions:
waving hello with one arm raised, friendly and open.
```

```
The same frog character, identical colours and proportions:
sitting down calmly, relaxed and content.
```

```
The same frog character, identical colours and proportions:
holding a large green lily pad in front of its body like a shield,
covering its chest. The lily pad is a separate clear shape.
```

```
The same frog character, identical colours and proportions:
both arms raised, celebrating, happy.
```

Every pose ends with `Plain white background, flat vector style, no shadow.`

The two words that matter most are **same character**: without them each pose
comes back as a different frog, and four different frogs is worse than none.

## What the app needs back

SVG where possible — the app already draws with `react-native-svg`, so vector
scales without loss and can be animated. Otherwise PNG on a transparent
background, at least 512 × 512, one file per pose.

The lily pad pose is worth having as **two separate shapes**, frog and leaf,
so the leaf can lift away when privacy mode is switched off. As one flat image
it still works, just without the movement.

## Which tool

- **Recraft** produces real vector and is the only one whose output drops
  straight into the app.
- **Flow, Midjourney, Ideogram** produce raster. Flow's ingredients and
  Midjourney's character reference both exist to keep a character consistent
  across images, which is the hard part here.
- **An illustrator** is the only route that guarantees four poses of one
  character, at around 50–150 EUR.
