# Grow data → presentation map (and how BEM fits)

How the **data model** (levels, roles, depth, data-types, metadata) maps onto the
**presentation model** (Adapt's class contract + Grow's BEM). Read with
`grow-base-architecture.md` (the style/token tiers) and
`grow-lesson-handover.md` (the frontmatter layer).

---

## 1. The two layers — keep them apart

- **Data layer** = what a thing *is* and *carries*: its level, role, data-type and
  its metadata fields. It lives in **JSON** (authored) and in the DOM as
  **`data-*` attributes** (stamped by `growMeta.js`). It is NOT class names.
- **Presentation layer** = how it *looks*: **BEM** classes (`.frontmatter`,
  `__item`, `--role`) + Adapt's core element classes (`.article__title` …).

BEM has no "data layer" — that's the thing to internalise. You connect the two by
letting the **data** (role, data-type, which fields) decide which BEM
block/modifier/elements render. One presentation vocabulary, data-driven.

> Answer to "is `_lesson__duration` how BEM works with data layers?" — No. `lesson`
> is a role → a **modifier** (`--lesson`), `duration` is **data** → `data-fm-duration`
> + an optional item modifier (`__item--duration`). Leading `_` is the Adapt JSON
> convention for data keys; it never belongs in a CSS class. Numbered keys
> (`outcome__01`) are an index → use an **array** (`_outcomes: []`).

---

## 2. The level map

| Adapt level | Grow role | Depth | Heading | data-type (examples) |
|---|---|---|---|---|
| contentObject (page) | `lesson` | `d1` | `h1` | `lesson` |
| article | `phase` | `d2` | `h2` | `lesson-phase` (overview / content / summary) |
| block | `section` | `d3` | `h3` | the *learning type*: `learning-outcomes`, `learning-administration`, `concept-introduction`, `concept-context`, `lesson-signpost`, `lesson-activity` … |
| component | `learning-step` | `d4` | `h4` | the interactive step — "where the bells & whistles happen" |
| component item | `item` | `d4`+ | — | a step's internal piece (option, benchmark, list row) |

Stamped on every object element by `growMeta.js`:
`data-grow-role`, `data-grow-depth`, `data-grow-type`, and one
`data-fm-<key>` per metadata field. `_role` / `_type` in JSON override the
level defaults.

> Heading levels follow Adapt's a11y heading system (`_ariaLevels`): the lesson
> title is the page's `displayTitle` → the `h1`. You do not need a separate
> `_lesson__title` field for the h1.

---

## 3. The ONE frontmatter block (BEM), reused everywhere

Same block + elements at every level; only the `--role` modifier (and the data)
changes. Rendered by `templates/partials/_grow-frontmatter.hbs`, styled in
`less/grow-lesson.less`.

```
.frontmatter                     block
.frontmatter--lesson             modifier (page)      \
.frontmatter--phase              modifier (article)    } pick ONE per instance
.frontmatter--section            modifier (block)     /
.frontmatter--learning-step      modifier (component)
  .frontmatter__eyebrow
  .frontmatter__list
    .frontmatter__item  .frontmatter__item--duration   data-fm-key="duration"
      .frontmatter__label  ·  .frontmatter__value
  .frontmatter__group--outcomes / --objectives
    .frontmatter__group-title
    .frontmatter__items > .frontmatter__item--outcome / --objective
  .frontmatter__body
```

Placement: the frontmatter renders **in the body region** of its level
(the lesson hero for the page; a `*__frontmatter` wrapper in the body flow
for article/block), so metadata reads as part of that level's lead content.

---

## 4. Your worked example, BEM-clean

Your draft (left) → corrected (right):

```
.article__title .lesson__title .d1   →   <div class="article__title" data-grow-depth="1"><h1>…</h1></div>
                                          (role lives on the article root: data-grow-role="lesson")
.article__body .article__frontmatter__lesson .d2
  .lesson__title (label)             →   <div class="article__body">
  .lesson__duration (label)                <div class="frontmatter frontmatter--lesson">
                                             <dl class="frontmatter__list">
                                               <div class="frontmatter__item frontmatter__item--duration" data-fm-key="duration">
                                                 <dt class="frontmatter__label">Duration</dt>
                                                 <dd class="frontmatter__value">10 minutes</dd>
                                               </div>
                                             </dl>
                                           </div>
                                         </div>
```

The same markup with `--phase` / `--section` serves articles and blocks — only the
modifier + the data differ. That is the consistency you want.

---

## 5. Should frontmatter be real blocks/components? — recommendation

**No — keep frontmatter as a theme-rendered, data-driven section** (what we built):

- It is *metadata about* a level, so it belongs to that level's template, not as a
  separate sibling block. One definition, consistent everywhere, DRY.
- The `_display` toggle + `data-fm-*` stamping give the data-first behaviour you
  want (metadata always present; visible only when chosen).
- Making it real Adapt blocks/components would duplicate the concept and split the
  metadata across content items.

**Do use real Adapt components for the interactive learning-steps** — the "bells
and whistles" belong there (MCQ, slider, reflection, the learo in the overview).
So: *frontmatter = theme metadata; learning activity = components.*

---

## 6. Templates

### JSON (the data layer the generator/author writes)
```json
"_grow": {
  "_frontmatter": {
    "_isEnabled": true,
    "_display": true,                 // false = metadata-only (data-fm-* only)
    "_role": "lesson",                // optional; defaults per level
    "_type": "lesson",                // semantic data-type → data-grow-type
    "eyebrow": "Module 2 · Lesson 3",
    "_fields": [
      { "_key": "duration", "label": "Duration", "value": "10 min", "_display": true },
      { "_key": "owner",    "label": "Author",   "value": "stuart", "_display": false }
    ],
    "_outcomes":   ["Explain where colour comes from"],
    "outcomesTitle": "By the end you will be able to",
    "body": "<p>Optional rich body.</p>"
  }
}
```

### Markup (the presentation the partial emits)
```html
<div class="article__body">
  <div class="frontmatter frontmatter--section">
    <p class="frontmatter__eyebrow">Learning outcomes</p>
    <div class="frontmatter__group frontmatter__group--outcomes">
      <p class="frontmatter__group-title">By the end you will be able to</p>
      <ul class="frontmatter__items">
        <li class="frontmatter__item frontmatter__item--outcome">…</li>
      </ul>
    </div>
  </div>
</div>
```

The object root (set by the view) carries the data layer:
`<div class="block" data-grow-role="section" data-grow-depth="3" data-grow-type="learning-outcomes" data-fm="on">`.

---

## 7. Invariants

- Presentation = BEM + core classes; data = `data-*` + JSON. Never encode data in
  class names (no `_lesson__duration` classes).
- One `.frontmatter` block everywhere; vary by `--role` + data only.
- Keep Adapt's hooks (`.article__container`, `.component__container`, `.js-heading`).
- Index/sequence is data → arrays, not numbered keys.
