---
name: rn-gotchas
description: Platform traps in this Expo/React Native app — animation, drag and drop, SVG, blur, dates, keyboards. Use before writing an animation, a gesture, an SVG, or any date or number formatting.
---

# Traps that already cost a day each

Every item here is something that looked correct, passed review, and was wrong
on the device.

## Animation

**`useNativeDriver: true` breaks anything that also reorders data.** A
native-driven value is applied on the native module's own schedule, not inside
React's render pass, so a reorder and a transform land on different frames —
text smears, rows jump. Drag and drop in this app is JS-driven (`false`)
everywhere. Do not "optimise" it back.

**Clear transforms in the same commit as the reorder.** Clearing them in
`useEffect` leaves one frame showing the old order with the new transforms.
Use `useLayoutEffect` keyed on an `orderKey` derived from the list.

## SVG

**Gradient and filter ids are global** in `react-native-svg` on Android, not
scoped to the component. Two components using `id="grad"` collide, and the
second silently steals the first's fill. Generate a unique id per instance
(see `gradientSeq` in `Skeleton.js`).

**Stop `offset` is clamped to 0..1.** Animating a stop from `-1.4` to `1.4`
does nothing at all. To sweep a gradient, translate the whole gradient element.

**Widen the `viewBox` before animating anything outward.** Content that moves
past the viewBox is clipped, not shown outside it.

## Blur

`filter: blur()` on RN 0.76+ works on **Android 12 (API 31) and up, and only
under the New Architecture**. iOS does not support it at all. Detect at runtime
rather than assuming — `AmountText.js` checks
`global.nativeFabricUIManager != null` plus the API level, and falls back to
masking the characters.

Transparent text with a `textShadow` is **not** a blur substitute: the glyph
interior stays empty and the result is a crisp readable outline.

## Drag and drop

- **hit-test against the row's centre with `Math.floor`**, not the top with
  `Math.round` — the latter leaves dead bands between rows where nothing drops
- **a dwell timer cannot be measured from stillness.** When the finger truly
  stops, no more move events fire, so a timer cancelled by movement never
  re-arms. Measure dwell against *which row* the finger is over.
- **measure the auto-scroll zone from the list's own edges**, via
  `measureInWindow` on a wrapper `View` — a `ScrollView` ref does not reliably
  expose it, and window coordinates put the zone in the wrong place.

## Dates and numbers

Hermes ships **without full ICU**, so `Intl` and `toLocaleDateString` fall back
to English on the device even though they look right in a browser or in jest.
All date formatting is hand-rolled in `src/i18n/dateFormat.js` and covered by
tests. `String.prototype.normalize` is present but guard it anyway.

## Keyboard

A bottom sheet or form near the bottom of the screen will be covered by the
keyboard. Subscribe to the keyboard events and offset (`Toast.js` does this
with `bottom: 78 + keyboardHeight`), and give tappable rows
`minHeight: 48`.

## Startup

Anything the app waits for before rendering needs a **deadline and an error
path**. `useFonts` returns `[loaded, error]`; gating only on `loaded` meant a
font that never arrived left a blue screen forever. `App.js` now has a 2.5 s
font deadline and a 6 s intro deadline.
