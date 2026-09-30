# Roadmap

The living plan. Updated as work lands, not written once and left to rot — if
this file disagrees with the code, the file is wrong and gets fixed.

Status: `[ ]` not started, `[~]` in progress, `[x]` done, `[-]` dropped with
the reason kept.

Last updated: 30 September 2026

**Deploying phase 1:** run the migration BEFORE the new backend goes out.
`cd backend && npm run migrate:memberships -- --prod`, from a machine with the
production URI. The old code ignores the collection entirely, so there is no
window where anything is broken; deploying first would leave members lists
empty until it ran.

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
- [ ] **Open the Google Play developer account.** 25 USD once. Does not depend
      on the name or the code, and identity verification can take days, so it
      is the one thing worth starting before it is needed.
- [ ] **Start a list of twelve testers.** See the release plan below: they are
      the part that cannot be hurried later.

## Phase 1 — One person, many households

The largest change in the plan, and it comes first because the new interface
has to be drawn on top of it. Doing the interface first means drawing every
screen twice.

- [x] **Many households per user.** Smaller than it looks: `req.householdId`
      is assigned in exactly one place, `backend/src/middleware/auth.js`, and
      the 88 uses across 11 routes only read it. Change how that one value is
      resolved and no route changes at all.
      - **Membership lives in its own collection**, not an array on the user.
        A record per person per household, with `joinedAt` and `leftAt`. The
        array cannot say when someone joined *this* household, which is what
        decides their colour, and it cannot remember a former member, which is
        what the leaving rule needs.
      - **The request carries the household** in an `X-Household-Id` header,
        checked against membership on the server. Not a server-side "active
        household", because of the offline queue: a write made in one household
        and sent days later must land where it was written, not wherever the
        user happens to be standing when it finally goes out. It also lets two
        phones look at two different households, and leaves the token alone.
      - **`cachedGet` keys must include the household.** They do not today, so
        switching would show the other household's figures out of the cache
        until the network answered. Same change, plus clearing on switch.

      Done on the server: a `Membership` collection, an idempotent migration,
      the header resolved and checked in `auth.js`, `GET /api/households` and
      `POST /api/households`, joining that adds instead of moves, leaving that
      marks rather than deletes, and members listed in join order. No route was
      touched, as expected. 15 new tests, 67 in total.

      Done in the app: `HouseholdContext` holding the list and the active one,
      remembered per account; the header added in the axios request
      interceptor, so a queued write keeps the household it was written in;
      the household in the cache key, with a test for the leak that would
      otherwise have shown one household's figures in another; and colours
      refetched on switch, since a person can be first in one household and
      third in another.
- [x] **Switching households in the app.** Chips on the household screen, one
      per household with its member count, and a form to start another. Joining
      by code is no longer hidden once a household is full: joining now adds a
      household rather than moving between them, so it has to be reachable
      from anywhere. Good enough to use, and deliberately plain — phase 2
      decides where a switcher really belongs.
- [x] **Solo is the default.** A household of one no longer shows the
      machinery of sharing: no personal-versus-shared choice when adding an
      expense or a saving, no mine/theirs/both tabs on finances, no split under
      a day's total, no person filters. `isSolo` comes from the active
      household's member count, and an unknown count counts as not solo —
      hiding a feature from a couple who use it is the worse mistake.
- [x] **What personal-versus-together means alone.** It disappears from the
      interface and stays in the data, so nothing needs migrating if somebody
      joins later. Every expense a solo household records is personal.

      Two filters were also wrong for couples, not only for people alone: the
      person chips appeared whenever there was at least one person in the
      data, so a filter offering "everyone" and a single name was three taps
      that changed nothing. They now need more than one.
- [x] **Raise `MAX_MEMBERS`.** Now 6. The test that checked a full household
      refuses invites reads the limit from the code rather than assuming two,
      so it will not need editing again.
- [x] **Decide what happens to a leaving member's records.** They stay with
      the household. Leaving now marks the membership rather than deleting it,
      so a shared cost keeps its author and the months it belongs to keep their
      totals. A test asserts exactly that.

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

## Releasing

Publishing is not a button pressed when the work feels done. A personal Google
Play account has to run a **closed test with at least twelve testers, enrolled
continuously for fourteen days**, before it may even apply for production
access. Verify it in the Play Console, but plan as though it holds.

The package name — `com.something.name` — is chosen when the app is first
created in the Play Console and **can never be changed afterwards**. The store
listing name can change freely; the package name is permanent. That is why
nothing is published until the name is settled.

| When | What |
|---|---|
| During phase 1 | Settle the name. It needs no code and blocks everything else. |
| Now | Open the developer account, and start collecting the twelve testers. |
| End of phase 2 | Create the app with its final package name, begin closed testing. |
| During phase 3 | The fourteen days run while onboarding is being built. |
| After phase 3 | Production. |

### What is left

Prepared already, in `PLAY_STORE.md`: the data safety answers derived from the
code, the four permissions with the rest blocked, the Serbian store
description, the category and age guidance, and the build and submit commands.

Outstanding, and all of it on Vladimir except where noted:

- [ ] **Developer account**, 25 USD once. Identity verification takes days.
- [ ] **Twelve testers**, named and willing to keep the app installed for the
      fourteen days. The only item that cannot be compressed later.
- [ ] **The name**, and with it the permanent package name.
- [ ] **Public privacy policy URL.** The page is generated from `PRIVACY.md`
      into `docs/public/`; GitHub Pages needs enabling and the URL writing into
      `app.json` under `extra.privacyPolicyUrl`.
- [ ] **Screenshots**, at least two and better four to eight, at phone
      resolution. Wait for the new interface — screenshots of the current one
      would be replaced within weeks.
- [ ] **Feature graphic**, 1024x500.
- [ ] **Store icon**, 512x512 PNG.
- [ ] **A production build** — an AAB rather than an APK:
      `npx eas-cli build --platform android --profile production`. The profile
      already auto-increments `versionCode`, which Play requires to differ on
      every upload.
- [ ] **Signing** is handled by EAS; Play takes the key on first upload.
- [ ] **Verify the twelve-tester rule still holds** in the Play Console, and
      that Serbia is a supported merchant country — the second one decides
      whether subscriptions are possible at all.

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
- Membership is its own collection, with `joinedAt` and `leftAt`
- The active household travels in a request header, never as server-side state
- Nothing is published until the name is settled, because the package name
  that comes with it is permanent

## Open questions

- **A new name.** **Pond** is a candidate, not a decision — deliberately not
  settling on the first idea. Whatever it becomes has to be free in the Play
  Store with a domain available, and it has to be decided before the app is
  created there, because the package name that comes with it is permanent.
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
