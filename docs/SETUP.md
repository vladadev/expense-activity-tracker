# Setting this up on a fresh machine

Written 8 October 2026, the day the development machine was wiped and
reinstalled. The README says how to run the project; this says how to get from
a blank Windows to a machine that can run it, in the order that works.

The secrets this needs are **not in this repository** and never will be. They
live in the backup folder made before the wipe (`duo-tracker-backup`), and the
restore guide inside it — `VRATI-OVAKO.md` — is the companion to this file.

---

## 1. The three things to install first

Nothing below works without these, and they are needed before the repository
can even be cloned.

| | Version that this was built on | Where |
|---|---|---|
| **Node.js** | v22.20.0 (LTS) | https://nodejs.org |
| **Git** | 2.51 | https://git-scm.com |
| **Claude Code** | — | https://claude.ai/download |

Take the defaults in every installer. Then check, in a new terminal:

```
node -v     →  v22.x
npm -v      →  10.x
git --version
```

If `node` is not recognised, the terminal was open before the install — close
it and open a new one.

## 2. Tell git who you are

```
git config --global user.name "vlada"
git config --global user.email "vladimir.business0@gmail.com"
```

## 3. Get the code

```
cd D:\Projects
git clone https://github.com/vladadev/expense-activity-tracker.git duo-tracker
```

GitHub will ask to sign in the first time. It is HTTPS, not SSH, so there are
no keys to restore — a browser sign-in is enough.

> **Keep this exact path.** `D:\Projects\duo-tracker` is what Claude Code
> derives its per-project folder name from, so putting it elsewhere orphans
> the memories restored in step 7.

The other project, if it is wanted on this machine too:

```
git clone https://github.com/vladadev/tally.git
```

## 4. Put the secrets back

From the backup:

```
copy  env\backend.env       D:\Projects\duo-tracker\backend\.env
copy  env\mobile.env.local  D:\Projects\duo-tracker\mobile\.env.local
```

`backend/.env` holds `MONGODB_URI`, `JWT_SECRET`, `PORT` and `SENTRY_DSN`.
`mobile/.env.local` holds `SENTRY_AUTH_TOKEN`, which is only used when
publishing, to upload source maps.

Nothing else needs restoring to run the app: the database is MongoDB Atlas and
the Android signing key stays on the EAS servers.

## 5. Install the packages

```
cd D:\Projects\duo-tracker\backend  &&  npm install
cd D:\Projects\duo-tracker\mobile   &&  npm install
```

The mobile install is the slow one. It is around 500 MB of `node_modules` and
none of it is in the repository, by design.

## 6. Prove it works before trusting it

```
cd D:\Projects\duo-tracker\mobile
npx jest          →  195 tests, 0 failures
npx eslint src    →  0 errors
```

If both pass, the code is complete and the toolchain is right. If `jest` fails
on something that looks like a missing module, `npm install` did not finish —
run it again rather than debugging the failure.

Then the backend, which is the first thing that actually touches the network:

```
cd D:\Projects\duo-tracker\backend
npm run dev
```

It should connect to Atlas and listen. If it cannot connect, the problem is
`.env` or the Atlas IP allow-list — a new machine can have a new address, and
Atlas refuses addresses it does not know. Fix it in the Atlas dashboard under
Network Access, not in the code.

## 7. Restore the rest

- **Claude Code memories** → `claude\memory\` from the backup goes to
  `C:\Users\vladi\.claude\projects\D--Projects-duo-tracker\memory`.
  Without them Claude starts without knowing anything agreed in past sessions.
- **Animations** → `animations\` back to `D:\Projects\duo-tracker animations`.
- **Database dumps** → `db-backups\` to `backend\backups`.

## 8. Sign back in

```
cd D:\Projects\duo-tracker\mobile
npx eas-cli login
```

After that, publishing works as before:

```
npm run ota:design -- "what changed"
```

That script sets the variant for the whole chain and checks, at the end, that
the channel really is serving the design build. If it prints a warning instead
of a tick, do not walk away from it — see `scripts/ota.mjs` for what that
check is protecting against.

## 9. The test phone

The app on the phone is **Pond (test)**, a separate install from the real one,
and it was not touched by any of this. It keeps working. If it needs
reinstalling, build a new APK:

```
npx eas-cli build --profile design --platform android
```

---

## What is deliberately not here

- **The Android keystore.** EAS holds it. There is a copy in the backup for the
  day the Expo account is lost, and it must never be committed — `.gitignore`
  covers `credentials.json`, `*.jks` and `*.keystore` for exactly that reason.
- **`google-services.json`.** It *is* in the repository and comes down with the
  clone; it is not a secret.
- **`android/` and `ios/` folders.** They do not exist here. EAS builds in the
  cloud from the Expo config, and generating them locally would create a second
  source of truth for things like the package name.
