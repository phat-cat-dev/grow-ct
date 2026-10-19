# context-pack (custom element)

`<context-pack>` wraps the context-pack renderer as a self-registering custom
element. A **pack** is data (a statement + a stage that is marked up step by
step); the element renders it inline, in a full-width **modal**, or in an
**accordion**, and emits lifecycle events. It is the embeddable form of the
authoring sandbox in [`tools/context-packs`](../../../tools/context-packs/) —
the engine here mirrors that tool.

## Use it

```html
<link rel="stylesheet" href="./context-pack.css">

<context-pack src="packs/marking-feedback.json"></context-pack>

<script src="./context-pack.js"></script>
```

The host page supplies the theme tokens (`--accent`, `--c-positive/neutral/negative/comment`,
`--pen`, `--ink`, `--surface-1`, `--line`) and the handwriting fonts (Caveat / Kalam);
the element inherits them. Open [`index.html`](./index.html) over `http://` for a live
showcase (inline / modal / accordion / inline-JSON).

## Giving it a pack — three ways

1. **`src` attribute** — a URL fetched as JSON: `<context-pack src="…/craap.json">`.
2. **Inline JSON** — a `<script type="application/json">` child (works offline).
3. **`.pack` property** — `el.pack = {…}` from script. **This is the route an
   Adapt view uses** (`postRender` sets `.pack` from the component model).

## Attributes

| attribute | values | default | effect |
| --- | --- | --- | --- |
| `src` | URL | — | pack JSON to fetch |
| `launch` | `inline` · `modal` · `accordion` | `inline` | how it mounts |
| `advance` | `click` · `auto` | `click` | step on click, or auto-play |
| `auto-ms` | number | `2800` | auto-play interval |
| `controls` | `false` to hide | shown | the Back / Next / Replay bar |
| `heading` | text | pack title | modal title / accordion summary / trigger |
| `trigger-label` | text | `Launch — <heading>` | the modal launch button text |

## Events

All bubble and are `composed`. `detail` as noted.

| event | when | detail |
| --- | --- | --- |
| `context-pack:ready` | mounted | `{ pack, mode, stepCount? }` |
| `context-pack:step` | each step change | `{ step, stepCount }` |
| `context-pack:complete` | reached the last step | `{ pack }` |
| `context-pack:open` | modal opened | `{ pack }` |
| `context-pack:error` | bad/missing pack | `{ message }` |

On completion it also adds the **`is-complete`** class and a **`data-complete`**
attribute to the element.

## Properties & methods

- `el.pack` — get/set the pack object (setting re-renders).
- `el.completed` — boolean.
- `el.open()` — open the modal (any launch mode); returns `{ dialog, api }`.
- `el.replay()`, `el.goTo(n)`.

## The Adapt path (next step)

An Adapt component wraps this element rather than re-implementing it:

```js
// adapt-contextPackView.js (sketch)
postRender() {
  const el = document.createElement('context-pack');
  el.setAttribute('launch', this.model.get('_launch') || 'inline');
  el.pack = this.model.get('_pack');                 // author's pack, from the course JSON
  el.addEventListener('context-pack:complete', () => this.setCompletionStatus());
  this.$('.component__inner')[0].appendChild(el);
  this.setReadyStatus();
}
onRemove() { /* el is removed with the view; disconnectedCallback tears it down */ }
```

The `is-complete` class and `context-pack:complete` event are the hooks; the
`.pack` property is how the authored content gets in. Completion fires when the
learner reaches the last step.

## Single source of truth

This directory is the **canonical** engine. The authoring sandbox
(`tools/context-packs/`) and the Adapt plugin (`adapt-grow-contextpack/`) each
hold a copy (the tool is served standalone; the Adapt component bundles the file
through webpack). Edit the engine **here**, then push it out:

```powershell
node sync-engine.cjs          # copy context-pack.js/.css into both consumers
node sync-engine.cjs --check  # verify nothing has drifted (exit 1 if it has)
```

## Check after editing

```powershell
node --check context-pack.js
# the renderer still exports a Node-usable validate():
node -e "const CP=require('./context-pack.js');console.log(typeof CP.validate, Object.keys(CP))"
```

(`validate(pack)` → `{ valid, errors, warnings }`. In Node the custom-element
block is skipped — there is no `window` — so `require` returns the renderer API.)
