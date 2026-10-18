# Adapt Theming Guide

A reference for theming the **Adapt** e-learning framework (adapt-contrib-vanilla,
framework/grunt build) — the content structure, the core CSS classes you style,
and a base override system grouped by web-design aspect.

---

## 1. How Adapt is structured

### Content model (the JSON)

A course is a tree. Each level is a separate JSON file in `src/course/`:

```
Course
└── Content Object        (a PAGE or a MENU)          contentObjects.json
    └── Article           (a section within a page)   articles.json
        └── Block         (a row of content)          blocks.json
            └── Component  (the actual content)        components.json
```

- **Course** — global settings, title, the whole package.
- **Content Object** — either a **page** (`_type: "page"`) that holds content, or a
  **menu** (`_type: "menu"`) that links to other content objects. Menus are how
  learners navigate; pages are where learning happens.
- **Article** — a grouping of blocks inside a page. Think "section". Often the unit
  you band or alternate visually.
- **Block** — a horizontal grouping. A block can hold one or two components
  side-by-side (`_layout: "left" | "right" | "full"`). This is the responsive
  row.
- **Component** — the leaf: text, graphic, narrative, accordion, MCQ, etc.
  Comes from a component plugin (`adapt-contrib-text`, `adapt-contrib-mcq`…).

### Rendered DOM (what you actually style)

Each level renders an **outer** element and an **`__inner`** wrapper:

