# Scenario creator

A deep **branching scenario** creator: a builder you feed a topic and qualifiers,
a visual editor, a runtime player, a schema + validator, and an agent prompt
system that gives a purpose prompt at **every pedagogical layer**. Plain files,
no build step, no dependencies — open the HTML pages directly or serve the folder.

Branching scenarios teach **judgement**, not facts. This toolset is built to the
practice of Cathy Moore (action mapping; decisions over information; consequences
over feedback) and the "three mental models / three branch structures" model —
including the third structure, **carry a variable forward into later scenes**.

## The flow

```
builder.html  →  editor.html  →  player.html
 topic +          refine the      walk it:
 qualifiers       nodes, see      choices, state,
 → scaffold       the branch map  reflections, endings
 + author prompt  + validation

 schema.json · validator.js · scenario-runtime.js   (the contract + engine)
 layer-prompts.json · prompts/author-prompt.md      (the pedagogy, for agents)
```

Open [builder.html](./builder.html) to start. The builder hands off to the editor
and player via the browser's local storage, so the three pages work together.
(Local file:// works for the editor and builder; the player's **Load example**
and the editors' **Load example** buttons need the folder served over HTTP —
`python -m http.server` — because they fetch the example JSON.)

## builder.html — topic + qualifiers → scaffold

Enter a **topic** and **qualifiers** — audience, learning outcomes, number of
decision points (1–6), branch structure (spine / tree / mixed), a variable to
carry forward, consequence style, reflections, tone, reading level — and it
generates:

- a **valid scaffold**: the right shape for the chosen structure, every node
  pre-tagged by pedagogical `layer` and pre-filled with that layer's purpose and
  topic-seeded placeholder text, ready to refine;
- a filled **authoring prompt** (topic + qualifiers + the per-layer guidance +
  the scaffold) to hand an agent to expand into finished prose.

Then **Open in editor**, **Preview in player**, download or copy.

### Export a standalone HTML/JS file

The builder, editor and player all have an **Export HTML** / **Download
standalone HTML** button. It writes **one self-contained `.html` file** —
inline CSS, an inline copy of the runtime (state, effects, conditional branches,
`{{variable}}`), a small player, and the scenario embedded — with **animated
scene cards** (soft, borderless, not boxy). No dependencies, no network: open it
by double-click, email it, or drop it on any static host (or LMS). This is the
"it goes out" deliverable; the JSON stays the editable source.
[export-html.js](./export-html.js) provides `ScenarioExportHtml.build(scenario)`
(browser + Node).

## editor.html — refine and see the branches

- Scenario meta, learning outcomes, and **variables** (state carried forward).
- A node form that adapts to the node type: choices (each a believable **mental
  model**, with `quality`/`rationale` and per-choice `effects`), conditional
  **branches** (route on a variable), effects, endings with `outcome`/`debrief`.
- A live **branch map** (SVG) coloured by type and ending outcome; click to edit.
- Live **validation** (errors + pedagogical warnings) and stats.
- Beside every node, the **purpose prompt for that layer** — what it is *for* in
  the learning, with ask-yourself / write / avoid guidance.
- Import / paste / download / copy; renaming a node rewrites its references;
  edits autosave to local storage.

## player.html — walk the scenario

Loads a scenario (file, paste, the worked example, or a hand-off from the
builder/editor), **validates** it, then plays it: continue / choice / timed
`auto` / ending nodes, reflections, honest outcome badges and debriefs. It runs
the **state engine** — applies `effects`, evaluates conditional `branches`, and
interpolates `{{variable}}` in text — and shows an optional state + path panel.

## The contract

- [schema.json](./schema.json) — JSON Schema (draft-07) for a version-2 scenario:
  nodes (`continue` / `choice` / `auto` / `ending`), pedagogical `layer`,
  `variables`, `effects`, conditional `branches`, and choices as mental models.
- [validator.js](./validator.js) — structural **and** graph checks a schema can't
  do: reachability, dead ends, dangling refs, ending spread, cosmetic branches,
  variable use, cycles. Runs in the browser (`window.ScenarioValidator`) and Node
  (`require`). Returns `{ valid, errors, warnings, stats }`.
- [scenario-runtime.js](./scenario-runtime.js) — the pure walk engine
  (`initState`, `applyEffects`, `evalCondition`, `resolveNext`, `interpolate`);
  browser + Node.

## The pedagogy (for agents and authors)

- [layer-prompts.js](./layer-prompts.js) / [layer-prompts.json](./layer-prompts.json)
  — a prompt for **every layer** (opening, decision, consequence, reflection,
  ending, info) plus the whole-scenario prompt: purpose, ask-yourself, write,
  avoid, quality checks. The editor surfaces these; agents read them. `.js` is the
  single source; regenerate the `.json` with:

  ```powershell
  node -e "const p=require('./layer-prompts.js');require('fs').writeFileSync('layer-prompts.json',JSON.stringify(p,null,2)+'\n')"
  ```

- [prompts/author-prompt.md](./prompts/author-prompt.md) — the master prompt that
  turns a topic + qualifiers into a valid scenario, applying each layer's purpose.

## Examples & template

- [template.json](./template.json) — a blank version-2 authoring template
  (your original structure, upgraded: layers, purposes, a variable and a branch).
- [examples/performance-conversation.json](./examples/performance-conversation.json)
  — a worked deep scenario: three believable mental models for opening a hard
  conversation, a `trust` variable carried forward, three honest endings chosen by
  the whole path. Validates clean; load it in the player to see the model.

## Node types

| type | role | key fields |
| --- | --- | --- |
| `continue` | a beat / reflection / info; advances on a button | `button`, `next`, `branches?`, `effects?`, `prompt?` |
| `choice` | a decision — options as mental models | `choices[]` (`label`, `next`, `mentalModel?`, `quality?`, `rationale?`, `effects?`) |
| `auto` | a consequence revealed after a pause | `delayMs`, `button`, `next`, `branches?`, `effects?` |
| `ending` | an outcome + debrief | `outcome`, `debrief?`, `prompt?` (no `next`/`choices`) |

State: declare `variables` at the top; mutate with `effects` (`set` / `add` /
`subtract` / `toggle`) on a node or a choice; route with `branches`
(`eq`/`ne`/`gt`/`gte`/`lt`/`lte`/`truthy`/`falsy`), tried before the default
`next`; show values with `{{variable}}` in any text.

## Check after editing source

```powershell
node --check validator.js ; node --check scenario-runtime.js ; node --check scaffold.js ; node --check layer-prompts.js ; node --check export-html.js
node -e "const V=require('./validator.js'),fs=require('fs');for(const f of ['template.json','examples/performance-conversation.json']){const r=V.validate(JSON.parse(fs.readFileSync(f)));console.log(f,r.valid,r.errors)}"
```
