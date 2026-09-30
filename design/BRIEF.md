# Design brief

Written to be handed whole to a design tool — Claude's designer, Google Stitch,
or a person. Deliberately specific: a brief that says "modern and clean"
produces something that could be any app.

---

## The product

A phone app for tracking household money and shared plans. Someone can use it
alone, or share a household with a partner, a flatmate or a family, and see
what the household spends, earns and has planned.

It exists because doing this between two people in a chat thread does not work.
The people using it are not accountants. They open it for twenty seconds after
paying for groceries, and once a week to see where the month went.

Android first, phones only. Serbian and English. Dark and light.

## The one rule

**Character lives everywhere there are no numbers. Where money is on screen,
the design is calm and precise.**

Onboarding, empty states, the household screen, confirmations, celebrations and
errors carry warmth, illustration, movement and a mascot. A screen showing an
amount carries none of it: clear hierarchy, generous space, sharp figures,
nothing competing for the eye.

Duolingo and Monobank both do this. The mascot is everywhere, and the numbers
are as serious as a bank's.

## Tone

Warm, calm, trustworthy. Playful in the margins, never at the cost of
legibility. The feeling to produce is "I know what my money is doing, and that
was easy" — not "look at this app".

Not corporate, not austere, not grey, not dense with data, not childish.

## References, and what to take from each

**Revolut, Wise** — take the treatment of numbers. Big confident figures, a lot
of air, one clear primary action, restrained colour. Do not take their coldness
or their density of features.

**A yellow wallet app with a frog mascot** — take the mascot's role: a
character that belongs to the product, appears at moments rather than
constantly, and does something useful rather than decorative. Take the warmth
of one strong brand colour used generously. Do not take the weight of
illustration onto screens that carry figures.

**One specific idea to design properly:** the app can hide every amount for
privacy. The mascot should perform that — covering the figures, then revealing
them. That single animation deserves real care; it is where character and
function meet.

## What to produce, in order

1. **Foundations.** Colour tokens for light and dark, type scale, spacing
   scale, corner radii, elevation, motion durations and easing. Named, so they
   can be implemented as variables rather than hex codes inside screens.
2. **Components.** Buttons in every state, inputs, cards, list rows, tabs,
   chips, toast, empty state, modal sheet, avatar, and the amount display in
   three sizes.
3. **The mascot**, in the poses the product needs: greeting, celebrating,
   covering the amounts, nothing planned, something went wrong, and one variant
   per household member so people are told apart by face and not only colour.
4. **Screens**, in this order: month overview with totals, adding an expense,
   the transaction list, a calendar month with one day open, statistics, the
   household screen with its members, onboarding.

## Constraints that are not negotiable

- Built in React Native. Nothing that needs a blur behind a moving surface:
  real blur is Android 12 and above only, and the app must look right below it.
- Every tappable thing at least 48dp.
- Text contrast meeting WCAG AA in both themes. Amounts get read at a glance in
  bad light.
- Works at 360dp width with the system font scaled up.
- Colour never carries a meaning alone: a household member is told apart by
  face and name as well as by colour.
- Foundations before screens. Screens drawn first produce pretty pictures that
  do not fit one another.

## What the design must solve, not merely decorate

- **Statistics is the worst screen today** — charts and circles stacked with no
  hierarchy and no answer to "so what?". It should open with one plain sentence
  about the month and let the detail follow.
- **The calendar's day panel** fits barely two entries and needs a precise tap
  on a small arrow to expand.
- **Someone alone must not see the machinery of sharing.** Half the current
  interface is about mine-versus-ours, which means nothing to one person.
- **A stranger's first two minutes.** They should have entered one expense and
  understood what the app is for, without reading anything.
