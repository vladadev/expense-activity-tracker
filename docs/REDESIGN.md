# The redesign — what is done and what is left

The working list for the Pond redesign. It is updated **every time** the plan
changes, in the same turn the change is agreed, so that at any moment this file
and the app agree about what remains.

Three things must stay in step, and a change is not finished until all three
are: the **code**, the **canvas**
(["Pond — design system and screens"](https://claude.ai/artifact/FZPPbbmEo6aRk3ub8v7CgQ)),
and this file.

Status: `[ ]` not started, `[~]` in progress, `[x]` done, `[-]` dropped with
the reason kept.

Last updated: 3 October 2026

---

## How it ships

Everything here goes to the **design** channel, into the separate `Pond (test)`
app, and nowhere else. Her phone keeps the app it has until the whole thing is
finished and moved across in one go.

```bash
cd mobile && APP_VARIANT=design npm run ota:export
```
```bash
cd mobile && APP_VARIANT=design npm run ota:maps
```
```bash
cd mobile && APP_VARIANT=design npx eas-cli update --branch design --input-dir dist --skip-bundler --message "what changed"
```

The new look is also gated in code by `IS_DESIGN`, so `main` stays shippable at
every moment and an urgent fix to the real app cannot carry half a redesign
with it.

---

## Done

- [x] **Palette and scales.** Pond in light and night beside the old themes,
      spacing on a grid of four, radii, type scale, motion durations. Outfit
      for what is noticed, IBM Plex Sans for what is read, both loaded.
- [x] **The tab bar.** Water across the full width fading up into the screen,
      two wave layers at different speeds, the bar's edge dipping into a bay
      under a lily pad, rings from the leaf at rest, a wake left behind on
      crossing, the leaf leaning into the direction it travels. Icons redrawn,
      money as a wallet.

## Next, in this order

- [ ] **Home.** The screen that does not exist yet: the pond scene across the
      top, the greeting, the month in one figure against income, today and
      tomorrow, and one large button to add an expense. Day and night.
- [ ] **Money.** The horizon treatment — the same sky and sun or moon, one
      wave, about 150px behind the header — with the figures on calm ground
      below it. Day and night.
- [ ] **Calendar.** Horizon, and the day panel rebuilt: it fits barely two
      entries today and needs a precise tap on a small arrow to open.
- [ ] **Lists.** Horizon, and the folder cards in the new system.
- [ ] **Day and night crossing.** The sun walks off one side as the moon rises
      on the other, sky and cards crossing with them, the glints changing
      colour and length: gold and long by day, silver and short by night.
      Automatic by the real sunrise and sunset, with Light / Dark / Automatic
      in settings, because automation that cannot be switched off is
      imposition.
- [ ] **Analysis.** Opens with one plain sentence about the month, then the
      detail. This is the fix for the screen he called the worst: it was never
      badly drawn, it had no question to answer.

## After the screens

- [ ] **Statistics folds into Money** and stops being a tab.
- [ ] **Settings moves to a gear in the header**, freeing the fourth tab, so
      the bar becomes Home · Calendar · Money · Lists.
- [ ] **Onboarding**: empty states that teach, one guided first expense, at
      most three coachmarks on the screens they belong to.
- [ ] **The mascot.** Four poses, drawn by a tool or a person, dropped into
      the slots already specified in `design/MASCOT.md`. The frog is yellow.
- [ ] **A name.** Pond is a working title he accepted quickly and wants to
      better. Nothing is published under it and nothing depends on it.

## Open questions

- Whether the leaf or the bloom marks the active tab was settled as the leaf,
  in both themes.
- How much of the pond belongs on screens that carry figures — settled as the
  horizon, but it has only been seen on Money so far.

## Rules this redesign is held to

- Character everywhere there are no numbers; where an amount is on screen, it
  is calm and precise. The mascot may cover a figure in privacy mode; it never
  stands beside one.
- Nothing new is drawn on a screen before the colour, spacing and type come
  from the tokens.
- Movement is slow, small, and out of step with itself. Anything that repeats
  on a shared beat gets noticed, and noticed movement above figures competes
  with them.
- Every tappable thing is at least 48dp, and colour never carries a meaning on
  its own.
