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
