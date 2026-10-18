# adapt-abbott

A fluid, token-driven theme for the [Adapt framework](https://github.com/adaptlearning/adapt_framework),
generated from the **AB Theme Studio**. One hue + two dials (type scale, space
density) drive colour, typography and spacing across the whole course, plus a
library of hand-drawn ("ink") marks, animated backgrounds, washes and hero
headers — all off one `--flow-rate` speed dial and reduced-motion safe.

## Install

Copy this folder to your framework at:

```
src/theme/adapt-abbott/
```

Then set it as the active theme in `src/course/config.json`:

```json
{ "_theme": "adapt-abbott" }
```

Build: `grunt build` (or `grunt dev` to watch).

### Relationship to vanilla (read this)

Adapt loads exactly **one** `_theme`. adapt-abbott provides the **token
foundation, the fluid content-tree rhythm (`article → block → component`), and
the Abbott decoration** (surfaces, marks, backgrounds, washes, heroes). It does
**not** restyle Adapt's full shell — the navigation bar, drawer, page header and
core button chrome. It is designed to **ride on
[adapt-contrib-vanilla](https://github.com/adaptlearning/adapt-contrib-vanilla)'s
base conventions**.

Two ways to use it:

1. **Quickest** — keep your build on vanilla and paste the Abbott `less/` layers
   + `00-foundation.less` into vanilla's `less/` folder (and merge `theme.js`).
   You then get vanilla's shell + Abbott on top, in one theme plugin.
2. **As-is** — set `_theme: adapt-abbott`. You get the tokens, content rhythm and
   all the decoration; you'll want to add base chrome styling for nav/drawer/
   buttons yourself (or copy vanilla's `20-core`-style rules in).

A full standalone replacement for vanilla's shell is deliberately out of scope.

## What theme.js does

- applies the course's `_courseStyle` class to `<html>` (page-wide variant);
- injects **one shared `#ink` SVG filter** so any element can get the hand-drawn
  wobble with `filter: url(#ink)` in CSS;
- supports an in-course **motion off-switch** — `config.json`
  `"_abbott": { "_disableMotion": true }`, or call `setMotion(false)` to add
  `<html class="no-motion">` at runtime.

## LESS layers

All `.less` in `less/` is compiled and concatenated **alphabetically**, so the
numeric prefix controls cascade order. `00-foundation.less` must stay first.

| File | Holds |
|---|---|
| `00-foundation.less` | **tokens** — colour hue-engine + fluid type ramp + fluid space scale + semantic roles, and the `article/block/component` rhythm. Everything else reads these. |
| `15-surfaces.less` | ruled / dot-grid / graph textures, lined surfaces, sketchbook |
| `16-paper.less` | learning surfaces — handwriting, quad, spiral, highlighter, chalkboard, whiteboard, legal pad, index card, corkboard, sticky notes |
| `25-motion.less` | motion layer — opt-in `motion-*` indicators + onscreen/Trickle reveal classes, learner off-switch |
| `35-diagrams.less` | diagram & figure house style (figures, scenes, inline-SVG convention, swatch study, pull-quote) |
| `40-cycle-timeline.less` | animated teaching diagrams — cycle (loop + runner) and timeline (draw-on spine + rising milestones) |
| `45-scribbles.less` | hand-drawn emphasis — underline / circle / strike marks, arrow & star doodles, draw-on |
| `50-marks.less` | **ink marks** — draw-on `.ab-ink` stroke + `.ab-mark--*` (underline/oval/box/strike), `.ab-glyph`, `.ab-hl` highlighters. Geometry is inline SVG (copy from `gallery/marks.html`). |
| `55-bullets.less` | **bullets & markers** — `.ab-fill`/`.ab-pop`/`.ab-num`/`.ab-knob` + `.ab-list`; draw-on list markers (copy SVG from `gallery/bullets.html`). |
| `60-backgrounds.less` | **ambient backgrounds** — `.ab-bg--grad/aurora/blobs/dots/grid/stripes/bokeh/wave/spot/mesh` on an `.ab-bg-host`. |
| `65-washes.less` | **washes & textures** — `.ab-wash--*` transparent→colour gradients + fine textures, intensity dial `--i`. |
| `70-heroes.less` | **hero headers** — `.ab-hero` shell + scrims + content type, composing the background + wash layers. |

## Triggering the draw-on animations

Marks, bullets and other draw-on effects play when an **ancestor** has the class
`ab-ink-play`. Map that onto Adapt's onscreen hook so they draw as a block
scrolls into view:

```json
{ "_onScreen": { "_classes": "ab-ink-play" } }
```

(`.playing` also triggers them, so markup copied straight from the gallery demo
pages works unchanged.) At rest a mark is fully drawn, so it still shows if
nothing ever triggers it. Everything stops under `prefers-reduced-motion` or
`<html class="no-motion">`.

## The gallery

The standalone demo pages in `../../gallery/` show every mark, background, wash,
hero and pattern live, with the SVG path data to copy. The reusable CSS systems
(above) are extracted here; the more demo-specific compositions (connectors,
reveals, process/flow diagrams, interaction patterns, notetaking) still live in
their gallery pages as reference, since they lean on per-page JS scaffolding.

> Not a contrib release package: the semantic-release / CI boilerplate that
> ships with core themes is intentionally omitted. This is a private theme.
