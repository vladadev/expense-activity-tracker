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

- [~] **Home.** The pond across the top with sun or moon, two overlapping
      ranges behind a far bank, reeds leaning on the wind in the shallows at
      either edge, three layers of water, three different lily pads each
      sending out rings, and the light broken into glints; the
      month in one figure against income with a bar and what is left; today's
      plans and a line for tomorrow; one button to add an expense.

      Its own header, because the greeting is the title and is too big to sit
      in a row of controls: which household you are in on the left, and on the
      right the bell and your own face. The greeting goes under it.

      Still open on it: the scene does not yet know the hour of day on its own
      (it follows the theme).
- [~] **Money.** The horizon is on it, day and night, with the switch between
      its two faces sitting on the water. The **Sada** face is now drawn in the
      new system: one figure — what is left this month — with a bar under it
      showing how much of what came in has gone out, and the working below that
      in quiet metrics. It is deliberately the same shape as Home, because the
      two screens answer halves of one question and ought to look like they
      know that.

      The transactions list under it is done too: one card per day rather than
      a column of separately floating rows, because a column of slabs reads as
      a list of unrelated things while a day is one thing with entries in it.
      Search, the kind filter and the category chips all sit on the tokens now
      and every one of them clears 48 points.

      Still open on it: the **Analiza** face.
- [~] **Calendar.** The day panel is rebuilt. Three decisions, all his, taken
      on 4 October 2026 and all for the stranger on the Play Store rather than
      for the two people using it now:

      **The month folds to a week.** The grid took half the screen whether you
      were reading the month or reading one day, and it is one day almost every
      time. Choosing a day folds it to that day's week; a handle under it opens
      the month again.

      **The day shows three entries and says how many more.** It used to hold a
      scrolling box, which showed two of six — and a box that scrolls inside a
      screen that scrolls is a fight between two gestures the finger cannot
      see.

      **The date row looks like a button**, which it already was. That was the
      real fault behind "it needs a precise tap on a small arrow": the whole row
      opened the day and always had, but nothing said so, so nobody pressed it
      except on the arrow. A control that works and does not look like one is a
      control nobody uses — which is also why the fold is a handle you can see
      and not a swipe you have to guess at.

      Fixed on the way past: the grid started the week on Sunday, which is
      wrong for both languages the app speaks and would have left the week row
      disagreeing with the month above it.

      The horizon is on it now, and the whole screen is on the tokens — the
      grid's own type included, because the library draws that grid and will
      use the system font unless it is handed ours. The one screen made of
      numbers was the last place that could afford to be in a different face.

      The view switch is the same control Money wears: same place, same veil,
      same two halves. Its icons went. Two switches one tab apart, one with
      icons and one without, read as two controls rather than one idea, and
      Kalendar and Lista are two short words that carry it alone.

      **Found while drawing it on the canvas:** with the month open and a day
      chosen — which is the state you land on — the grid, the handle, the
      legend and the day below them come to more than an 844pt phone has, and
      the bottom of the day was simply being cut off. The screen has one scroll
      now. That is not the nested scroll taken out of the day panel: that was a
      box scrolling inside a screen that scrolled, two gestures in one place
      and no way for the finger to tell which it had hold of. This is the
      screen scrolling, and nothing scrolls inside it.

      **The chosen day was a square**, which he caught. It is drawn twice —
      by the library when the month is open, by WeekRow when it is folded —
      and the two did not agree: the grid uses 32 across with a radius of 16,
      the week row used 34 with a radius of 999. Every other round thing in
      this app is drawn at exactly half its own width, and an oversized radius
      is not reliably clamped on Android under Fabric, so the single outlier
      was the single marker that came out square. Both now take their size and
      radius from the same pair of numbers, and a test reads the library's own
      stylesheet so a version bump that moves them fails rather than drifts.
