# Background maker

[Open the offline tool](index.html). Eight original CSS studies: dots, grid,
stripes, crosshatch, checker, rings, aurora and floating lights.
Inspired by the categories of tools at [MagicPattern](https://www.magicpattern.design/tools/css-backgrounds)
and [Finisher](https://www.finisher.co/lab/header/), not copies of their code,
presets or artwork. This is not a Finisher integration or a particle simulator.

Choose colours, spacing, thickness, opacity and optional motion. Motion defaults
off. Copy CSS, export settings JSON or download a self-contained HTML header.
The HTML export includes a pause button when motion is enabled. The CSS-only
export needs a host-provided pause control setting `data-paused="true"` on
`.pattern-bg` if you enable motion.

Exported CSS uses a decorative pseudo-element, leaving content as normal HTML.
No external assets or runtime are required for patterns. System reduced motion
and `.no-motion` / `data-tm-no-motion="true"` ancestors disable motion.
Use `.pattern-bg` on the target section. Keep text contrast appropriate yourself;
the tool does not claim to calculate or guarantee it.

`--pattern-ink` inherits page `--accent` when available, with your chosen ink as
fallback. `--pattern-paper` uses your chosen background directly, so page surface
tokens cannot unexpectedly replace it. Override either token on the host.

## Interaction entrance and exit

Enable **Clear pattern on interaction** (on by default). Hovering with a mouse,
pressing the area, or keyboard focus anywhere inside hides only the decorative
pattern. Text and the base background never fade or move. On touch, tapping the
focusable area clears the pattern until focus moves elsewhere. The pattern
returns only when neither hover nor focus is inside.

Choose fade, rise/slide, zoom, blur or wipe for the initial entrance and exit,
with independent entrance/return and exit times (0–3000 ms). Returning reverses
the exit shape using the entrance/return duration; the initial entrance has its
own selected shape. Replay entrance previews the initial effect. Drift motion
can run independently, with its existing pause control.

CSS and HTML exports include the effects without a JavaScript dependency.
For CSS-only embedding, add `tabindex="0"` and a meaningful accessible name to
the area if it contains no focusable controls; HTML export includes these when
interaction is enabled. Initial entrance uses modern `@starting-style`; browsers
without support simply show the pattern immediately, while exits still work.
Reduced motion makes all interaction changes instant and disables drift.

Spacing and stroke thickness affect repeating patterns, not broad aurora/light
gradients. Ring spacing works within a large radial surface. Motion is a gentle
back-and-forth translate/rotation of the decorative layer, not scroll-linked.
Exported CSS needs modern gradient and `color-mix()` support.

`engine.js` exposes `BackgroundMaker.validate`, `.css`, `.html` and `.presets`,
or the equivalent CommonJS API for validation. Settings JSON is an export only;
there is no import or automatic persistence. Existing
[washes](../../assets/backgrounds/washes/index.html),
[textures](../../assets/backgrounds/textured/index.html) and the animated
[starfield](../../assets/backgrounds/starfield/index.html) remain separate.
