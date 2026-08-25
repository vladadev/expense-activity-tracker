---
name: screen-states
description: Get a screen's loading, empty, failed and stale states right. Use when adding a screen, adding a data read, or when a screen shows a spinner, a blank state, or "nothing yet".
---

# The four states of a screen

A screen that reads data has four outcomes, and each has exactly one correct
presentation. Collapsing any two of them is a bug the user notices.

| State | Show |
|---|---|
| loading | `SkeletonBlock` in the shape of the real content |
| loaded, no records | the empty state ("no expenses yet") |
| loaded from cache | the content, plus how old it is |
| could not read | `LoadFailed` with a retry button |

## Never show empty for a failure

This was a real defect: Statistics said "no expenses entered" while the phone
simply could not read anything. The user reasonably concluded their data was
gone. Track the two separately:

```js
const [loaded, setLoaded] = useState(false);
const [loadFailed, setLoadFailed] = useState(false);
```

and branch failure **before** empty:

```js
{!loaded && loadFailed ? <LoadFailed onRetry={load} />
  : !loaded ? <SkeletonBlock … />
  : records.length === 0 ? <Text>{t('…noneYet')}</Text>
  : records.map(…)}
```

## Read through `cachedGet`, and read defensively

Use `cachedGet` from `src/api/cachedGet.js` instead of `client.get` for
anything a screen renders. It returns `{ data, stale, at }` and serves the last
good copy when there is no response — but rethrows on a 401 or 404, because
answering an error with old data is a lie.

**One uncached read takes the whole screen down.** A `Promise.all` of five
reads where one still uses `client.get` rejects entirely, and the screen sits
on its skeleton forever. When touching a screen's loader, check every call in
the `Promise.all`.

## Skeletons

- `SkeletonBlock` needs a distinct `y` per instance — the gradient ids are
  global in `react-native-svg` on Android, and duplicates collide (this broke
  twice)
- `useDeferredSkeleton` delays showing by 200 ms and keeps it for at least
  400 ms, so a fast read does not flash
- for a user-initiated write, show no skeleton at all — the optimistic update
  means there is nothing to wait for

## Loading text

There is no bare "Učitavanje…" anywhere. Either a skeleton, or a `DuoLoader`
for a full-screen wait.
