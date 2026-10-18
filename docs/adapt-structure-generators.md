# Adapt — where the HTML & class names actually come from

Verified against live source: **adapt-contrib-core v6.85.1**, **adapt-contrib-vanilla**,
**adapt-contrib-text v6.3.0**, **adapt-contrib-boxMenu**. Links point at each repo's
`master`.

---

## The one thing to understand first

> **JSON schemas do NOT generate HTML or class names.** They only describe the
> *authorable data* (and are what validates `_classes`). The markup is produced by
> **Views + Templates**:

```
 JSON model  ──►  View.className()   ──►  OUTER element + id + _classes + state classes
 (data)            (Backbone view)         e.g.  <div class="block b-10 is-complete …">
                                                    │
                    Template (.hbs/.jsx)  ──►  INNER structure inside it
                                                    e.g.  .block__inner, .block__header …
```

- **Outer wrapper class string** = the view's `className()` return value.
- **Inner DOM + its classes** = the template file.
- A **component** and a **menu** get their `.component__inner` / `.menu__inner` from the
  **plugin's own template**, not from core — and they carry a *second* plugin-specific
  class (the "dual-BEM" hook) you can theme against.

---

## Table — the generators (what emits markup + classes)

| Page-structure level | Generator type | File (repo · path) | Emits (key classes) |
|---|---|---|---|
| **Base (all items)** | View (base class) | [adapt-contrib-core · `js/views/adaptView.js`](https://github.com/adaptlearning/adapt-contrib-core/blob/master/js/views/adaptView.js) | `data-adapt-id`, `id`, `role="presentation"`; shared class/visibility/`is-complete` logic |
| **Content Object (base)** | View | [core · `js/views/contentObjectView.js`](https://github.com/adaptlearning/adapt-contrib-core/blob/master/js/views/contentObjectView.js) | outer: `{type} contentobject {_id} {_classes} …` |
| **Page** | View | [core · `js/views/pageView.js`](https://github.com/adaptlearning/adapt-contrib-core/blob/master/js/views/pageView.js) | outer: `page contentobject …` |
| **Page** | Template | [core · `templates/page.hbs`](https://github.com/adaptlearning/adapt-contrib-core/blob/master/templates/page.hbs) | `.page__inner`, `.page__header(-inner)`, `.page__title(-inner)`, `.page__body`, `.page__instruction`, `.article__container` |
| **Menu** | View | [core · `js/views/menuView.js`](https://github.com/adaptlearning/adapt-contrib-core/blob/master/js/views/menuView.js) | outer: `menu contentobject …` |
| **Menu** | Template (plugin!) | [adapt-contrib-boxMenu · `templates/boxMenu.jsx`](https://github.com/adaptlearning/adapt-contrib-boxMenu/blob/master/templates/boxMenu.jsx) | `.menu__inner boxmenu__inner`, `.menu__header…`, `.menu__item-container` |
| **Article** | View | [core · `js/views/articleView.js`](https://github.com/adaptlearning/adapt-contrib-core/blob/master/js/views/articleView.js) | outer: `article {_id} {_classes} …` |
| **Article** | Template | [core · `templates/article.hbs`](https://github.com/adaptlearning/adapt-contrib-core/blob/master/templates/article.hbs) | `.article__inner`, `.article__header(-inner)`, `.article__title`, `.article__body`, `.article__instruction`, `.block__container` |
| **Block** | View | [core · `js/views/blockView.js`](https://github.com/adaptlearning/adapt-contrib-core/blob/master/js/views/blockView.js) | outer: `block {_id} {_classes} …` |
| **Block** | Template | [core · `templates/block.hbs`](https://github.com/adaptlearning/adapt-contrib-core/blob/master/templates/block.hbs) | `.block__inner`, `.block__header(-inner)`, `.block__title`, `.block__body`, `.block__instruction`, `.component__container` |
| **Component (wrapper)** | View | [core · `js/views/componentView.js`](https://github.com/adaptlearning/adapt-contrib-core/blob/master/js/views/componentView.js) | outer: `component {_component} {_id} {_classes} is-{_layout} …` |
| **Question component** | View | [core · `js/views/questionView.js`](https://github.com/adaptlearning/adapt-contrib-core/blob/master/js/views/questionView.js) | adds `is-question can-show-correctness can-show-feedback …` |
| **Component (header)** | Template (partial) | [core · `templates/partials/component.hbs`](https://github.com/adaptlearning/adapt-contrib-core/blob/master/templates/partials/component.hbs) | `.component__header {comp}__header`, `.component__title`, `.component__body`, `.component__instruction` |
| **Component (inner/body)** | Template (plugin!) | [adapt-contrib-text · `templates/text.jsx`](https://github.com/adaptlearning/adapt-contrib-text/blob/master/templates/text.jsx) | `.component__inner text__inner` + the component's own widget markup |
| **Shared header** | Template (JSX) | [core · `templates/header.jsx`](https://github.com/adaptlearning/adapt-contrib-core/blob/master/templates/header.jsx) | reusable title/body/instruction block used by JSX components |

Other core templates you may theme: `nav.hbs`, `drawer.hbs`, `notify*.hbs`, `buttons.hbs`,
`loading.hbs`, `tooltip.jsx`, `image.jsx` — all in
[core · `templates/`](https://github.com/adaptlearning/adapt-contrib-core/tree/master/templates).

---

## Exact outer class strings (copied from source)

```js
// articleView.js / blockView.js — identical shape
'article'  _id  _classes  visibility  hidden  is-complete?  is-optional?
'block'    _id  _classes  visibility  hidden  is-complete?  is-optional?

// componentView.js
'component'  {_component lower}  _id  _classes  visibility  hidden  is-{_layout}  is-complete?  is-optional?

// questionView.js (extends component)
'component'  'is-question'  {_component}  _id  _classes  visibility  is-{_layout}
  is-complete?  is-optional?  can-show-correctness?  can-show-model-answer?
  can-show-feedback?  can-show-marking?

// contentObjectView.js (page / menu)
{type}  'contentobject'  {static className}  _id  _classes  visibility  is-complete?  is-optional?
```

Plus on every item (from `adaptView.attributes()`): `id="{_id}"`,
`data-adapt-id="{_id}"`, `role="presentation"`.

**Takeaways for theming:**
- `_classes` lands on the **outer** element at every level → your opt-in modifier hook.
- `is-{_layout}` (`is-left` / `is-right` / `is-full`) on components → style two-up layouts.
- Components carry a **type class** (`text-component`? no — it's the raw `_component`
  lowercased, e.g. `text`, `narrative`, `mcq`) AND the partial adds `{comp}__header`.
- Menus & components expose **dual-BEM** classes (`menu__inner boxmenu__inner`,
  `component__inner text__inner`) — theme the generic one for everything, the plugin one
  for per-component tweaks.

---

## The JSON schemas (what they really are)

Each plugin ships schemas that define authorable fields + validation — **not** markup:

| File | Role | Example link |
|---|---|---|
| `schema/*.schema.json` | Modern (v5.5+) JSON Schema for the Authoring Tool & build validation | [text · `schema/`](https://github.com/adaptlearning/adapt-contrib-text/tree/master/schema) |
| `properties.schema` | Legacy per-plugin schema (older AT) | [core · search repos](https://github.com/adaptlearning/adapt-contrib-core) |
| `example.json` | Documents every authorable property | [vanilla · `example.json`](https://github.com/adaptlearning/adapt-contrib-vanilla/blob/master/example.json) |
| `bower.json` | Plugin manifest (type, targets, framework range) | [text · `bower.json`](https://github.com/adaptlearning/adapt-contrib-text/blob/master/bower.json) |

`_classes` is defined in the core content schemas as a plain string. **To validate your
own class vocabulary**, tighten it with an `enum`/`pattern` in a schema override, so a
typo fails the build instead of silently doing nothing.

---

## The vanilla theme — what you override

`adapt-contrib-vanilla/less/` (compiled + concatenated by grunt):

| Folder | Holds |
|---|---|
| `less/_defaults/` | **The variables you override** — [`_colors.less`](https://github.com/adaptlearning/adapt-contrib-vanilla/blob/master/less/_defaults/_colors.less), [`_font-config.less`](https://github.com/adaptlearning/adapt-contrib-vanilla/blob/master/less/_defaults/_font-config.less), [`_spacing-config.less`](https://github.com/adaptlearning/adapt-contrib-vanilla/blob/master/less/_defaults/_spacing-config.less), [`_spacing-containers.less`](https://github.com/adaptlearning/adapt-contrib-vanilla/blob/master/less/_defaults/_spacing-containers.less), mixins, animations |
| `less/core/` | Per-element rules: `article.less`, `block.less`, `component.less`, `page.less`, `nav.less`, `button.less`, `drawer.less`, … |
| `less/project/` | Theme-level rules: `theme-common.less`, `theme-blocks.less`, `theme-components.less`, `theme-contentObjects.less`, `columns.less` |

Real defaults worth knowing (from `_spacing-containers.less`):
`@block-padding-ver: 4rem`, `@component-padding-ver: 1rem`, `@article-header-padding-hoz: 1rem`.
Vanilla is **mostly LESS variables**, with only a few CSS custom properties today
(`--adapt-navigation-height`, some drawer/notify values).

---

## Suggestions: building modern themes on this

1. **Bridge LESS → CSS custom properties.** Vanilla resolves LESS at build (static). Define
   your tokens as real custom properties on `:root` and have LESS reference them:
   ```less
   :root { --surface:#fff; --text:#1a1d21; --space-block:4rem; }
   @surface: ~"var(--surface)";          // LESS var points at the live custom prop
   .block__inner { padding-block: @surface; }
   ```
   Now you get **runtime** light/dark + per-course brand swaps with no rebuild — the
   single biggest modernisation.

2. **Dark mode via `prefers-color-scheme`** by re-declaring the custom properties, plus a
   `.theme-dark` class override for a manual toggle. Switch depth strategy: shadow (light)
   → border + surface-lightness (dark).

3. **Container queries instead of the global `.size-*` classes.** Adapt's responsiveness is
   viewport-based; modern per-component layout wants `@container`. Put
   `container-type: inline-size` on `.block__inner` and query the component — a two-up block
   reflows on *its own* width, not the screen's.

4. **Fluid type & space with `clamp()`** (no breakpoints) — pairs with your fluid baseline.

5. **Logical properties** (`padding-inline`, `margin-block`, `inset-*`). Adapt supports RTL
   and the language picker; logical props make your theme mirror correctly for free.

6. **Theme via the dual-BEM hooks, not plugin forks.** Style `.component__inner` for the
   system; use `.text__inner`, `.narrative__inner`, `.mcq__inner` for per-component depth —
   no plugin code touched, update-safe.

7. **State-driven depth with modern selectors.** Use the real state classes
   (`.is-complete`, `.is-active`, `.is-correct`, `.can-show-feedback`) and `:has()` to raise
   or re-tint components as the learner progresses.

8. **`_classes` as a validated design-token vocabulary.** Define `is-raised`, `is-flush`,
   `bg-tint`, `stretch`; document them; lock them with a schema `pattern`/`enum` so authors
   can't mistype.

9. **Ship it as a theme plugin** (`adapt-theme-yourname`, set `_theme` in `config.json`) so
   it's reusable across courses and survives vanilla updates. Keep overrides in
   `less/project/` + a `zzz-` file so they win without `!important`.

10. **Respect `prefers-reduced-motion`** around every transition/animation — Adapt courses
    are often accessibility-graded (WCAG), so this is table stakes.
