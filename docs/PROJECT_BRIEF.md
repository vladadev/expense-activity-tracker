# Duo Tracker — project brief

A single page of context for an assistant (or a new person) that has the code
but not the history. The code says what the app does; this says why it is the
way it is, which is the part that cannot be read out of the files.

## What it is

A household finance and activity tracker for exactly two people — Vladimir and
his girlfriend Tijana. Shared and personal expenses, income, savings, a
calendar of activities, a wish list and a to-do list. In daily real use by both
of them, which is why a bug is not theoretical: it breaks something someone
needs that evening.

Written in Serbian and English. Serbian is the primary language and the one
both users read.

The intent is to publish it on Google Play. It is not a toy project, and it is
not a product with customers either — it sits in between, and decisions should
respect both: real reliability, no enterprise ceremony.

## Stack

**Mobile** — Expo SDK 54, React Native 0.81.5, New Architecture (Fabric),
JavaScript (no TypeScript). React Navigation (bottom tabs + stacks). State in
React contexts, no Redux. Distributed with EAS Build (APK for the two phones,
AAB for the store) and EAS Update for over-the-air JavaScript updates on the
`preview` channel.

**Backend** — Node + Express 4, Mongoose, MongoDB Atlas. JWT auth, helmet,
rate limiting, compression, `express-async-errors`. Tests with `node:test` and
supertest against a dev database.

**Monitoring** — Sentry on both sides, with source maps uploaded so stack
traces name real files.

## Architecture in one paragraph

The phone talks to one Express API over HTTP; the API owns MongoDB. There is
no server-side rendering, no queue, no cache layer, no microservices. Every
record belongs to a **household**, and household isolation is the security
boundary that matters most: one household must never read or write another's
data. The app keeps its own optimistic copy of what it writes and an offline
queue for writes that could not be sent, so the interface never waits for the
network.

## The decisions worth knowing

**Optimistic writes with a guarded revert.** A write updates the screen first,
then calls the API, then reverts on failure — except when the failure was "no
connection", in which case the write is in the offline queue and reverting it
would be a lie. The `err.queued` flag on the axios error carries that.

**Offline reading through `cachedGet`.** Every screen read is cached. When a
request gets no response, the last good copy is served and labelled stale. A
401 or a 404 is the server answering, and is never masked with old data.

**Temporary ids must not reach the server.** An optimistic create invents a
`temp-…` id. Mongo cannot cast it, and a queued request carrying one fails
forever. They are filtered out before sending, and the server validates ids and
answers 400 rather than throwing.

**A failed read is never shown as an empty state.** "No expenses yet" and "I
could not read your expenses" look identical to a user and mean opposite
things. Screens track `loaded` and `loadFailed` separately.

**Feedback is a toast, not a modal.** Modals were removed everywhere except
genuine confirmations that cannot be undone. Deletes offer undo instead of
asking first.

**No TypeScript, on purpose.** The project is one developer learning as he
goes; the guard against the errors TS would catch is ESLint plus tests.

## Traps this project has already hit

- `useNativeDriver: true` on anything that also reorders data tears the frame —
  drag and drop is JS-driven everywhere, deliberately
- SVG gradient ids are global on Android in `react-native-svg`; duplicates
  collide silently
- `filter: blur()` needs Android 12+ **and** Fabric; detected at runtime, with
  character masking as the fallback
- Hermes has no full ICU, so `Intl` silently falls back to English on device —
  all date formatting is hand-rolled and tested
- Express 4 does not catch a rejected async handler; without
  `express-async-errors` the request hangs with no response, which the app
  reads as "offline" and queues forever
- a name used without being imported is invisible to Metro, the build and the
  tests — it crashed a screen twice before ESLint was added
- bumping `version` in `app.json` cuts OTA updates to older installs, because
  `runtimeVersion` follows `appVersion`

## Questions already answered

Written as questions on purpose. A retrieval search matches a question to a
question far better than to a bullet point, and every one of these has been
answered wrongly at least once by a tool reasoning from general React Native
advice instead of reading this project.

**Why does drag and drop use `useNativeDriver: false`?**
Because the drag also reorders the list. A native-driven value is applied on
the native module's own schedule, which does not line up with the React render
that commits the new order; the mismatch shows as rows overlapping and their
text smearing for one frame at the swap. It is not that the native driver
cannot animate `translateY` — it can, and normally should. It is that it
cannot be kept in step with a data reorder.

**Does `cachedGet` serve the cache first and refresh behind it?**
No. That is stale-while-revalidate, and this is not that. It calls the network
first. On success it stores the response and returns it fresh. Only when the
request gets **no response at all** does it return the last stored copy, marked
stale so the screen can say how old it is.

**When must a cached read never be served?**
Whenever the server answered. A 401, a 404, a 500 — all of them are answers,
and replying to an answer with old data is a lie. The fallback exists for
silence, not for errors.

**Why is a failed write sometimes not rolled back?**
Because it is not lost, it is queued. A write that got no response is accepted
into the offline queue and will be retried, so reverting the screen would show
the user the old value and then flip it back minutes later. The `err.queued`
flag on the error says which case this is.

**Why is there no TypeScript?**
One developer, learning as he goes, on an app with two users. The guard against
the class of error TypeScript would catch is ESLint plus the test suites — and
ESLint earns its place: it found two crashing screens the day it was added.

**Why are there no modals for confirmation?**
They were removed. A modal stops the person to ask about something the app
could simply do and offer to undo. The 24 that existed are down to the few that
guard something genuinely irreversible; deletes offer undo instead of asking.

**Why is date formatting hand-written instead of using `Intl`?**
Hermes ships without full ICU data. `Intl` and `toLocaleDateString` look
correct in a browser and in jest, then silently fall back to English on the
phone. The formatting in `src/i18n/dateFormat.js` is manual and covered by
tests for exactly that reason.

**Why does bumping the version number matter so much?**
`runtimeVersion` follows `appVersion`, so raising `version` in `app.json` stops
over-the-air updates from reaching every install still on the old number. It is
raised when an APK is actually being shipped, not as housekeeping.

## Conventions

- comments explain **why**, not what; a comment that restates the code is noise
- commit messages are sentence-style and explain the reasoning, not the diff
- the user runs his own git commands unless he says otherwise
- UI strings always go through `t('…')` in both languages, never hardcoded
- `NODE_USE_SYSTEM_CA=0` prefixes npm/node commands on the dev machine, and
  `eas` is always invoked as `npx eas-cli`

## State as of September 2026

Version 1.2.0 installed on both phones. Backend has 18 tests, the app has 52
across six suites plus ESLint in CI. Error boundaries wrap each tab. Offline
reading and writing both work. Sentry receives readable stack traces.

Remaining: the Play Store submission itself, a fresh production build, the
splash tagline copy, and the privacy policy's public URL.