```html
<div class="article" id="a-05">
  <div class="article__inner">
    <div class="block" id="b-10">
      <div class="block__inner">
        <div class="component text-component" id="c-15">
          <div class="component__inner">
            <div class="component__header"> … title / body … </div>
            <div class="component__widget"> … the interactive bit … </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

**The golden rule of Adapt theming:**

| You want…                                   | Target the…         |
|---------------------------------------------|---------------------|
| Full-bleed background, band, divider        | **outer** (`.article`, `.block`) |
| Padding, card, shadow, max-width, radius    | **`__inner`**       |

The outer element spans the viewport; the `__inner` is width-constrained to the
layout. Putting a card background on `.block` instead of `.block__inner` is the
single most common theming mistake and makes everything look flat/full-bleed.

---

## 2. Core & key classes

### Structural classes

| Class              | What it is                                             |
|--------------------|--------------------------------------------------------|
| `.article`         | Section wrapper (outer, full width).                   |
| `.article__inner`  | Section content (constrained). Padding goes here.      |
| `.block`           | Row wrapper (outer, full width).                        |
| `.block__inner`    | Row content (constrained).                             |
| `.component`       | A single component wrapper (outer).                    |
| `.component__inner`| Component content — **the usual "card" layer**.        |
| `.component__header`| Title + body of a component.                          |
| `.component__title`| The component heading.                                 |
| `.component__body` | The component's body copy.                             |
| `.component__widget`| The interactive/display region of the component.      |

### Component type classes

Every component also carries a type class, so you can style one kind of component:

```
.text-component   .graphic-component   .narrative-component
.accordion-component   .mcq-component   .hotgraph-component  …
```

### State classes (added by the framework at runtime)

Adapt toggles these on elements as the learner progresses — hook your styling to
them rather than reinventing state:

| Class            | Meaning                                                |
|------------------|--------------------------------------------------------|
| `.is-complete`   | Item/component finished.                               |
| `.is-incomplete` | Not yet finished.                                      |
| `.is-visited`    | Has been seen.                                         |
| `.is-active`     | Currently active (e.g. open accordion item).           |
| `.is-selected`   | Chosen (e.g. an MCQ option).                           |
| `.is-correct` / `.is-incorrect` | Answer feedback states.                 |
| `.is-disabled`   | Non-interactive.                                       |
| `.is-open` / `.is-closed` | Expandable open/closed.                       |

Device/display classes on the HTML root let you target breakpoints:
`.size-small`, `.size-medium`, `.size-large`, plus `.is-touch` / `.no-touch`.

### The authoring hook: `_classes`

**This is the most important class mechanism for a themer.** Every content object,
article, block, and component in the JSON can carry a `_classes` string. Adapt
prints it verbatim on that element's wrapper. So you define modifiers in LESS and
let authors opt in per item — no code change needed:

```json
{
  "_component": "text",
  "_classes": "is-raised brand-accent",
  "body": "…"
}
```

```less
.is-raised .component__inner { box-shadow: @elev-2; }
.brand-accent .component__inner { border-left: 4px solid @accent; }
```

Design your theme as a small vocabulary of `_classes` modifiers (`is-raised`,
`is-flush`, `bg-tint`, `no-padding`, `stretch`…) and document them for authors.

---

## 3. Where theme code lives (framework / grunt)

```
src/theme/adapt-contrib-vanilla/
├── less/            ← all .less here is compiled + concatenated
│   ├── _defaults.less        (vanilla variables — names vary by version)
│   ├── …vanilla partials…
│   └── zzz-overrides.less    ← YOUR overrides (add this)
└── assets/          ← fonts, images
```

- **Don't edit vanilla's partials** — they're overwritten on plugin update.
- Add `zzz-overrides.less`. The `zzz-` prefix makes it compile **last**, so it
  wins specificity ties without `!important`.
- Build: `grunt build` (production) or `grunt dev` (watch + rebuild on save).
- For a reusable brand, fork vanilla into your own theme plugin and set
  `_theme` in `config.json`.

> **LESS is compile-time.** `@variables` are resolved when grunt runs — they are
> not live like CSS custom properties. To swap themes at *runtime* (e.g. a
> dark-mode toggle without duplicating rules), use CSS custom properties
> (`--surface`) instead; vanilla v5+ already exposes some.

---

## 4. The override system, grouped by design aspect

The companion file `zzz-overrides.less` is organised into these sections. Summary
of what each owns and the levers that matter.

### 4.1 Color
Define a **raw palette** once, map it to **semantic tokens** (`@text`, `@primary`,
`@surface`, `@divider`…). Reference only the semantic tokens elsewhere, so a
rebrand is a few edits. Keep separate tokens for text, surfaces, and feedback
(`@positive` / `@negative`).

### 4.2 Typography
- `@font-base`, `@font-heading`, `@font-mono`.
- A **modular scale** (`@fs-h1 … @fs-xs`) so sizes feel systematic.
- `@lh-body` (~1.6 for screen reading), `@lh-tight` for headings.
- `@measure` (~68ch) caps line length on `.component__body` for readability.

### 4.3 Layout — *the backbone of depth*
- `@layout-max`, `@gutter`.
- An **UNEQUAL spacing scale**: `@space-article` > `@space-block` >
  `@space-component` (e.g. 72 / 40 / 20 px). Equal spacing at all three levels is
  the #1 cause of a "flat" course. Unequal spacing alone reads as hierarchy
  before any shadow.
- Padding applied to `.article__inner` / `.block__inner`; margin to `.component`.

### 4.4 Surfaces
- Page background + **alternating article bands**
  (`.article:nth-of-type(even)`). Strongest "separate sections" cue, zero markup
  cost. Keep the lightness shift small — depth, not zebra stripes.

### 4.5 Depth (elevation)
- **Two-part shadows** (tight contact + soft ambient) read as real elevation;
  one blurry shadow reads as fake. `@elev-1` resting, `@elev-2` raised.
- Pick **one** level to be the card (usually `.component__inner`).
- Reserve higher elevation for **interactive** components via `_classes`
  (`.is-raised`) so elevation signals "do something here".

### 4.6 Shape
- Radius scale (`@radius-sm/md/lg`), hairline dividers from `@divider`.

### 4.7 Motion
- One shared `@ease` + `@dur` for consistent transitions.
- `@media (prefers-reduced-motion: reduce)` guard.

### 4.8 Dark mode
- Shadows nearly vanish on dark surfaces, so depth **switches strategy**: from
  shadow to **surface-lightness + subtle border**. Swap the tokens *and* rewrite
  the elevation rules inside the dark scope (because LESS vars are compile-time).

---

## 5. Depth checklist (quick reference)

1. **Spacing first** — unequal article/block/component rhythm. Fix this before
   touching shadows.
2. **Bands at article level** — small tonal shift, full width.
3. **Cards at one level** — `.component__inner`, two-part shadow, radius.
4. **Elevation = meaning** — raise interactive components via `_classes`.
5. **Outer vs `__inner`** — full-bleed on outer, cards on `__inner`.
6. **Dark mode** — border + surface lightness, not shadow.
7. **Reduced motion** — always guard transitions.

---

## 6. Build & verify loop

```bash
# from the framework root
grunt dev          # watch + rebuild, serve locally
# edit less/zzz-overrides.less, save, refresh browser
grunt build         # production build when happy
```

Inspect compiled output in devtools to confirm you're overriding the selector
vanilla actually uses (it sometimes styles `.block` where you'd expect
`.block__inner`).
