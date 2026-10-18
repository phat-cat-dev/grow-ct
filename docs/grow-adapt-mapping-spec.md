# GROW → Adapt mapping & data-extensibility spec

How the GROW layer sits on Adapt, how its data layer stays extensible, and the
rulings that keep the two cleanly separated. Companion to
`grow-base-architecture.md` (token tiers) and `grow-data-presentation-map.md`
(level/role/BEM map).

---

## 1. Where GROW meets Adapt

Adapt's build `@import`s every plugin's LESS/templates in a fixed order and the
theme comes **last**, so GROW wins the cascade without forking core:

```
mandatory  adapt-contrib-core        structural HTML + classes + layout mixins (the contract)
src        components → extensions → menu
src        theme = grow-ct   ← LAST: GROW owns colour, type, space + structure overrides
```

GROW touches Adapt at exactly three seams, and nowhere else:

| Seam | Adapt side | GROW side |
|---|---|---|
| **Class contract** | core templates emit `.page/.article/.block/.component` + `__inner` / `__container` / `.js-heading` | GROW paints those classes and overrides the templates by filename (theme is last) |
| **Layout interface** | core's `.l-container-padding`, `.l-container-responsive`, `@device-width-*`, `@icon-size`, `@duration` … | GROW consumes these; may feed them compile-time values from a space profile |
| **Authored data** | each model carries a target-attribute object | GROW reads `_grow` (its `targetAttribute`) — never collides with core/component fields |

**GROW never edits `adapt-contrib-core`.** Overrides are additive (template by
name, LESS by cascade, data under `_grow`), so Adapt and its contrib components
keep working and the theme stays upgrade-safe.

### Level map

| Adapt level | GROW role | Depth | Heading | Mount hook (keep!) |
|---|---|---|---|---|
| contentObject (page) | `lesson` | `d01` | `h1` | `.article__container` |
| article | `phase` | `d02` | `h2` | `.block__container` |
| block | `section` | `d03` | `h3` | `.component__container` |
| component | `learning-step` | `d04` | `h4` | — |
| component item | `item` | `d04`+ | — | — |

Stamped by `growMeta.js` on every object element: `data-grow-role`,
`data-grow-level` (2-digit `dNN`), `data-grow-type`, `data-fm-<key>`.

---

## 2. The data layer is extensible by design

Two tiers, kept apart from presentation:

- **Per-instance metadata** — `_grow._frontmatter._fields[]`. Add a field by
  authoring one object `{ "_key": "...", "label": "...", "value": "...",
  "_display": true|false }`. It is immediately stamped as `data-fm-<key>` and, if
  `_display`, rendered as a `.frontmatter__item`. **No template, schema or
  CSS change needed to add a field.** That is the extensibility.
- **Reusable value sets** — the theme profiles (`grow-<customer>-theme-profile`)
  supply the colour/type/space dials; swapping the profile reskins everything.

Three independent switches make metadata *data-first*:

1. `_isEnabled` — is there a frontmatter layer at all.
2. `_display` (object) — render it, or keep it metadata-only (`data-fm-*` only).
3. `_display` (field) — show this field, or keep it as data.

Rule: **if it isn't presentational it stays as `data-*`, not markup.** Semantic
identity (`_role`, `_type`, `_level`) and arbitrary metadata ride on the element;
the DOM is queryable/styleable without rendering anything.

---

## 3. Ruling — frontmatter does NOT get Adapt's inner/outer nesting

Adapt gives every level an **outer** element and an **`__inner`** (and headers a
further `__header-inner`), and padding/gutters are applied per depth through
`.l-container-padding` — so spacing is already established at page, article and
block. The question was whether the frontmatter block should carry its own
inner/outer wrapper pair to match.

**Decision: no.** The frontmatter is a single flat block — `.frontmatter`
(+ `__elements`) — placed **inside the level's existing body/`__inner`**, so it
already inherits that level's padding context. Reasons:

- **No new depth.** The inner/outer pattern exists so Adapt can separate
  full-bleed (outer) from padded content (inner) at each *structural* level.
  Frontmatter is not a structural level — it is content within one — so adding a
  wrapper pair would invent depth that means nothing.
- **Spacing is a CSS job, not a DOM job.** Any padding/offset the frontmatter
  needs is a margin/padding on `.frontmatter` (or a `--role` tweak). We do
  not need extra elements to get spacing — CSS on the one block does it, and
  tokens keep it fluid.
- **Keeps the block reusable.** One flat block renders identically at every
  level; wrapper nesting would have to vary per level and break that.

So: **outer/inner belongs to Adapt's structural levels; frontmatter stays a flat
BEM block and leans on CSS for any spacing.** If a future case truly needs a
bleed/pad split inside frontmatter, add it with CSS (e.g. a padded `__list` or a
`--bleed` modifier), not with extra wrapper divs.

---

## 4. Invariants (do not break these)

- Presentation = BEM (`.frontmatter`, `--role`) + Adapt core classes.
  Data = `data-*` + `_grow` JSON. Never encode data in class names.
- One `.frontmatter` block everywhere; vary by `--role` + data only.
- Keep Adapt's hooks: `.article__container`, `.component__container`,
  `.js-heading`, and each level's `__inner`.
- Extend via `_fields` (and profiles), not new wrappers or numbered keys.
- Spacing/offset of non-structural things (frontmatter included) = CSS, not DOM.
