# Animation manager

A reusable, fixed top overlay — a sibling of the spacing manager — for the
hand-drawn "note taking" marks. Every mark from
[`.dev/assets/gallery/marks.html`](../../.dev/assets/gallery/marks.html) is
extracted into a single, self-contained, **re-colourable** and **re-animatable**
unit. From the bar you pick a mark, set its **speed, size, rotation and semantic
colour**, see it live, copy its code — or **inject it straight into the page**,
by hand or (for agents) by keyword.

58 marks across six families:

- **Emphasis** — underline, double, wavy, circle, box, brackets, strike, scribble.
- **Highlighter** — one CSS sweep with band height / position / length controls.
- **Standalone** — tick, cross, star, caret, big tick.
- **Shapes & lines** — arrows (right/left/up/down, curved, double, return,
  zigzag, hook, bold, thin, dotted, sweep), circle, dot, target, square, rounded,
  checked box, exclamation / circled, question / circled, dotted & dashed rules.
- **Ovals & rectangles** — oval round a phrase, long oval, double-ring, lean-left,
  triple, rectangle, stacked, boxes→bar, stretch bar, circles row, horizontal rules.
- **Handwritten notes** — handwriting, soft note, margin note, teacher mark,
  correction, sticky note, checklist item.

## Semantic colour

Marks draw in `currentColor`; the element's colour is a **theme role**, never a
hard-coded hue:

| Role | Token (with fallback) |
| --- | --- |
| `accent` | `var(--accent)` |
| `positive` | `var(--c-positive)` |
| `negative` | `var(--c-negative)` |
| `neutral` | `var(--c-neutral)` |
| `comment` | `var(--c-comment)` |
| `pen` | `var(--pen)` |
| `ink` | `var(--ink)` |

Each mark resolves `--am-c-<role>` from the page's GROW / Abbott theme tokens,
with self-contained fallbacks so a mark still looks right on an un-themed page.
Change the page hue or any `--c-*` and every mark re-tints — including in dark
mode. Highlighters carry the colour on `--c` instead, so their text stays ink.

## Repeated drawing and random tilt

Use **Draw passes** (1–10, default 3) to replay the mark a finite number of times.
**Random rotation ±** (0–10°, default 3°) adds a small tilt on each later pass,
relative to the base Rotation setting, never cumulatively. Use 0° for no variation
or one pass for the original single draw. Each complete pass preserves the
mark's staggered strokes and briefly holds the completed drawing.

Preview replay generates a fresh set of random tilts. Each inserted mark or
export gets its own generated set; the exported CSS plays that fixed sequence
without JavaScript and leaves the last pass visible. This redraws the mark;
it does not accumulate additional ink strokes. Static and reduced-motion modes
do not repeat or randomly rotate.

Speed, size and rotation are inline custom properties (`--am-rate`, `--am-scale`,
`--am-rot`), so one mark is tuned without affecting any other.

## Preview

Open [index.html](./index.html) directly (it uses the generated `file:` bundle),
or serve the repository over HTTP:

```powershell
python -m http.server 8941 --bind 127.0.0.1
```

Then visit `http://127.0.0.1:8941/tools/animation-manager/`.

## Mount on another page

With an HTTP server, import the ES module and stylesheet:

```html
<link rel="stylesheet" href="./tools/animation-manager/animation-manager.css">
<main id="page"><!-- Your content --></main>
<div id="manager"></div>
<script type="module">
  import { mountAnimationManager } from './tools/animation-manager/animation-manager.js';
  const manager = mountAnimationManager(document.getElementById('manager'), {
    target: document.getElementById('page'),
    storageKey: 'my-page-animations',
    onChange(settings) { console.log(settings); },
  });
  manager.open('gallery');
</script>
```

Mount the overlay **outside** the page target. Pass `storageKey: null` to disable
browser storage. The base stylesheet, the `#am-ink` filter and the handwriting
fonts are injected into the page on mount and removed on `destroy()`. Each
instance has unique ids, its own notifications and cleanup. Changes also
dispatch `animation-manager:change` on the host. It reuses the shared GROW
notification service in [`../notifications/`](../notifications/).

