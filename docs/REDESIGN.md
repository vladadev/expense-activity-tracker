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

- [x] **The pond scene** as a component, so every screen that wants it gets the
      same water: `PondScene`, with its gradient ids made unique per instance
      because they are global in react-native-svg on Android and two scenes on
      screen at once would steal each other's fills.
- [x] **Palette and scales.** Pond in light and night beside the old themes,
      spacing on a grid of four, radii, type scale, motion durations. Outfit
      for what is noticed, IBM Plex Sans for what is read, both loaded.
- [x] **The tab bar.** Water across the full width fading up into the screen,
      two wave layers at different speeds, the bar's edge dipping into a bay
      under a lily pad, rings from the leaf at rest, a wake left behind on
      crossing, the leaf leaning into the direction it travels. Icons redrawn,
      money as a wallet.
- [x] **Four tabs: Home · Calendar · Money · Lists.** Reached without deleting
      anything — see below for what moved where.
- [x] **The horizon.** `PondHorizon`: the strip of pond that fits behind the
      header of a screen that carries figures. Sky, the sun or the moon low
      over the water, one wave, then the blend into the page. One wave and not
      three because movement that is noticed competes with the amounts under
      it. Its four numbers live in `geometry.js` with tests: a header sits
      across the top of the strip, the status bar inside it is 24 points on
      one phone and 48 on another, and the bell and the gear are at the right
      end — so the sun has about four points of room to spare, and nobody
      would ever find that by reading the file.
- [x] **Light ink on the water.** The pond is dark in both themes, so a title
      over it does not come from the palette: `ON_WATER` is one colour in both,
      and it is also the Pond background, so the title and the page under it
      are the same stuff. The status bar follows, tied to focus and restoring
      the theme's own style on the way out — which also fixed Home, where dark
      status icons had been sitting on the darkest thing in the app.

## The shape it ends in

**Four tabs: Home · Calendar · Money · Lists.** There were six, because Home
was added without anything being taken away. That was not only untidy: at 390
points across, six tabs leave 63 each, and a word like "Podešavanja" does not
fit in 63. Four leave 97.

Neither of the two that went was a deletion.

**Statistics is the Analysis face of Money.** It was never badly drawn — it
simply had no question of its own to answer, and the answer to "how has it
been" belongs beside "where do we stand". Two tabs apart meant one was opened
daily and the other almost never. Money now carries a *Sada / Analiza* switch
on the horizon, and each face is still a whole screen: both render `embedded`,
which means they draw their body and let the title, the eye and the gear
belong to Money.

**Settings is a gear in the header**, beside the bell, because it is opened
about once a month and was taking the same room as the tab opened every day.
The route moved to the outer stack, next to Notifications, so the gear reaches
it from inside any tab. Home got the bell and the gear too — it draws its own
header, since the greeting is its title, and without them the first tab in the
app would have been the only one with no way to reach either.

Doing this before the remaining screens was the point. Settings in the header
changes the shared header every screen uses, and folding Statistics in changes
what the Money screen *is* — drawing Money first and folding afterwards would
have meant drawing it twice.

## Next, in this order

- [~] **Home.** The pond across the top with sun or moon, three layers of
      water, floating pads and the light broken into glints; the greeting; the
      month in one figure against income with a bar and what is left; today's
      plans and a line for tomorrow; one button to add an expense.

      Its own header, because the greeting is the title and is too big to sit
      in a row of controls: which household you are in on the left, and on the
      right the sun or moon, the bell and the gear. The greeting goes under it.

      Still open on it: the scene does not yet know the hour of day on its own
      (it follows the theme).
- [~] **Money.** The horizon is on it, day and night, with the switch between
      its two faces sitting on the water. What is below the horizon is still
      the old screen: the cards, spacing and type on both faces are the ones
      from before the tokens existed. Next on it is the *Sada* face in the new
      system — the remaining figure, income, expenses and savings — and then
      the transactions list under it.
- [ ] **Calendar.** Horizon, and the day panel rebuilt: it fits barely two
      entries today and needs a precise tap on a small arrow to open.
- [ ] **Lists.** Horizon, and the folder cards in the new system.
- [~] **Day and night crossing.** The sun or moon in Home's header switches
      the two by hand, which is how both themes get judged while they are being
      drawn — and which stays afterwards as the way to overrule the automatic
      one for an evening. The two icons trade places rather than cut: one
      swings out as the other swings in, around the same centre.

      What is left is the crossing itself: the sun walking off one side as the
      moon rises on the other, sky and cards crossing with them, the glints
      changing colour and length — gold and long by day, silver and short by
      night. Automatic by the real sunrise and sunset, with Light / Dark /
      Automatic in settings, because automation that cannot be switched off is
      imposition.
- [ ] **Analysis.** Opens with one plain sentence about the month, then the
      detail. Its own screen is now in the right place; what it still lacks is
      the sentence. This is the fix for the screen he called the worst: it was
      never badly drawn, it had no question to answer.
- [ ] **Settings itself.** Now that it is a pushed screen rather than a tab, it
      is the one place in the design build still wearing the old look
      end to end. It is also the least seen, so it waits.

## After the screens

- [ ] **Onboarding**: empty states that teach, one guided first expense, at
      most three coachmarks on the screens they belong to.
- [~] **The mascot.** The brief is finished — four poses, their sizes, the
      colours and the prompts are all in `design/MASCOT.md` — and the slots are
      now reserved in code as well as on the canvas: `MascotSlot` draws the
      hole at the real size, in the design build only, so it can be judged on
      the real screen in both themes before anything is drawn. The first one is
      on Home.

      **The character is being settled now, the poses later.** He asked for the
      base frog early so the look is agreed before anything depends on it;
      round one is four candidates on the canvas board "Maskota — kandidati",
      each shown large and again at 96 and 48 over the water, because that is
      the size the choice actually has to survive. Once one is chosen it goes
      into Home's slot.

      The four poses wait for onboarding. Three of them do a job on screens
      that do not exist yet — onboarding, empty states, a moment worth marking
      — so drawing them now means drawing against guesses. It is also the one
      piece that is art rather than code, so it never sits on the critical
      path: it can be drawn while the screens are finished.
- [ ] **A name.** Pond is a working title he accepted quickly and wants to
      better. Nothing is published under it and nothing depends on it.

## Open questions

- Whether the leaf or the bloom marks the active tab was settled as the leaf,
  in both themes.
- How much of the pond belongs on screens that carry figures — settled as the
  horizon, and now seen on Money. Calendar and Lists get the same treatment,
  which is the next chance for it to be wrong.

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