- [x] **Lists.** The horizon is on it and the whole screen is on the tokens.

      It is the third screen to wear the switch, in the same place, on the
      same water, and its icons went for the reason the calendar's went: a
      control that differs from tab to tab reads as a different control
      rather than the same one again.

      The folder card keeps its height. Everything else moved onto the scale,
      but 84 and the 10 under it stay plain numbers, because the drag
      hit-test measures against the two of them added together and a card
      whose height the arithmetic does not know about drops into the wrong
      slot. They are changed together or not at all, and the code says so.

      The three dots were a 19pt glyph with twelve points of padding around
      it. They are the discoverable way into a folder's actions — the long
      press does the same thing and nobody finds it — so they carry a 48
      target now, as do the drag handle, the folder-name field and the two
      filter chips.
- [~] **Day and night crossing.** Built, in both directions and over 1.4
      seconds. The sun leaves on one side while the moon rises on the other
      into the place it left; the reflection dims while nothing is above it;
      and **every colour in the app travels with them**, because the palette is
      blended rather than swapped — see `theme/mix.js`, which is where the
      arithmetic lives and is tested. The sun and moon in the header are not an
      imitation of it: they read the same value the sky does, so the two cannot
      drift apart.

      Position is animated natively and colour is stepped 24 times across the
      crossing, which is the one number worth knowing here: every screen's
      StyleSheet is rebuilt from the palette, and rebuilding it once a frame is
      work nobody sees and everybody feels.

      The canvas board **"Prelaz dan u noć"** holds it as four moments, since a
      board cannot hold the movement itself.

      What is left: making it automatic by the real sunrise and sunset, with
      Light / Dark / Automatic in settings, because automation that cannot be
      switched off is imposition. Also still to do — the glints should change
      length as well as colour: gold and long by day, silver and short by
      night.
- [x] **The profile, and where the controls live.** Taken on 4 October 2026,
      and his decision both times. The problem he put his finger on: the theme
      switch was only on Home, the privacy eye was only on every screen except
      Home, and the header was collecting one more button per screen with no
      rule saying which.

      **The gear became you.** Same corner, same one tap, same destination —
      what changed is what it says. A gear says "options"; a face says "you",
      and the screen behind it now opens with your name, your email and your
      household before it gets to any switch. It is deliberately **not** a
      drawer: a panel behind an icon is a layer of navigation nothing on the
      screen admits to, and this app has already been caught twice shipping
      controls that worked and did not look like it.

      **The theme moved into settings, and the control is a piece of pond.**
      His worry was right — the crossing took a long time to build, and behind
      a dry screen nobody would ever see it play. So the theme row *is* 104
      points of horizon: same sky, same sun, one wave, with Dan and Noć
      standing on the water. This is the one pushed screen with water on it,
      and the exception does not break the rule that pushed screens stay dry,
      because the water here is not wallpaper — it is a preview of the thing
      being chosen.

      **On a tab root the household takes the title's place.** The tab bar
      already says which screen you are on, in colour, at the bottom of it;
      nothing else said whose figures these were. On a pushed screen the title
      comes back, because there the tab bar has stopped answering. That also
      settled the crowding: chip, title, eye, bell and face in one 390pt row
      was one thing too many.

      Gone with it: `SettingsGear.js` and `pond/DayNightToggle.js`.

      Still open: Automatski, which needs the real sunrise and sunset, and the
      privacy eye — it is still absent from Home, which is the last header
      inconsistency left.
