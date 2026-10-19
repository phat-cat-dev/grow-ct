# Context packs

A **context pack** teaches a *process* by writing a **statement** and then
marking it up **one move at a time**. Three ideas do the teaching:

- **steps** hold the order the process depends on (you cannot see move 4 before move 3);
- a **fade** hands attention to exactly what changed;
- a mark that **draws itself on** — a tutor's hand — shows *where to look, in what order* (Mayer's signalling, made literal).

A pack is **data** (`packs/*.json`). The renderer turns it into a stepped,
click-advanced, animated walkthrough you can **launch in a modal**, drop in an
**accordion**, or embed **inline**. Marks reuse the animation-manager draw-on
engine and its **semantic colour roles**, so every mark follows the host theme
and can be any colour.

## Try it

From the **repo root**, start a server, then open the page over `http://localhost`
(not the `file://` path — the packs load by `fetch`, which the browser blocks on
`file://`):

```powershell
python -m http.server 8953      # run this in the repo root
```

Then visit:

```
http://localhost:8953/tools/context-packs/index.html
```

Cards launch each pack in a **modal**; there's an **accordion** mount and the
**empty template** animating so you can see the slot structure.

## Three stage types (matched to the palette patterns)

| stage type | the move | palette pattern | example |
| --- | --- | --- | --- |
| `annotated-prose` | mark up text in place | `inline-commentary` (`palette/annotated`) | [marking-feedback](./packs/marking-feedback.json) |
| `checklist` | judge against named criteria, stamp a verdict | `spot-the-error` | [craap](./packs/craap.json) · [radar](./packs/radar.json) · [robot](./packs/robot.json) |
| `assembly` | build something up part by part | `sequential-process` | [referencing](./packs/referencing.json) |
| `process` | reveal the ordered moves of a skill (no artefact) | `sequential-process` | [the 20 academic processes](./packs/processes/) |

The **20 Universal Academic Processes** are built as `process` activities — see
[`processes.html`](./processes.html) to launch them and
[`.dev/docs/academic-processes.md`](../../.dev/docs/academic-processes.md) for the
SKOS model. The reusable renderer is now also a custom element,
[`<context-pack>`](../../assets/components/context-pack/).

## The data model

See [`context-pack-schema.json`](./context-pack-schema.json). A pack has a
`statement`, a `stage`, ordered `steps` (captions), and optional `feedForward`.
Each reveal (a `segment`, `item` or `part`) carries a `step`; marks appear
cumulatively as steps advance.

**Marks** — on-a-word: `underline`, `wavy`, `oval`, `box`, `strike`, `scribble`;
stamped-beside: `tick`, `cross`, `question`, `exclaim`, `star`, `caret`. The
`?` and `!` carry a filled dot that pops in after the stroke draws; strokes are
marker-pen weight and take any colour.

**Colour is meaning:** `positive` strength/correct · `negative` error/correction ·
`neutral` caution/query/overclaim · `comment` needs-clarification · `accent`
focus · `pen` teacher voice (margin notes) · `ink` plain.

## Renderer API

```html
<link rel="stylesheet" href="./context-pack.css">
<div id="host"></div>
<script src="./context-pack.js"></script>
<script>
  fetch('./packs/marking-feedback.json').then(r => r.json()).then(pack => {
    ContextPack.render(document.getElementById('host'), pack);   // inline
    // ContextPack.launchModal(pack);                            // modal
    // ContextPack.renderAccordion(host, pack);                  // accordion
    // ContextPack.validate(pack)  -> { valid, errors, warnings }
  });
</script>
```

`render` returns `{ goTo, next, back, replay, play, stop, step, destroy }`.
Options: `{ advance: 'click' | 'auto', autoMs, controls }`. The host theme tokens
(`--accent`, `--c-positive/neutral/negative/comment`, `--pen`, `--ink`,
`--surface-1`, `--line`) feed the marks; sensible fallbacks apply without them.
The ink filter and handwriting fonts (Caveat/Kalam) are needed — the renderer
injects the `#am-ink` filter; load the fonts in the host page.

## Author new packs

- The empty template with every slot named: [`packs/_template.json`](./packs/_template.json)
  (the index page animates it so you can see the shape).
- A **series of agent prompts** to write the content for a process:
  [`prompts/author-context-pack.md`](./prompts/author-context-pack.md).

## Where the engine lives

`context-pack.js` / `context-pack.css` here are **synced copies** — the canonical
engine is [`assets/components/context-pack/`](../../assets/components/context-pack/).
Edit it there and run `node assets/components/context-pack/sync-engine.cjs` (packs,
schema, prompts and pages stay here).

## Check after editing

```powershell
node --check context-pack.js
node -e "const CP=require('./context-pack.js'),fs=require('fs');for(const f of ['marking-feedback','craap','referencing','_template']){const r=CP.validate(JSON.parse(fs.readFileSync('packs/'+f+'.json')));console.log(f,r.valid,r.errors)}"
```
