# Spacing and typography manager

A reusable, fixed top overlay with a centred live pixel readout, shared notification
history, and cards for:

- **Spacing:** viewport bounds; independent text, space, layout and icon ranges;
  compact/default/roomy profiles; type scale and spacing density; a seven-step
  fluid text specimen.
- **Fonts:** heading/body Google Font pairing, body size multiplier, leading and
  reading width. Loading failures are reported; local fallbacks stay usable.
- **Typography:** a downstream reading-context panel, opening the font and
  heading-scheme cards.
- **Heading schemes:** six independent CAPS choices, suggested defaults,
  colour/harmony formulas, line styles and thickness, symbol/academic bullets,
  academic icon sizing, graded/uniform/modular sizes, scale and colour reversal.
- **Colour:** main hue/saturation feeding the specimen and heading formulas;
  this does not replace the developing colour manager or edit its harmony palette.

Controls remain a stable size while the specimen changes. **Apply to page** is
opt-in. Switching it off removes the manager's page styles; pre-existing page
styles and controls remain intact. Page effects use the GROW `--fs-*`,
`--space-*`, `--pad-*`, font and heading contracts plus the Abbott `--ab-*`
tokens. Pages using hard-coded dimensions need to adopt these tokens.

The top rail uses the same Material Symbols icon family, translucent surface
and rounded controls as the developing colour manager. Buttons keep accessible
names and title tooltips. Cards fade in/out over 200ms; Escape, Close and clicking
outside dismiss them. Notifications use the existing shared bar stylesheet,
matched rail height, ten-second timeout and history arrows. Hidden notifications
reserve space so messages do not shift the cards. System reduced motion and the
page's `.no-motion` / `data-tm-no-motion` preference disable fades.
Body size, line height and reading width share a level, equal-width slider row.
The rail runs flat across the top edge. Settings flow horizontally above the
specimen, which has the full panel width rather than sharing a narrow side column.

## Preview

Open [index.html](./index.html) directly, or serve the repository over HTTP:

```powershell
python -m http.server 8937 --bind 127.0.0.1
```

Then visit `http://127.0.0.1:8937/tools/spacing-manager/`.
The generated classic bundle also supports the existing `file:` gallery pages.
Google Fonts still requires a network connection.

The overlay is also mounted on:

- [Studio source page](../../.dev/assets/ab-them/public/site/source_index.html)
- [Abbott gallery preview](../../.dev/assets/assets-grow/TOSORT/gallery/preview.html)

The source page keeps its original inline controls. The overlay has separate
preview settings; its page override wins only while Apply to page is enabled.
Studio JSON saves include `spacingManager` so preview preferences survive theme
reloads. Applied spacing, typography and font pairing are also included in the
studio scheme's usual fields and CSS export. The overlay's own exports are
standalone JSON settings and root-scoped CSS.

## Mount on another page

With an HTTP server, import the ES module and stylesheet:

```html
<link rel="stylesheet" href="./tools/spacing-manager/spacing-manager.css">
<main id="preview"><!-- Your content --></main>
<div id="manager"></div>
<script type="module">
  import { mountSpacingManager } from './tools/spacing-manager/spacing-manager.js';
  const manager = mountSpacingManager(document.getElementById('manager'), {
    target: document.getElementById('preview'),
    storageKey: 'my-page-spacing',
    onChange(settings) { console.log(settings); },
  });
  manager.open('typography');
  // manager.get(), manager.load(settings), manager.css(), manager.destroy()
</script>
```

Mount outside the target so downstream typography cannot resize the controls.
Pass `storageKey: null` to disable browser storage. Each instance has unique IDs,
scoped CSS, notifications and cleanup. `notificationService` accepts the same
service contract as the colour manager; by default it uses the shared service in
`../notifications/`. Changes also dispatch `spacing-manager:change` on the host.
The shared service is registered once per browser realm, so the classic preview
bundle and native-module tools can deliver to the same notification bars.

For no-build/file previews, give the content wrapper
`data-spacing-manager-target` and include `spacing-manager.bundle.js` with
`defer`. It locates that wrapper (or `main.wrap` / `.page`), loads its stylesheet,
and exposes `window.ABSpacingManager`. Storage is namespaced by page path.

## Shared formulas and generated preview

`manager-engine.js` reuses the existing spacing, typography, connector and fluid
core modules under `.dev/assets/ab-them/public/site/`; these are dependencies,
not copied formulas. Keep them available when moving the ES modules. The classic
bundle embeds those same modules for portable previews.

After changing source modules, regenerate and syntax-check the bundle:

```powershell
node .\tools\spacing-manager\build-preview.cjs
node --check .\tools\spacing-manager\spacing-manager.bundle.js
```

`build-preview.cjs` is a small packer for these local modules' named imports and
exports, not a general JavaScript bundler. No package installation is required.

The icon panel's symbol controls now follow its preview; the SVG controls,
including the size slider, are at the bottom of the icon section. Its search is
explicitly preview-only (24 names); full-catalogue search is not implemented.
