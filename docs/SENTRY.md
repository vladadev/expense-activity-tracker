# Sentry: readable stack traces

## What the problem is

The app that runs on the phone is not the code in this repository. Metro takes
every file under `mobile/src`, strips the comments, renames the variables to
single letters and glues everything into one big `index.android.bundle`. That is
what Hermes actually executes.

So when something throws, the report Sentry receives points into that bundle:

```
at n (index.android.bundle:1:284915)
```

Which is true, and useless. A **source map** is the translation table between
that position and the real one:

```
at loadFinances (src/screens/FinancesScreen.js:118:7)
```

The map is generated at build time, must not ship to users (it would hand out
the readable source), and is instead uploaded to Sentry, which applies it when
a report arrives. Sentry matches a report to the right map through a **debug
ID** embedded in both the bundle and its map — which is why the bundle you
publish and the map you upload have to be the *same* bundle, not two builds of
the same code.

## One-time setup

### 1. Create a Sentry auth token

In Sentry: **Settings → Auth Tokens → Create New Token**, with the scopes
`project:read`, `project:releases` and `org:read`. Copy it once — Sentry will
not show it again.

### 2. Store it for EAS builds

Run this yourself so the token never lands in a file or in a chat log:

```bash
npx eas-cli secret:create --scope project --name SENTRY_AUTH_TOKEN --type string
```

It prompts for the value. From then on every `eas build` has the token in its
environment and the Sentry Expo plugin uploads the map for that build on its
own — nothing else to do for native builds.

### 3. Store it for local OTA updates

Create `mobile/.env.local` (already covered by `.gitignore` via `.env*.local`):

```
SENTRY_AUTH_TOKEN=your-token-here
```

## Shipping an OTA update

`eas update` builds its own bundle, so running it and then exporting a second
time would produce two bundles with two different debug IDs and Sentry would
match neither. These three commands export once and publish that exact export:

```bash
cd mobile && npm run ota:export
```

```bash
cd mobile && npm run ota:maps
```

```bash
cd mobile && npm run ota:publish -- -m "what changed"
```

- `ota:export` — `expo export --dump-sourcemap`, writes `dist/` with the bundle
  and its `.map` files
- `ota:maps` — uploads the maps out of `dist/` (org and project are read from
  `app.json`, the token from `.env.local`)
- `ota:publish` — `eas update --input-dir dist --skip-bundler`, publishing the
  bundle already in `dist/` instead of building a new one

## Checking it worked

Trigger the test error from the app (long-press in Settings), then open the
issue in Sentry. The stack frames should name `.js` files under `src/` with
real function names, and Sentry should offer the surrounding source lines. If
frames still read `index.android.bundle`, the map for that debug ID never
arrived — the upload step was skipped, or the bundle was rebuilt after it.
