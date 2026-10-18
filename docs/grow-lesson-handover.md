# grow-base lesson structure — handover

Status for the next thread. The **basics are built and compile**; the next thread
builds the full **course lesson templates + JSON data structures/schemas** on top
of this foundation.

## The one idea: frontmatter is a universal data layer

`_grow._frontmatter` attaches at **every** structural level — page, article,
block, component — as the *same* object. It is a **metadata layer first**:

- `stampMeta()` (`js/growMeta.js`) stamps every field onto the object's element
  as `data-fm-<key>="value"` **always**, whether or not it is shown. So
  non-presentational metadata lives in the DOM as data, not markup.
- `_display` decides whether it **also renders** as visible HTML (via the shared
  `templates/partials/_grow-frontmatter.hbs`). `_display:false` = metadata-only.
- `_fields[]` is the **extensible** metadata list; each field has its own
  `_display`. Add fields without touching templates.

This is the data→presentation seam: the data layer (frontmatter/metadata) informs
the presentation layer (the partial + the object templates), and either side can
change independently.

## What's built (verified: templates compile, theme LESS compiles vs real core, JSON valid)

Under `grow-ct/`:

| File | Role |
|---|---|
| `js/growMeta.js` | `stampMeta()` — universal `data-fm-*` stamp |
| `templates/partials/_grow-frontmatter.hbs` | visible frontmatter renderer (fields + body + eyebrow) |
| `templates/page.hbs` | **lesson** object — hero = page frontmatter + objectives; keeps `.article__container` |
| `templates/article.hbs` | article + frontmatter (uses the partial) |
| `templates/block.hbs` | columns + frontmatter + `_kind` class (`summary`/`callout`); keeps `.component__container` |
| `js/themePageView / themeArticleView / themeBlockView / themeComponentView` | call `stampMeta` at every level; block view also routes components into columns |
| `less/grow-lesson.less` | hero, frontmatter, objectives, summary/callout styling (token-driven) |
| `less/grow-structure.less` | columns + article frontmatter styling |
| `schema/grow-structure.schema.json` | the universal `$frontmatter` shape + `_columns` + `_kind`, applied per level |
| `examples/lesson.example.json` | a full lesson authored with all four objects |

The four objects: **lesson hero** (page), **article + frontmatter**, **column /
content blocks** (+ `summary`/`callout` kinds), **summary / checkpoint** (block
kind `summary`).

## Invariants the next thread must keep

- Preserve Adapt's core hooks in any template override: `.page__inner` /
  `.article__container`, `.article__inner` / `.block__container`, `.block__inner`
  / `.component__container`, and `.js-heading`. Core views bind to these.
- Presentation reads only `--grow-*` / theme tokens (no raw colours), per the grow
  model in `grow-base-architecture.md`.
- Frontmatter is data-first: default to stamping metadata; render only on
  `_display`.

## Runtime-pending (needs a real `grunt build` + browser)

The template overrides, `themeBlockView` column routing, `stampMeta`, and the
schema merge are shipped as correct files but have **not** been run in Adapt's
runtime here (no framework runtime in this environment). First task for a build
environment: `grunt build` the `packages/grow-core-base` assembly and confirm
the lesson renders + the `data-fm-*` attributes appear.

## Next thread — scope

Build the **course lesson templates + JSON data structures/schemas** that
complement this data layer: the authored course/lesson shapes
(contentObjects/articles/blocks/components JSON), the object-type templates that
reference/compose each other, and the schemas that drive the authoring tool —
with frontmatter/metadata as the connective data layer informing presentation.
