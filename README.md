# grow-ct

The **Abbott kit** — a fluid, token-driven theme for the
[Adapt framework](https://github.com/adaptlearning/adapt_framework), plus a gallery
of hand-drawn ("ink") animation and interaction patterns for e-learning: marks,
flow diagrams, cycles, timelines, reveals, process diagrams and more.

One hue drives colour across the whole system; two dials (type scale, space
density) drive typography and spacing; every animation runs off one `--flow-rate`
speed variable and respects `prefers-reduced-motion`.

## Layout

```
grow-ct/
├── index.html        front door — links every gallery page
├── theme/
│   ├── adapt-abbott/      layer-on-vanilla theme (tokens + decoration; MIT)
│   └── grow-ct/ standalone theme that REPLACES vanilla, styling the
│                          whole shell from the Abbott tokens (vanilla fork; GPL-3.0)
├── gallery/          standalone, self-contained demo pages (open any in a browser)
├── docs/             reference guides
└── foundation/       the raw token/foundation sources (CSS + LESS)
```

## Gallery

Each page is self-contained (inline CSS/JS, fonts from Google Fonts). Open
`index.html` for the browsable version.

| Page | What it shows |
|------|---------------|
| `gallery/preview.html` | The Abbott theme on sample lesson markup, with live hue / type / space / theme / motion knobs |
| `gallery/templates.html` | Six lesson-page layouts on one theme, with a "show structure" toggle for the Adapt tree |
| `gallery/lesson-kit.html` | Starter page structure, scribble assets, animated cycle & timeline |
| `gallery/flows.html` | Flow-diagram family: circle / triangle / square / vertical / horizontal, with a travelling runner |
| `gallery/ink.html` | Ink marks (tick, cross, scribble, circled exclamation) and a reversible hierarchy |
| `gallery/marks.html` | Full mark library: underline/oval/box/strike/highlighters, arrows, shapes, dotted lines, punctuation, handwriting |
| `gallery/connectors.html` | Hand-drawn code-structure connectors (tree / indent guides) + scribble-over-a-box |
| `gallery/reveals.html` | Sticky notes peeling away, teacher marking, deal-in & stagger reveals |
| `gallery/process.html` | Process & flow: flowchart with a decision, fork/join, loop+counter, pipeline, worked-example |
| `gallery/patterns-1.html` | Patterns Vol 1 — step process, flip card, peek, progress ring, count-up, bars, hotspots, step-through, branch |
| `gallery/patterns-2.html` | Patterns Vol 2 — tabs, slide sequence, before/after, MCQ, match, sort, scale, Venn, spotlight |
| `gallery/patterns-3.html` | Patterns Vol 3 — reorder, memory, cloze, glossary, gauge, success tick, accordion, stars, wizard |
| `gallery/backgrounds.html` | Ambient animated backgrounds — gradient drift, aurora, blobs, dots, grid, stripes, bokeh, waves, spotlight, mesh |
| `gallery/washes.html` | Subtle transparent-to-colour gradient washes and fine textures (grain, paper, crosshatch, micro-grid…), with an intensity dial |
| `gallery/heroes.html` | Ready-made hero/section headers layering an animated background + a wash + legible content (six variants incl. a dark one) |
| `gallery/notetaking.html` | Note-taking SVG animations — pen writing a line, page fills, checkbox tick, highlight, bullets, margin note, sticky note, page turn, typed text |
| `gallery/grow-lesson.html` | A full core lesson from the four GROW structural objects — lesson hero + objectives, article frontmatter, summary/checkpoint block, two columns — with a "reveal metadata" toggle surfacing the universal `data-fm-*` frontmatter layer (incl. metadata-only fields) |
| `gallery/grow-stacks.html` | The two GROW build stacks (`adapt-core-base` / `grow-core-base`) drawn as layered `grow` interfaces — the mechanical structure tier then the style/token tier with a swappable base profile |
| `gallery/grow-structure.html` | A render of the `grow-ct` template overrides — an article with an extra frontmatter section, and a two-column block where each column has its own title/description/frontmatter + a component (two different component types) |
| `gallery/bullets.html` | Lots of simple draw-on bullet / marker shapes — dots, rings, squares, diamonds, triangles, stars, arrows, chevrons, ticks, signs, numbered badges, pins, bookmarks, tags, radio/checkbox/toggle states, cursor — plus an animating list |

## Theme plugins — two flavours

There are two Adapt theme plugins under `theme/`. Both build with `grunt build`.

**`theme/adapt-abbott/`** (MIT) — a **layer-on-vanilla** theme: the Abbott token
foundation + content decoration (ink marks, backgrounds, washes, heroes, bullets)
on top of vanilla's shell. Keep vanilla as the base; set `{ "_theme": "adapt-abbott" }`.
See `theme/adapt-abbott/README.md` and `examples/lesson-starter.html`.

**`grow-ct/`** (GPL-3.0) — a **standalone** theme that **replaces
vanilla** and styles the entire page shell (menu, nav, drawer, buttons, notify)
from the Abbott tokens. It's a fork of adapt-contrib-vanilla with its colour
engine re-driven by the `@abbott-*` / `--ab-*` system; it carries the same
content kit. Set `{ "_theme": "grow-ct" }` and drop vanilla. See
`grow-ct/README.md` for the token architecture, the dials, and
the compile-time-chrome vs live-content colour tradeoff.

```
cp -r theme/<chosen-theme>  <framework>/src/theme/<chosen-theme>
# then set "_theme" in src/course/config.json
```

## Foundation & docs

- `foundation/` — `ab-foundation.css` (the full colour + fluid type + fluid space
  token contract), and `zzz-fluid-baseline.less` / `zzz-overrides.less` (drop-in
  LESS layers for vanilla).
- `docs/adapt-structure-generators.md` — where Adapt's HTML & class names come from
  (views + templates), with a generator table.
- `docs/adapt-theming-guide.md` — content structure, core classes, and the override
  system.

## Notes

The theme plugin now carries the token foundation (`00-foundation.less`) and the
most reusable animation systems as `less/` layers: ink marks (`50-marks`),
bullets/markers (`55-bullets`), ambient backgrounds (`60-backgrounds`), washes &
textures (`65-washes`) and hero headers (`70-heroes`), all triggered through
Adapt's onscreen hook (`_onScreen._classes: "ab-ink-play"`) and the shared `#ink`
filter injected by `theme.js`. See `theme/adapt-abbott/README.md`.

The more demo-specific compositions (connectors, reveals, process/flow diagrams,
interaction patterns, notetaking) still live in their gallery pages as reference,
since they lean on per-page JS scaffolding. adapt-abbott is a token + decoration
theme designed to ride on `adapt-contrib-vanilla`'s base shell — it does not
restyle Adapt's nav/drawer/buttons. The plugin README explains both install paths.

## License

MIT — see `LICENSE`.
