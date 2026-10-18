# grow-ct — deep architecture (the `grow-interface`)

How to make **Grow's own maths feed Adapt's whole page**, with *nothing baked*,
by replacing vanilla's painting entirely and interfacing the **bare Adapt core**
directly. This is the target the theme/layout generator should emit against.

---

## 0. Verdict

**Yes — fully possible, and it's the cleaner design.** Verified against
`adapt-contrib-core` and the framework build:

- Core emits **structural CSS only** (the `.page / .menu / .article / .block /
  .component / .nav / .drawer` box model, nav height, drawer slide,
  accessibility, normalize). These are the "page settings" core writes at build.
- Core's **only** variable interface is **layout/dimension + timing** —
  `@device-width-*`, `@max-content-width`, `@icon-size`, `@icon-padding`,
  `@item-margin`, `@item-padding`, `@btn-padding`, `@duration`, `@drawer-width`,
  `@block-padding-*`, `@component-padding-hoz` — plus the layout mixins
  `.l-container-responsive(@size)`, `.l-container-padding(@ver,@hoz)`,
  `.l-fill-viewport-*()`, `.u-float-*()`, and a 4-colour safety palette
  (`@white @black @green @red`).
- **Core does NO colour maths and reads NO theme colour token.** Colour, type and
  (visual) spacing are 100% the theme's job.

So nothing about core forces compile-time colour. The baked `darken()` ladders in
the current `grow-ct` are **vanilla's**, inherited by the fork. Remove
vanilla's painting and drive our own → everything can be live runtime maths.

---

## 1. Current process (how colour reaches the page today)

```
adapt.css  =  @import core/less/**          ← structural only, NO colour
            + @import components/…/less/**   ← per-component structural + a few colours via theme vars
            + @import theme/<theme>/less/**  ← LAST: ALL the colour/type/visual styling
```

Today `theme = grow-ct`, which is a **fork of vanilla**:

- `_defaults/_colors.less` holds vanilla's variable ladder, now re-pointed at
  `@grow-*` base colours. It still runs **LESS `darken()/fade()`** to derive
  hover/selected/visited — and `darken()` needs a *real* colour at compile time.
- So the chrome palette is **baked at the build hue**: `hsl(202,72%,42%)` →
  `darken 10%` → `hsl(202,72%,32%)` etc. are frozen into `adapt.css`.
- Result: content retints live (runtime `--grow-*`), but **chrome does not** — it
  can't follow a hue slider or auto dark-mode, because the ladder is compile-time.

That is the limitation to remove.

---

## 2. The two interfaces

Think of the build as two contracts meeting:

```
┌─ adapt-interface ────────────┐        ┌─ grow-interface ───────────────┐
│ (what bare core gives us)    │        │ (our complete replacement layer) │
│                              │        │                                  │
│ • structural CSS on the      │  met   │ • paints the SAME class contract │
│   class contract             │◄──by──►│   (.nav .drawer .btn .menu-item  │
│ • layout mixins .l-* .u-*    │        │    .page .article .block …)      │
│ • dimension/timing @vars     │        │ • consumes core's .l-* mixins    │
│   (@icon-size,@duration,…)   │        │ • feeds core's dimension @vars   │
│ • 4-colour safety palette    │        │   from Grow space profile      │
│ • NO colour/type opinion     │        │ • supplies ALL colour/type/visual│
└──────────────────────────────┘        │   from @grow-base + --ab tokens│
                                         └──────────────────────────────────┘
```

**We honour the adapt-interface** (use its mixins; optionally override its
dimension vars from our space profile) and **we own everything else.** Vanilla is
gone except as a reference list of *which selectors exist*.

Nuance: core does LESS arithmetic on a few dimension vars
(`@navigation-height: @icon-size + (@icon-padding * 2)`). Vars we feed back into
core (`@icon-size`, `@item-padding`…) must stay **compile-time LESS lengths**
(from the active space profile), not `var()`. Everything *we* paint uses runtime
`--grow-*`.

---

## 3. Proposed token model — two tiers

A **stable interface layer** the painting reads, fed by a **swappable profile
layer** the generator writes. Two indirections, exactly as you described
(`@grow-base-typography` → `@grow-theme-typography-<profile>` → values).

