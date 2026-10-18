# grow-core-base

The **grow** stack: Adapt's contrib core stays functional, Grow adds its **own
structure** on top (custom structural objects, classes and generated HTML), and
the whole thing is styled by the layered **grow** style tier with a swappable
**base** profile.

```
MECHANICAL (structure / HTML + classes)
  adapt-contrib-core + contrib        ← kept intact & functional
  adapt-core-structure                ← Adapt's structural HTML + classes
  + grow-core-structure             ← Grow's own objects (frontmatter,
                                         two-column block, custom menu…) via
                                         template overrides + themeBlockView
  = grow-core-structure  →  THE COURSE SHAPE is emitted
──────────────── end of mechanical · start of styles ────────────────
STYLE (LESS / tokens)
  grow-core-less                      ← one @import entry
   ├ grow-base-<grouping>             ← token groupings (BASE · swappable)
   │   grow-base-color / -typography / -space
   ├ grow-theme-template              ← painting (reads only --grow-* tokens)
   └ grow-<customer>-theme-profile    ← the dials (generator output)
```

See `../../gallery/grow-stacks.html` for the diagram and
`../../docs/grow-base-architecture.md` for the full rationale.

## What's here

```
grow-core-base/
├── adapt.json              plugin manifest (contrib deps; theme is local)
├── src/course/config.json  _theme: grow-ct, _menu: adapt-contrib-boxMenu
└── grow/less/              the style tier scaffold (compiles stand-alone)
    ├── grow-core.less                    the @import entry (grow-core-less)
    ├── grow-base-color.less              \
    ├── grow-base-typography.less          }  grow-base-<grouping>  (BASE, swappable)
    ├── grow-base-space.less              /
    ├── grow-theme-template.less          the painting
    └── grow-acme-theme-profile.less      grow-<customer>-theme-profile (the dials)
```

- **grow-core-structure** (the mechanical layer) already exists as the
  structural overrides in `grow-ct/` — `templates/article.hbs`,
  `templates/block.hbs`, `js/themeBlockView.js`, `schema/`. Those emit the custom
  course shape (article frontmatter + two-column block).
- **The grow style tier** here shows the exact layering + naming your generator
  targets. Colour maths is runtime (`calc()` on lightness — `darken()` replaced),
  so a profile swap reskins chrome + content live, with dark mode.

## Assemble into a framework build

```
# 1. a framework checkout
git clone https://github.com/adaptlearning/adapt_framework && cd adapt_framework
npm install

# 2. install contrib (from this folder's adapt.json)
cp <repo>/packages/grow-core-base/adapt.json .
npx adapt install

# 3. drop in the theme (carries grow-core-structure + the grow less)
cp -r <repo>/grow-ct src/grow-ct

# 4. use this config + an example course
cp <repo>/packages/grow-core-base/src/course/config.json src/course/config.json

# 5. build
npx grunt build      # or: npx grunt dev
```

## Verified vs runtime-pending

- **Verified here:** `grow/less/grow-core.less` compiles clean with `lessc 4.2`
  (interface tokens resolve; `:hover` is a live `calc()`, not a baked colour);
  the theme itself compiles against real `adapt-contrib-core` LESS; the structural
  templates compile as Handlebars; configs are valid JSON.
- **Needs a real `grunt build` + browser to confirm:** the `themeBlockView`
  component routing (view timing) and the schema merge into the authoring tool —
  Adapt's runtime can't be executed in this environment.

## Next

With grow proven, the next build is **our core lesson structure** — the set of
Grow structural objects (the grow-core-structure layer) that the course shape
is assembled from, each dressed by `grow-theme-template` and fed by the base
tokens.
