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

**What it does, and only this.** It breathes with its whole body, about a
fifteenth of its size. It blinks. Its eyes drift two points. All three are
slow, small, and on counts that do not meet: a mascot that is always doing
something is a distraction on a screen that also carries what you spent this
month.

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
