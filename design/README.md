# Brand assets

Source SVGs for the Duo Tracker mark. The app itself does not read from this
folder — `mobile/assets/` holds what ships — these are the editable originals,
kept here so design work has one place to start from.

| File | Use |
|---|---|
| `duo-tracker-logo.svg` | The mark as it ships. Static, rounded app-icon plate. |
| `duo-tracker-logo-animatable.svg` | Same mark, structured for animation: named parts, no animation of its own. Hand this one to a design tool. |
| `duo-tracker-spinner.svg` | Transparent background, spins continuously. Loading element. |
| `duo-tracker-intro.svg` | Spins three times and settles. Splash. |

## Animating it

Animate `#coin-spin`, never `#coin`. `#coin` carries a `transform` attribute
that centres the mark, and a CSS transform on the same element replaces that
attribute rather than adding to it — the coin jumps to the top-left corner.
`#coin-spin` sits inside it with its local origin already at the centre, so
rotation and scaling need no `transform-origin`.

`#plate` can be deleted as a whole for a transparent mark. `#half-blue` and
`#half-rose` are addressable separately, for splitting the halves apart.

The CSS animations in these files run in a browser. React Native's SVG
renderer does not execute CSS animation — in the app the same motion has to be
driven through `Animated`.

## Motion source

The splash and loader animations live in a Claude Design project:
https://claude.ai/design/p/81c20235-910e-4c54-b825-519856cd5f7c

The readable sources there are `duo-splash-scene.jsx` and
`duo-loader-scene.jsx`; the `(standalone)` HTML files are bundled output and
are mostly runtime. Both are web React on Claude Design's composition runtime
(`CompositionStage`, `useComposition`), none of which exists in React Native —
what ports is the motion maths, not the components.
