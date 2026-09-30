# Roadmap

The living plan. Updated as work lands, not written once and left to rot — if
this file disagrees with the code, the file is wrong and gets fixed.

Status: `[ ]` not started, `[~]` in progress, `[x]` done, `[-]` dropped with
the reason kept.

Last updated: 30 September 2026

---

## Where the project stands

Version 1.2.0 on two phones, in daily use by two people. Backend on Render,
MongoDB Atlas M0. 51 backend tests, 52 mobile tests, ESLint in CI, Sentry with
readable stack traces on both sides. Offline reading and writing work. Not yet
on Google Play.

The goal has changed: what was built for two people is becoming a product for
strangers. Everything below follows from that one change.

---

## Phase 0 — Before anyone else sees it

Small, and none of it optional.

- [x] **Take the two names out of the code.** Done. Colour now comes from a
      member's position in their household rather than from their name, so two
      people in one household can never share one — a hash cannot promise that.
      `usePersonColor()` replaced the old plain function across 14 files, the
      member list is sorted by id on the server so the order cannot drift, and
      9 tests cover it. Vladimir and Tijana keep the exact colours they had,
      being first and second in their household.
- [x] **Decide the Render plan.** Already on the paid plan at 7 USD a month,
      and has been from the start, so the service does not sleep. Nothing to
      do; noted here because a sleeping free tier would have looked like a
      broken app to a first-time user.
- [ ] **Play Store submission.** Everything is prepared in `PLAY_STORE.md`
      except the public privacy policy URL and a production build. This was
      planned for 10 September and has not happened yet.

## Phase 1 — One person, many households

The largest change in the plan, and it comes first because the new interface
has to be drawn on top of it. Doing the interface first means drawing every
screen twice.

- [ ] **Many households per user.** `User.household` is a single `ObjectId`
      today, read once in `backend/src/middleware/auth.js` and used by all 12
      routes as the security boundary. It becomes a list, and each request has
      to say which household it is acting in. Discord's model: you are in
      several, you look at one at a time, you switch.
- [ ] **Switching households in the app.** One active household at a time, a
      visible switcher, every screen following it.
- [ ] **Solo is the default.** A new account is already a household of one,
      `createHouseholdFor` runs on signup. What is missing is the app saying
      so, and hiding what makes no sense alone.
- [ ] **What personal-versus-together means alone.** `stats.js` splits every
      total into `personalTotal` and `togetherTotal`. For one person that
      split is empty ceremony and has to go somewhere else or disappear.
- [ ] **Raise `MAX_MEMBERS`.** Currently 2, in `backend/src/utils/household.js`.
      The backend change is one constant; the interface is the real work.
- [ ] **Decide what happens to a leaving member's records.** Open question
      below, not settled.

## Phase 2 — The interface

Not a redraw of the old screens. A design system first, then screens built
from it.

**The rule, decided:** character lives everywhere there are no numbers —
onboarding, empty states, the household screen, celebrations, errors. Where an
amount is on screen, it is calm and sharp, the way Revolut and Wise are.
Duolingo and Monobank both work exactly this way.

- [ ] **Design system.** Colour tokens, typography, spacing, iconography,
      motion, light and dark. See `design/BRIEF.md`.
- [ ] **One screen as proof** the system holds together before the rest follow.
- [ ] **Statistics.** Named as the worst screen: too much at once, circles and
      charts stacked with no hierarchy.
- [ ] **Calendar.** The panel under the month fits barely two entries and needs
      a precise tap on a small arrow to open.
- [ ] **The remaining screens**, one at a time, each shipped over the air.

## Phase 3 — Joining without being told how

- [ ] **Empty states that teach.** Not "no expenses yet" but one large button
      and a sentence. Cheapest of the three and the most effective.
- [ ] **A guided first entry.** One thing only: add your first expense.
- [ ] **At most three coachmarks**, each on the screen it belongs to and the
      first time only. Not a tour at launch.
- [ ] **Shorten the existing intro slider** to three screens, ending in that
      first expense.

## Phase 4 — Money

Deliberately last. The app stays free until it is finished; a paywall follows
only if there is demand to convert.

- [ ] **RevenueCat**, not direct Play Billing (too much upkeep for one
      developer) and not Stripe (forbidden for digital goods inside the app,
      grounds for suspension).
- [ ] **Subscription status belongs to the household**, not the user, since the
      people in one share the data. `requireAuth` selects only `name household`
      today and will need the status too.
- [ ] **The free line:** free is one household, up to two people, everything
      working. Paid is more households, more members, export, themes, extras.
- [ ] **Around 2.50 EUR a month or 20 EUR a year**, annual pushed hard. A
      lifetime purchase near 35 EUR early on is worth considering: someone who
      paid files bug reports.

---

## Decided, and not to be relitigated

- **RevenueCat** for subscriptions
- **Free while unfinished**, paywall later
- One active household at a time, switching between them
- Solo users are first class, not a degraded couple
- Character around the data, calm at the numbers
- **No bank connection.** Serbia sits outside PSD2 and its banks have no public
  open-banking APIs; the EU route through an aggregator carries real regulatory
  and security weight for a side project. Revisit only with EU users and a
  reason.
- **Scope:** money already spent or received, and the arrangements between
  people who live together. Not bank links, not financial advice, not bill
  splitting between friends, not investments or crypto.
- English and Serbian only. More languages when users ask for them.
- Money and plans are equal halves of the product, not one with an extra
- A member who leaves keeps their history with the household; they lose
  access, the household does not lose its past

## Open questions

- **A new name.** Working name **Pond** — one word, carries the mascot without
  naming it, and says nothing about two people. Not final; other options are
  still being considered. Before it is committed to: check it is free in the
  Play Store and that a domain exists.
- ~~What happens to a leaving member's records?~~ **Settled: they stay.**
  Deleting them would rewrite history — a shared expense from March would
  vanish from March and that month's total would change. The code already
  behaves this way: `POST /households/leave` moves the person into a fresh
  household of their own and touches no records. What is still missing is the
  interface saying so, marking them a former member rather than a member.
- ~~Are activities half the product or an extra?~~ **Settled: equal halves.**
  The app is for everything a household shares, money and plans alike. That is
  how it gets described in the store, and neither half may be designed as an
  afterthought of the other.
