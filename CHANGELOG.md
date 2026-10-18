# Changelog

All notable changes to **adapt-grow** (the GROW theme layer for Adapt — ADAPT & GROW).

## v1.0.1 — Docker fixes

### Docker
- Fix `/usr/bin/env: 'bash\r'` on Windows checkouts: `.gitattributes` forces LF
  for `*.sh`, and the image build strips CRs from the entrypoint as a backstop.
- Fix "More than one theme is active": the entrypoint now adds every other
  installed theme (e.g. `adapt-contrib-vanilla` from `adapt install`) to
  `build.excludes` in the course `config.json`.
- `docker compose up` serves at http://localhost:8080.

## v1.0.0 — first release

First tagged release of the GROW layer.

### Theme — `grow-ct/`
- A full, **standalone** Adapt theme (fork of adapt-contrib-vanilla, **GPL-3.0**)
  that replaces vanilla and colours the whole page shell (menu, nav, drawer,
  buttons, notify, page/menu headers, article/block/component) from the GROW
  token engine. `targetAttribute: _grow`, `theme: "grow-base"`.
- **Token engine** in `less/_defaults/_grow-tokens.less`: one hue (`--h`) + type
  and space dials drive colour/typography/spacing; `@grow-*` compile-time colours
  feed vanilla's `darken()`/`fade()` maths, `--grow`/`--*` runtime tokens drive
  content live (hue + dark mode).
- **Shared `#ink` filter** + in-course motion switch in `js/theme.js`.

### Universal frontmatter / data layer
- `_grow._frontmatter` attaches at every level (lesson → phase → section →
  learning-step). `js/growMeta.js` stamps the data layer on every object element
  **always** — `data-grow-role`, `data-grow-level` (2-digit, `dNN`),
  `data-grow-type`, and one `data-fm-<key>` per field — whether or not it shows.
- `_display` gates whether it also **renders** as HTML; per-field `_display` too.
- One BEM block `.frontmatter` + `--role` modifiers
  (`--lesson/--phase/--section/--learning-step`); `_fields` is extensible.

### Core lesson structure
- Template overrides (`templates/page.hbs`, `article.hbs`, `block.hbs`,
  `partials/_grow-frontmatter.hbs`) producing: a lesson hero, article frontmatter,
  two-column blocks, and block kinds (`summary`/`callout`) — preserving Adapt's
  hooks (`.article__container`, `.component__container`, `.js-heading`).
- `themeBlockView.js` routes components into columns; each **phase (article)** is
  styled as its own card, scoped by the data layer (`[data-grow-role="phase"]`).

### Package — `packages/grow-core-base/`
- The `grow/` style tier scaffold: `grow-core.less` → `grow-base-*` token
  groupings → `grow-theme-template` → `grow-<customer>-theme-profile`. Colour
  maths is runtime (`calc()` on lightness; no baked `darken()`), so a profile
  swap reskins chrome + content live.

### Docs & previews
- `docs/grow-base-architecture.md`, `grow-data-presentation-map.md`,
  `grow-adapt-mapping-spec.md`, `grow-lesson-handover.md`.
- `gallery/grow-lesson.html`, `grow-structure.html`, `grow-stacks.html`.

### Verified
Templates compile (Handlebars), the theme compiles against real
`adapt-contrib-core` LESS, the package style chain compiles, JSON valid.

### Not yet run
A live Adapt `grunt build` — the `themeBlockView` component routing and the
schema merge in the authoring tool — pending a framework build environment.
