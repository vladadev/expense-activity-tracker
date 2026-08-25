---
name: add-tests
description: Add or run tests for this project — jest for the mobile app, node:test against a dev database for the backend. Use when asked to test something, or after changing logic that has no coverage.
---

# Testing

## Running

```bash
cd mobile && npm test
```

```bash
cd backend && npm test
```

Both run in CI on every push (`.github/workflows/tests.yml`), as two separate
jobs. Prefix with `NODE_USE_SYSTEM_CA=0` on this machine.

## Mobile (jest + jest-expo)

Tests live in `mobile/__tests__/*.test.js`. `jest.setup.js` mocks AsyncStorage
(with the mock the library ships) and Sentry — both are native modules that
throw the moment they are imported, and nearly every context imports them.

What is worth testing here is **pure logic with a wrong answer**, not
rendering:

- `search.test.js` — diacritic folding (`ć`/`č`→`c`, `đ`/`dj`→`d`), amounts
  with thousands separators, multi-term narrowing
- `dateFormat.test.js` — the hand-rolled formatting Hermes forces on us
- `translations.test.js` — key parity between languages, every `t('…')` call
  site resolves, no blanks, matching `{placeholders}`
- `privacyMask.test.js` — the mask leaves no digit anywhere
- `cachedGet.test.js` — falls back only when there is **no** response
- `dataEvents.test.js` — the optimistic merge does not duplicate or misplace

Two things that bite when writing these:

- `expect(value, message)` — jest takes **one** argument. Put the context into
  the asserted value instead: `expect({ missing }).toEqual({ missing: [] })`
  gives a readable diff.
- a static scan for `t('…')` call sites will match keys mentioned in
  **comments**. Strip comment lines first, or you get false positives.
- mock the API client, never the network: `jest.mock('../src/api/client')`.

## Backend (node:test + supertest)

`backend/tests/*.test.js`. The suite refuses to run unless `MONGODB_URI`
resolves to a `-dev` or `-test` database, so it cannot be pointed at production
by accident.

What matters most here is what the app cannot protect: **household isolation**
(one household must never read or write another's records), auth, and the
guards that keep bad data out — cycle and depth checks on folder moves,
`ObjectId.isValid` on every id, and a 400 rather than a hang for garbage input.

## Writing a test that is worth keeping

Test the behaviour that was actually wrong, and say so in a comment. Every
test in `mobile/__tests__` names the defect it prevents — the empty state that
was really a read failure, the mask that left a digit, the merge that showed a
duplicate. A test without that context gets deleted by the next person who
sees it fail.