```
PROFILE (generator output)         INTERFACE (stable; painting reads ONLY this)
--------------------------         --------------------------------------------
--abp-h: 202;                  ┐
--abp-s: 72%;                  │   --grow-color-accent:        hsl(var(--abp-h) var(--abp-s) var(--abp-accent-l));
--abp-accent-l: 42%;           ├──►--grow-color-accent-hover:  hsl(var(--abp-h) var(--abp-s) calc(var(--abp-accent-l) - 8%));
--abp-ink-l: 16%;              │   --grow-color-accent-active: hsl(var(--abp-h) var(--abp-s) calc(var(--abp-accent-l) - 14%));
--abp-ladder-step: 8%;         ┘   --grow-color-ink:           hsl(var(--abp-h) 25% var(--abp-ink-l));
                                   --grow-color-surface-1:     hsl(var(--abp-h) 24% var(--abp-surface-1-l));  … etc.
```

- **Tier 1 · PROFILE** = raw dials + formula seeds. The generator writes exactly
  this file. Grouped by domain and named by profile:
  `@grow-theme-color-<name>`, `@grow-theme-type-<name>`,
  `@grow-theme-space-<name>`, `@grow-theme-layout-page-<name>`.
- **Tier 2 · INTERFACE** = the Grow maths applied to the profile, producing the
  semantic tokens: `--grow-color-*`, `--grow-type-*`, `--grow-space-*`, `--grow-layout-*`.
  **All runtime** (so colour hover/selected is `hsl()/color-mix()` live — nothing
  baked), **except** the handful of LESS dimension vars fed back into core.
- **The painting layer references only Tier 2.** Swap the active profile (one
  `@import`/one assignment) → the whole page reskins, live, including the chrome.

### Colour maths (runtime, your HSL formulas)
```less
:root {
  // active colour profile (generator output) ------------------------------
  --abp-h: 202; --abp-s: 72%; --abp-gs: 12%;
  --abp-accent-l: 42%; --abp-ink-l: 16%; --abp-surface-1-l: 99%; --abp-line-l: 86%;
  --abp-hover-Δ: 8%; --abp-active-Δ: 14%;   // ladder deltas, not darken()

  // interface — Grow's maths (stable names the painting uses) ------------
  --grow-color-accent:        hsl(var(--abp-h) var(--abp-s) var(--abp-accent-l));
  --grow-color-accent-hover:  hsl(var(--abp-h) var(--abp-s) calc(var(--abp-accent-l) - var(--abp-hover-Δ)));
  --grow-color-accent-active: hsl(var(--abp-h) var(--abp-s) calc(var(--abp-accent-l) - var(--abp-active-Δ)));
  --grow-color-ink:           hsl(var(--abp-h) 25% var(--abp-ink-l));
  --grow-color-surface-1:     hsl(var(--abp-h) 24% var(--abp-surface-1-l));
  --grow-color-line:          hsl(var(--abp-h) 18% var(--abp-line-l));
}
/* dark mode = a DIFFERENT profile (flip the *-l seeds); interface formulas unchanged */
```
`darken(@x,10%)` becomes `calc(L - var(--abp-hover-Δ))` — same idea, but live and
hue-aware. This is the whole point: **chrome hover/selected now follow the dials.**

### Type & space maths (runtime, fluid clamp)
```less
:root {
  // active type profile (generator output): clamp seeds per step
  --abp-fs-base-min: 1rem;  --abp-fs-base-vw: 0.35vw; --abp-fs-base-max: 1.15rem;
  --abp-type-scale: 1;
  // interface
  --grow-type-size-base: ~"clamp(var(--abp-fs-base-min), calc(var(--abp-fs-base-min) + var(--abp-fs-base-vw)), var(--abp-fs-base-max))";
  // space profile → fluid scale, density dial baked into the token
  --abp-space-scale: 1;
  --grow-space-md: calc(clamp(1.5rem, 1.2rem + 1.2vw, 2.5rem) * var(--abp-space-scale));
}
```

---

## 4. Structural groupings (the generator's target layout)