- [x] **Analysis.** It opens with the answer now. One figure for the period
      and one plain sentence — "12% less than last month" — which is the
      comparison every chart on it was being read for and the only one it
      never made. It costs one extra request for the period before this one,
      in a try of its own, because a headline without the comparison is still
      a headline and failing to reach last month must not blank out this one.

      **Three rings went.** `DonutChart` drew a 150pt ring and then printed a
      full legend under it with every name and every amount — the legend was
      already doing the work, and past about six categories the slices were
      too thin to read anyway, so the eye went to the legend regardless. A
      ranked list with the share drawn behind each row says the same thing in
      less space, reads top to bottom in the order that matters, and works
      with three categories or fifteen. Personal against together is two
      numbers, so it is one divided bar rather than a second ring. The file is
      deleted; the day-detail screen uses the same list.

      **The day chart was lying by omission.** `.slice(-10)` on the days that
      HAD an entry: the heading said September while the chart showed a tenth
      of it, and because it was keyed on days with entries rather than days,
      two neighbouring bars could be one day apart or nine — an axis that
      looked like time without being it. It plots every day of the period now,
      the empty ones included, stacked by who spent it, sorted by name so the
      colours stay in the same order and the eye can follow one band across
      the month. Tapping a day still opens the day, which already answers what
      it went on.

      It grows out of the baseline under one clip rectangle rather than each
      bar animating its own height: a month of stacked bars is sixty-odd
      rects, and sixty JS-driven interpolations a frame is the kind of work
      nobody sees and everybody feels.

      **And it no longer repeats itself once per currency**, which was what
      made it three screens long instead of one. The currency this household
      spends in leads; the rest wait behind a pill in the row that already
      says how wide you are looking. Period length and currency share that
      row, because both are "how wide am I looking" and each was taking one
      of its own.

      **Three things he found after the first version shipped**, all mine:

      The chart drew nothing at all. The bars were wrapped in a clip rectangle
      that was meant to wipe upward, and an Animated value inside a `<ClipPath>`
      is resolved once and never updated — so the clip stayed at the zero
      height it started at and took every bar with it. Nothing animates now. A
      chart that appears is worth more than a chart that grows, and this is the
      second time an SVG attribute has quietly refused to animate in this
      project.

      The day numbers along the bottom were being laid out as views, one per
      column, and a column is nine points wide across a month — so "11" wrapped
      onto two lines and came out as a 1 above a 1. They are drawn into the SVG
      now, which does not wrap, and the heading carries the month so the
      numbers read as days of it. The caption says they can be touched, and the
      whole plot is one target that snaps to the nearest column, because a nine
      point column is not something a thumb can hit.

      The "more detail" handle was reported as broken. Whether it failed or
      simply revealed its content below the fold does not much matter: those
      are the same thing to the person holding the phone. It is gone, and both
      breakdowns stand on their own.

## Getting the app onto the phone

- [x] **The app had no code for applying an update.** No check, no fetch, no
      reload — `updates` in app.json was a URL and nothing else. Expo's default
      is then to launch the bundle it already has and download the new one
      behind it, applied on the NEXT cold start. So every session ran one
      publish behind, and a phone that was backgrounded rather than closed
      could sit several behind indefinitely.

      This is worse than an ordinary bug, because it hides every other one:
      days of "I see no improvement" were spent on changes that were never
      being run, and nothing shipped could be judged. It should have been the
      first thing checked the first time he said a fix had not landed.

      `useAppUpdates` now checks on launch and on return to the foreground.
      The design build applies it at once — being the newest thing is the only
      reason that build exists. The real app fetches and lets the next launch
      apply it, because reloading under somebody halfway through typing an
      expense is not a kindness. Settings has a button that forces the check
      and says which of the three answers it got, beside the bundle id that
      was already there.

## Speed

- [x] **Analysis showed one question's figures under another's heading.** His
      report: switching between Troškovi, Prihodi and Štednja sometimes said
      there was nothing this month, sometimes showed the wrong numbers, and
      put itself right several seconds later.

      The screen draws four things at once — a headline, a breakdown, a chart
      and a comparison — and all four belong to one question: which data type,
      over which period, how far back. That question was being asked by four
      controls and answered into four loose pieces of state with nothing tying
      them to it, so switching left the previous answer standing until the new
      request came back, and the screen cheerfully built its sections out of
      it. Data that cannot say which question it answers will eventually be
      shown under the wrong one.

      **It was not fixed by that alone, and the rest is worth writing down.**
      Keying the data stopped the wrong figures appearing, but three more
      faults were doing the rest of the damage:

      The screen was not considered loaded until **both** requests had landed
      — the period's figures and the previous period's one number for the
      comparison — and they ran one after the other. The chart and the empty
      message waited on a request neither of them uses, which on a slow
      connection is two round trips of staring at nothing. They go out
      together now and nothing waits on the comparison, which is seeded from
      the cache besides, so it stops arriving a beat late and reading as the
      figure correcting itself.

      The empty message said **"no expenses logged yet this month"** whichever
      of the three cards you were on, and said "this month" while you were
      looking at a year. Three messages now, none of them naming a period it
      cannot see.

      And the day chart **silently dropped every day with a negative total** —
      it took a maximum with a floor of zero and skipped the rest. Expenses
      are never negative so it looked right for a year; savings has
      withdrawals, so a month where more came out than went in drew an empty
      chart with the days money left simply missing. Zero has its own line
      now, bars go both ways from it, and a day where one person paid in while
      the other took out shows both. `chartScale.js` holds the arithmetic and
      has the test; verified by putting the old floor back and watching it
      fail.

      Everything carries the query key, the screen draws nothing it cannot
      attribute, and a response that comes back for a question nobody is
      asking any more is dropped — which also fixes the quieter half of it:
      three taps start three requests and they can return in any order, so
      without that the slowest one won. The person filter resets with the data
      type too; a name that appears in the expenses may have no savings at
      all, and carrying it across reads as an empty month rather than as a
      filter still being on.