For no-build / `file:` previews, give the content wrapper
`data-animation-manager-target` and include `animation-manager.bundle.js` with
`defer`. It locates that wrapper (or `main` / `.page` / `.wrap`), loads its
stylesheet, and exposes `window.ABAnimationManager`.

## Insert into the page

- **Wrap selection** — select text on the page, pick a word mark (underline,
  highlight, strike, oval…) and it wraps the selection in place.
- **Insert at caret** — place a standalone mark (tick, arrow, star…) at the caret
  or after the current selection.
- **Undo / Clear** — every inserted mark is tracked; undo restores the original
  text (for wraps) or removes the glyph.

The deck stays open while you select page text for injection. "Draw-on
animation" toggles whether inserted marks animate on or appear already drawn.

## Drive it from code / agents

The mounted manager is the public API (also on `window.ABAnimationManager` via
the bundle):

```js
ABAnimationManager.select('underline');          // choose a mark
ABAnimationManager.set({ color: 'accent', speed: 1.4, scale: 1.1 });
ABAnimationManager.set({ repeats: 5, jitter: 2 }); // five draws, up to ±2° tilt
ABAnimationManager.wrapKeyword('horizon', {       // mark every "horizon"
  id: 'underline', color: 'accent', all: true, root: '#article',
});
ABAnimationManager.wrapSelection();               // wrap the current selection
ABAnimationManager.insertHere({ id: 'tick' });    // drop a tick at the caret
ABAnimationManager.element('star', { color: 'neutral', scale: 2 }); // detached node
ABAnimationManager.snippet();                     // self-contained HTML string
ABAnimationManager.undo();  ABAnimationManager.clearInjected();
```

For word marks (`needsText`), `wrapKeyword` wraps each occurrence; for glyphs it
drops the mark after each occurrence and keeps the text.

[`animations.json`](./animations.json) is the keyword manifest agents resolve
against — `id`, `name`, `category`, `kind`, `defaultColor`, `needsText`,
`animation` and `keywords` for every mark, plus the colour roles. Regenerate it
with:

```powershell
node -e "import('./animation-catalog.js').then(m=>require('fs').writeFileSync('animations.json',JSON.stringify(m.manifest(),null,2)+'\n'))"
```

## Exports

- **Copy mark HTML** / `snippet()` wrapper — the element markup with the current
  inline params (clipboard, falling back to a download).
- **Export JSON** — the manager settings.
- **Export CSS** — a self-contained snippet: the ink filter, the full base
  stylesheet and the configured mark, ready to paste onto any page.

## Source layout

| File | Role |
| --- | --- |
| `animation-catalog.js` | Pure data: every mark, its SVG/markup, keywords, default colour. `matchKeyword`, `manifest`. |
| `animation-manager-engine.js` | Pure engine: `baseCss`, `instanceMarkup`, `exportSnippet`, `validateSettings`, the ink filter and fonts. No DOM. |
| `animation-manager.js` | `mountAnimationManager` — the overlay UI, live injection and public API. |
| `animation-manager.css` | Overlay chrome (rail, deck, gallery, preview). |
| `auto-mount.js` | `file:` / no-build entry; exposes `window.ABAnimationManager`. |
| `build-preview.cjs` | Small packer → `animation-manager.bundle.js` for `file:` pages. |
| `animations.json` | Generated keyword manifest for agents. |
| `index.html` | Themed workshop / demo page. |

After editing any source module, regenerate and syntax-check the bundle:

```powershell
node .\tools\animation-manager\build-preview.cjs
node --check .\tools\animation-manager\animation-manager.bundle.js
```

`build-preview.cjs` is a small packer for these local modules' named
imports/exports, not a general bundler. No package installation is required.
Reduced motion is honoured: the system setting and the page's `.no-motion` /
`data-tm-no-motion` preference disable both the deck fade and the mark
animations.
