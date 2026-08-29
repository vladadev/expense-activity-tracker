---
name: ship-update
description: Ship a change to the phones — decide between an OTA update and a new native build, then run the release steps with Sentry source maps. Use when asked to publish, deploy, build, or "push to the phone".
---

# Shipping a change

## First decide: OTA or native build

An OTA update replaces the JavaScript bundle inside an already-installed app.
It cannot add native code, because native code lives in the APK.

**OTA is enough** for anything under `mobile/src`, `App.js`, translations,
styles, images and other assets.

**A new native build is required** when the change touches:
- a new dependency with native code (`expo-haptics`, NetInfo, `expo-blur`,
  `react-native-svg`…) — check for an `android/` or `ios/` folder or an
  `expo-module.config.json` in the package
- anything in `app.json` under `plugins`, `permissions`, `android`, `icon`,
  `splash`, or the package name
- `version` — `runtimeVersion` is `{"policy": "appVersion"}`, so bumping
  `version` makes older installs **stop receiving OTA updates** until they
  install the new APK. Only bump it when you are actually shipping an APK.

If unsure, ask before publishing. An OTA that expects a missing native module
crashes on launch, and the fix has to arrive by APK.

## OTA update

Three steps, in this order, from `mobile/`. The order matters: the maps must
belong to the exact bundle that gets published, or Sentry cannot read the
stack traces.

```bash
cd mobile && npm run ota:export
```

```bash
cd mobile && npm run ota:maps
```

```bash
cd mobile && npm run ota:publish -- --message "what changed"
```

`--message` rather than `-m`: npm on Windows splits the value on spaces and
only the first word reaches the message.

Needs `SENTRY_AUTH_TOKEN` in `mobile/.env.local` — see `docs/SENTRY.md`.

The channel is `preview`. The installed APKs are preview builds, so that is the
branch they poll. The app checks on launch and applies the update on the next
launch — so tell the user to open the app twice.

## Native build

```bash
cd mobile && npx eas-cli build --profile preview --platform android
```

`preview` produces an APK for direct install; `production` produces an AAB for
the Play Store. Source maps upload on their own during the build, from the
`SENTRY_AUTH_TOKEN` EAS secret.

## Before shipping anything

- `cd mobile && npm test` and `cd backend && npm test` both pass
- backend changes deploy separately — an app change that calls a route the
  server does not have yet will fail on every phone at once
- the user runs all git commands himself; never commit or push for him

## Environment notes

- prefix npm/node commands with `NODE_USE_SYSTEM_CA=0` on this machine
- `eas` is not on PATH — always `npx eas-cli`
- PowerShell 5.1 has no `&&`; use `;` or the Bash tool