It was not one screen. Every read in the app went to the network first, and the
disk cache underneath was only ever reached for when a request failed — it was
an offline fallback wearing the word cache. So walking from Money to Analysis
and back paid a full round trip each way, with a skeleton over it, for figures
that had not changed in ten seconds. Nineteen files read through that one
function, which is also why the fix is in that one function.

- [x] **An answer the app already has is not worth asking for.** `memoryCache`
      holds the last answer for forty-five seconds and `cachedGet` hands it
      straight back — no request, no skeleton, no wait. Anything that writes
      drops the whole cache rather than working out which entries it touched,
      because that bookkeeping is what goes wrong six months later; it costs
      one round trip on the next screen and cannot be wrong. Signing out drops
      it first and outside the try, since leaving one account's figures in
      memory for the next person is the one outcome that must not be possible.
- [x] **The first frame starts from what is known.** Money renders one face at
      a time, so every switch between Sada and Analiza rebuilt Analysis from
      nothing. It seeds its state from the cache now, so the first render is
      already the answer and the refresh behind it is silent.
- [x] **The token stopped going to disk on every request.** Each call read it
      out of AsyncStorage first — a bridge round trip to SQLite, four times
      over for a screen making four calls, for a string that changes twice in
      the life of an install. It lives in memory and the sign-in path keeps it
      in step.
- [x] **The content fade went from 300ms to 150.** It is native-driven and
      cheap, but it was delaying the answer by a third of a second on every
      filter tap, and the complaint was that the app felt slow.

      Still open: the first visit to a screen in a session is still one round
      trip, because serving the disk copy first would mean showing figures that
      might be a day old without saying so. That wants stale-then-update, where
      the screen renders the old answer immediately and swaps when the new one
      lands — worth doing, and worth doing deliberately rather than as part of
      this.

## Then the screens behind the tabs

The redesign has reached the tab roots and almost nothing else. There are **24
screens**; two are drawn in the new system and the shared header touches the
rest without changing what is under it. Opening anything from a tab still steps
back a year.

They are grouped by the tab they hang off, because that is how they are
reached and how they should be judged — a day opened from the calendar has to
feel like the calendar, not like a different app.