```
grow-ct/less/
  00-interface/              ← STABLE. The grow-interface token contract.
    _color.less                --grow-color-*      (roles: accent/ink/surface/line/semantic)
    _space.less                --grow-space-*      (fluid scale + semantic pad/gap roles)
    _type.less                 --grow-type-*       (fluid ramp + weights/lh/tracking)
    _motion.less               --grow-motion-*     (--flow-rate, durations, easings)
    _layout.less               --grow-layout-*     (page/menu/article/block/component rhythm)
  10-profiles/               ← GENERATOR OUTPUT. Swappable value sets + formulas.
    color/<name>.less          @grow-theme-color-<name>  (--abp-* colour seeds)
    type/<name>.less           @grow-theme-type-<name>
    space/<name>.less          @grow-theme-space-<name>
    layout/<name>.less         @grow-theme-layout-<name>
    _active.less               selects the active profile per domain (ONE place)
  20-core-bridge.less        ← feed core's dimension @vars from the space profile
                               (@icon-size, @item-padding, @drawer-width … = LESS lengths)
  30-paint/                  ← the grow-interface PAINTING (meets the class contract)
    global.less page.less menu.less nav.less drawer.less notify.less
    button.less article.less block.less component.less
  40-components/             ← Grow's own component widgets (reads --grow-* only)
  grow-kit/                    ← ink marks, bullets, backgrounds, washes, heroes
```

Compile order inside the theme is **filename-sorted** by the build, so the numeric
prefixes above are the cascade order. `00-interface` + `10-profiles` + `20-bridge`
define everything; `30-paint` consumes `--grow-*`; `grow-kit` layers last.

Rule for the whole thing: **`30-paint/*` and `40-components/*` may reference only
`--grow-*` (Tier 2) tokens and core's `.l-*` mixins — never a raw colour, never a
profile var.** That single rule is what makes a profile swap reskin the page.

---

## 5. The generator contract (what the tool emits)

The generator never touches `00-interface` or `30-paint`. It writes **only**
`10-profiles/*`:

| Dial in the tool | Emits to | Shape |
|---|---|---|
| Colour (hue slider / palette template) | `10-profiles/color/<name>.less` | `--abp-h/s/gs`, lightness seeds per role, ladder deltas, + a dark variant |
| Typography (scale + ramp) | `10-profiles/type/<name>.less` | clamp min/vw/max per step, `--abp-type-scale` |
| Spacing/density (fluid) | `10-profiles/space/<name>.less` | clamp seeds per step, `--abp-space-scale`, + core dimension lengths |
| Layout (page/menu structure) | `10-profiles/layout/<name>.less` | container widths, gutters, rhythm roles |
| Active selection | `10-profiles/_active.less` | `@import` the chosen `<name>` per domain |

So "turn the colour dial / apply a template" → regenerate one small profile file
→ rebuild → whole page (chrome + content) reskins, live and fluid, nothing baked.

---

## 6. Migration from today's `grow-ct`

Today's plugin already proves the slot + token idea. To reach this target:

1. **Keep** the fork's `js/`, `templates/`, `properties.schema`, fonts — unchanged.
2. **Delete** vanilla's `less/_defaults/_colors.less`, `_btn-*`, `core/*`,
   `project/*` painting (the compile-time colour layer).
3. **Add** `00-interface/`, `10-profiles/`, `20-core-bridge.less`, `30-paint/`
   (Grow painting of the class contract, reading `--grow-*`).
4. **Keep** `grow-*` content kit (already reads `--grow-*`-style tokens).
5. Verify by compiling `adapt-contrib-core/less` + theme (as this repo already
   does for the fork) and by one real `grunt build` screenshot.

This is a rewrite of the *painting* layer (~10 files) against the class contract
— real but bounded work, and the part worth doing together step by step.

---

## 7. Structure & template layer — injecting your own DOM at the structural level

The DOM (`page > article > block > component`, menu, nav, drawer) is **not** built
by LESS. It is produced at runtime by Backbone views + Handlebars/JSX templates,
which the build registers. So "add our own structures at core level" is a
**template** question, answered separately from the token/LESS work above.

### How template resolution + override works (verified)

- `grunt handlebars` collects `.hbs`/`.jsx` from the same stage order as LESS:
  `core/templates → components → extensions → menu/<menu> → theme/<theme>`
  (**theme last**), compiling all into `Handlebars.templates`, **keyed by bare
  filename** (`block.hbs` → `templates['block']`, folder ignored).
- Each view looks its template up **by name**: `blockView` has `template: 'block'`;
  `adaptView` renders `Handlebars.templates[this.constructor.template]` (or, for a
  `*.jsx` name, the React registry in `core/js/reactHelpers`).
- Because names collide and the theme is registered last, **a theme's
  `templates/block.hbs` overrides core's `block.hbs`** — no fork of core needed.
