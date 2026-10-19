# adapt3 manifest generator (standalone)

The Stage-A **gate → build-manifest** pipeline from adapt3, extracted as a
self-contained unit that runs with **no Adapt framework, no `adapt install`,
no `grunt`**. Feed it gate answers, get a validated course-design manifest
(+ a readable spec) out. Built to be driven by an external builder such as
**grow-ct**.

## What it is / isn't

- **Is:** the mechanical tools that turn gate *decisions* into a validated
  manifest (`course-design_<slug>.json`) and render the spec. Pure Node +
  Python over the `design-kb/` + `schemas/` stores.
- **Isn't:** the interactive gate *conversation* (the `/gate` + `/land`
  skills), the Adapt content scaffold/build, or the CXP/subject stores. Those
  stay in adapt3. This bundle is the surface a builder calls; the builder (or a
  human) supplies the decisions.

## Requirements

- Node 18+ and `npm install` here (one dep: `fs-extra`).
- Python 3 with `jsonschema` (`pip install jsonschema`).

## Layout (do not flatten)

The tools resolve their root as `tools/../`, so keep this layout intact:

```
tools/        new-course.js, gate-order.js, phase-confirm.js,
              render-course-spec.js, manifest-completeness.js,
              validate-gate-record.py, validate-design-schemas.py, lib/
design-kb/    design-kb.gates.json + the other design stores
schemas/      course-design + common + gate schemas
source-kb/    source-kb.json (kbVersion stamp)
examples/     sample ONB answers + a sample gate record
```

Output courses are written under `courses/<slug>/` relative to this root.

## npm scripts (wired for grow-ct)

Run from `manifest-generator/`. Pass tool args after `--`:

```sh
npm install                       # once (fs-extra)
npm run demo                      # end-to-end on the shipped example -> courses/example-course/
npm run new-course -- --slug=<slug> --answers=<file>
npm run validate -- --course-design courses/<slug>/course-design_<slug>.json
npm run validate-record -- <draft-record.json>
npm run completeness -- --course=<slug>
npm run render -- --course=<slug>
```

(`gate-order`, `phase-confirm` are wired the same way. New tools you add go in
`tools/` and get a line in `package.json` "scripts".)

## The pipeline (end to end)

```sh
npm install                                             # once (fs-extra)

# 1. ONB answers -> new manifest (+ auto-stated CXS). Writes courses/<slug>/.
#    NB: --slug MUST equal the answers' onb-04 decidedValue.slug. The shipped
#    example uses "example-course"; change both together for a real course.
node tools/new-course.js --slug=example-course --answers=examples/onb-answers.example.json

# 2. validate the manifest
python3 tools/validate-design-schemas.py \
  --course-design courses/<slug>/course-design_<slug>.json

# 3. add a decided gate (the mechanical /land path):
#    a) validate the draft record  b) append it to manifest.gates[]  c) re-validate
python3 tools/validate-gate-record.py examples/crs-01-sources.record.example.json

# 4. readiness report (exits non-zero until LES/WRA content exists — expected
#    for a design-only manifest)
node tools/manifest-completeness.js --course=<slug>

# 5. render the human-readable spec -> courses/<slug>/adp-course-design-specification_<slug>.md
node tools/render-course-spec.js --course=<slug>
```

## Input contracts (what a builder supplies)

**ONB answers** (`--answers`): an object keyed by the four ONB gate ids, each a
gate record. `onb-02` theme → pathway, `onb-03` pitch → tier, `onb-04` mints the
slug (`decidedValue.slug` must equal `--slug`). See
`examples/onb-answers.example.json`.

**A gate record** (for CRS/LES/WRA, appended one at a time): `{ state,
provenance, decidedValue, grounding?, confirmedAt?, sessionRef?, seq, timestamp }`.
`seq` is the next number for that gate; `timestamp` is ISO. Validate every draft
with `validate-gate-record.py` before appending it to the manifest's
`gates[]` (append-only — never edit an earlier record). See
`examples/crs-01-sources.record.example.json`.

## Outputs (what grow-ct consumes)

- `courses/<slug>/course-design_<slug>.json` — the build manifest (every gate
  decision; append-only record).
- `courses/<slug>/adp-course-design-specification_<slug>.md` — the readable spec.

grow-ct scaffolds from the manifest: `manifest.gates` (the decisions) and, once
lessons/wrappers are authored, `manifest.instantiations` (slot→component map).

## Provenance

Extracted from `wkspc2614-adapt3` (`tools/`, `design-kb/`, `schemas/`,
`source-kb/`) at commit 7cc387c. To refresh when adapt3's tools/stores change,
run `./sync-from-adapt3.sh [path-to-adapt3-checkout]` (default source
`/home/user/wkspc2614-adapt3`) and review `git diff` before committing. The
script re-copies only the manifest-path files — not `catalogue/`, the Adapt
build side, or the interactive gate skills.