- [~] **The forms, as ONE job.** The pattern is built and four screens wear
      it. What was wrong was never any one form — it was that each had been
      drawn on its own: a label at 14 here and 12 there, an error under the
      field on one screen and at the foot of another, and a save button that
      was the last item in the scroll, so a long form made you scroll past
      everything you had just filled in to reach it while a short one left it
      marooned in the middle of an empty screen.

      The vocabulary now lives in `components/form` and is decided once:

      - **`FormScreen`** — what scrolls scrolls, and the bar at the bottom
        does not. It carries both answers to the question the form asked:
        save, and the way out. Leaving used to be the back arrow, which is a
        navigation gesture, not an answer.
      - **`AmountField`** — the figure the screen exists for, at the size it
        deserves, with the currency beside it instead of in a row and a set of
        pills of its own. It was in the same 16pt box as the optional note.
      - **`ChipGroup`** for a list that grows, **`SegmentGroup`** for a set
        that does not, **`DateField`** for a row that opens the picker and
        looks like it opens something, **`TextField`** for everything else —
        and the eye for a password lives in it, so the screen that asks you to
        type one twice can finally show you what you typed.
      - **`Field`** underneath all of them: label, control, and the error
        under the field it belongs to. An error you have to scroll to find is
        an error you argue with.
      - **`useFormSubmit`** — saving, and its three endings. The middle one is
        the one that gets forgotten: a write that got no response is already
        in the offline queue and IS going to be sent, so reporting a failure
        would be a lie and sending the person back to a form they have already
        filled in would be worse.

      Wearing it: **an expense, an income entry, a savings entry, the plan, a
      list item, and changing your password.** Six screens, 1308 lines down to
      997, with the pattern itself in one place — which is the point, because
      the plan and a list item both needed a switch row and a reminder and
      both got them from the same two files.

      Still on their own: **a category, the household, and signing in and
      registering.** Those are a different shape — a list with a row for
      adding to it, rather than a screen you push into and fill — and they are
      worth drawing as that rather than forced into this one.

      Caught on the way past: `savings.direction` and the singular labels for
      the password eye existed in one language and not the other. The
      translations test already guarded that and said so — it checks that every
      key the app asks for is defined in **both** languages, with matching
      placeholders and no blanks.
- [ ] **From Calendar**: the day itself, the day's spending breakdown, and the
      agenda list.
- [ ] **From Money**: savings, and the transactions list that sits under the
      figures.
- [ ] **From Lists**: a folder and its items.
- [ ] **From the gear**: settings, the household, the activity log.
- [ ] **Reached from anywhere**: notifications.
- [ ] **Before the app**: the login screen, which is the first thing anyone
      ever sees and is currently the last thing on this list.

**Settled, 4 October 2026: no pond on these.** The horizon stays on the four
tab roots and nowhere else. A tab is a place you switch to, arrive at and look
around; a pushed screen is a place you go into to do one thing and leave. You
are on "add an expense" for eight seconds, and movement behind a field slows
the eye that is trying to read it — and the horizon costs 150 points of height,
which is exactly what a form with the keyboard up has none of.

They get a calm header in the Pond palette instead: same colours, same type, no
water. The pond is the place you come back to, not the wallpaper.

## The rest, which is not screens

- [ ] **Onboarding**: empty states that teach, one guided first expense, at
      most three coachmarks on the screens they belong to.
- [~] **The mascot.** The frog exists and is on Home, sitting on its pad. It
      is drawn in code rather than generated as a picture, because it has to
      move: it breathes, it blinks and its eyes drift, all three slow and on
      counts that do not meet. Both themes come from one source and it renders
      at any size. See `design/MASCOT.md`, which also records that the style
      moved from flat to softly shaded — the pond it sits in is made of
      gradients, and a hard flat frog in front of them is a sticker.

      Canvas board: **"Maskota — nacrtana"**, beside the generated candidates
      that settled the look.

      It shipped broken once, on 4 October 2026: a shape module was renamed and
      only one of the two files using it was updated, so the component imported
      names that no longer existed and the home screen crashed on open. There
      is a test for that now — `__tests__/imports.test.js` checks every named
      import in `src` against what its module actually exports, because ESLint
      here has no resolver and cannot see it.

      What is left: the three poses that do a job — waving for onboarding,
      sitting for empty states, holding a lily pad over the figures in privacy
      mode, arms up for a moment worth marking. They wait for the screens they
      belong to, which do not exist yet.

- [ ] **A name.** Pond is a working title he accepted quickly and wants to
      better. Nothing is published under it and nothing depends on it.

## Not design, and on him

- [ ] The Google Play developer account (25 USD, one off).
- [ ] A list of 12 testers — Play requires them before a closed test can open.
- [ ] GitHub Pages switched on, for the privacy policy URL Play asks for.

None of this blocks the redesign, and all of it blocks shipping.

## Open questions

- Whether the leaf or the bloom marks the active tab was settled as the leaf,
  in both themes.
- How much of the pond belongs on screens that carry figures — settled as the
  horizon, and now seen on Money. Calendar and Lists get the same treatment,
  which is the next chance for it to be wrong.
- Whether screens you push into get the pond too — settled as no. See "Then
  the screens behind the tabs".

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