- Every template is also wrapped with `…View:preRender` / `…View:postRender`
  events, so markup can be modified at runtime *without* replacing the file.

### What that lets grow-base do — by effort

| Want | Mechanism | New JS? |
|---|---|---|
| Add classes to any level | JSON `_classes`, or a template override | no |
| **Inject div structure into a level** — e.g. every `block` renders `.block > .col-1 + .col-2`, or a page/menu header with a `.social` div | ship `grow-ct/templates/<name>.hbs` overriding core's, + `templates/partials/_grow-*.hbs` | no |
| **Your own menu system** (not a component) — custom menu DOM, social block, etc. | a **`menu` plugin** (`menu/adapt-abbott-menu/`, own view + templates), selected by `_menu` in config.json | yes (a small MenuView) |
| Modify rendered markup globally without owning the file | listen to `blockView:postRender` etc. in an extension/theme view | yes (tiny) |
| **A new data/hierarchy level** — e.g. a real `grow-block` model *between* article and block, with its own JSON | a core-type/extension plugin: new Model + View + collection + registration | yes (real plugin) |

### The one hard rule when overriding a core template

The core **view still runs** against your markup. It binds to specific hooks —
the inner container (`.block__inner`), `data-adapt-id`, `.js-*` classes, the
child-view mount point. An override must **keep those hooks** and wrap/extend
*around* them; drop one and rendering or behaviour breaks. So: add your
`.col-1/.col-2`/`.social` wrappers, but leave the container the view
appends children into intact.

### So, to your examples

- `article > block` with `col-1`/`col-2` built in → **template override of
  `block.hbs`** (no new model). (Vanilla also exposes a `.col-*` class system, so
  two-column blocks are even achievable by `_classes` alone.)
- A menu with your own social-media template → **a `menu` plugin**
  (`_menu: "adapt-abbott-menu"`), which is the proper "own menu system, not a
  component over it." A page-level social block → **override `page.hbs`** +
  a partial.
- JSX core templates (`header.jsx`, `navButton.jsx`) override by name too, but via
  the React registry — more involved than `.hbs`; prefer an `.hbs` override or a
  `postRender` tweak there.

Net: you can own the **structure** at the core level — inject divs, classes,
partials, even a whole menu — entirely through template overrides + a menu plugin,
without forking `adapt-contrib-core`. Only a brand-new *data* level needs a JS
plugin. Structural template overrides live in the theme
(`grow-ct/templates/`), so they ship with grow-base and your
generator can emit them alongside the token profiles.

### Worked slice shipped in this repo

A concrete vertical slice is built so you can see it and drop it into a build:

- **Preview (visible now):** `gallery/grow-structure.html` renders the exact
  target DOM — article + frontmatter → two-column block (each column with its own
  title/description/frontmatter) → two different components — styled with the
  Grow tokens, with a "show structure" toggle.
- **Real override files** under `grow-ct/`:
  - `templates/article.hbs` — core override adding `.article__frontmatter`
    from `_grow._frontmatter` (keeps `.block__container`).
  - `templates/block.hbs` — core override adding `.cols` from
    `_grow._columns` (keeps `.component__container` as the mount).
  - `js/themeBlockView.js` — `arrangeColumns()` moves each component out of the
    staging container into the column that claims its `_id` (MutationObserver for
    timing).
  - `less/grow-structure.less` — token-driven styling for the frontmatter + columns.
  - `schema/grow-structure.schema.json` + `examples/structure.example.json` —
    the authored field shapes and a populated example.

**Verified here:** both templates compile (Handlebars), the JSON is valid, and the
full theme compiles against real `adapt-contrib-core` LESS. **Needs a real
`grunt build` + browser to confirm at runtime:** the `themeBlockView` component
routing (view timing) and the schema merge into the authoring tool — I can't run
Adapt's runtime in this environment, so those are shipped as correct files but
runtime-unverified.

## 8. One-line summary

Core gives us a colourless structural interface + layout mixins. Vanilla used to
supply colour with compile-time `darken()`, which bakes the chrome. We replace
vanilla's painting with our own `grow-interface` that reads a two-tier token
system (stable `--grow-*` ← swappable generator profiles) and does all colour/type/
space maths **at runtime** — so the whole page, chrome included, is driven by the
dials with nothing frozen.
