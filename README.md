# GROW · `grow-ct`

**The structural & functional course builder for Adapt.**

`grow-ct` is where **GROW** lives: the reusable *structure* and *behaviour* of
Adapt courses. The goal is a standalone **Adapt course-structure builder** —
pick GROW **structural templates**, assemble them, and get a real GROW-based
Adapt course out the other end.

> This repo owns **structure and function**. It does **not** own the look.
> Colour / type / spacing is the job of a separate **theme builder** project
> (see [How the pieces fit](#how-the-pieces-fit)). `grow-ct` ships only a *basic*
> base-colour adapter so it renders; the real theming is layered on top later.

---

## What's being built here

The immediate work is **collation**: take the assets built up recently (the
animation kit, the frontmatter/data layer, the role-based BEM structure, the
template overrides) and turn them into **ordered, reusable pieces**:

1. **Snippets** — the raw, de-duplicated building blocks, correctly ordered.
2. **Adapt components & extensions** — snippets promoted into real, installable
   Adapt plugins.
3. **Structural template packs** — curated sets of the above, named
   **`adapt-grow-<template-pack-name>-template`**.
4. **The builder** — a UI to pick structural templates and emit a GROW course.

The base structural packs — the always-present foundation the builder assembles
onto — are collectively called **CORE**.

---

## How the pieces fit

GROW is one of a small family of repos, **all built on the same Node + Adapt
base** (that's why each one is containerised — identical build everywhere):

| Repo | Owns | Produces |
|---|---|---|
| **`grow-ct`** (this repo) | **structure + function** | `adapt-grow-*-template` structural packs → the course-structure builder |
| **theme builder** *(separate project, to be spun out)* | **look** — colour, type, layout/spacing | **theme packs** layered over GROW **CORE** structural packs |
| [`know-ct`](https://github.com/phat-cat-dev/know-ct) | **knowledge** | a SKOS relational-knowledge layer on the GROW depth model |

**The theme builder ↔ GROW contract.** GROW's structural templates expose a
small **HTML → LESS interface** (a handful of tokens — one hue, a type-scale, a
space-scale; the maths does the rest). The theme builder reads that interface
off a GROW template's LESS output and **generates the base settings**, which are
then baked back into the interface. So the two projects stay decoupled: GROW
defines *what can be themed*, the theme builder decides *how it looks*.

`grow-ct` and `know-ct` are developed on **separate branches / repos on
purpose**, so either can move fast without breaking the other — and so their
templates can be **merged or integrated later** if it makes sense. Unrelated
git histories, same container base.

---

## What's in the repo today

```
grow-ct/                     the GROW Adapt theme plugin (the engine + structure)
  less/                      token engine: one hue + fluid type/space → the whole ramp
  js/growMeta.js             stamps the universal _grow data layer onto the DOM
  templates/                 page/article/block overrides + the _grow-frontmatter partial
  schema/ properties.schema  the _grow field shapes
  know/  → (absent here)     the KNOW layer lives in know-ct, not grow-ct
packages/grow-core-base/     the 'adab' style-tier assembly + a buildable course config (CORE seed)
docs/                        architecture, data→presentation map, Adapt mapping spec
gallery/                     standalone previews (lesson, structure, stacks)
Dockerfile compose.yaml docker/   one-command containerised build + serve
.github/workflows/           Docker Image CI
```

- **Token engine** — one hue (`--h`) + `--type-scale` + `--space-scale` drive a
  fully fluid `clamp()` type ramp and spacing scale. Change a dial, reskin
  everything. This is the *basic base adapter*; the theme builder will drive it.
- **Universal data layer** — every level (lesson → phase → section → activity →
  step → item) can carry `_grow` metadata, stamped to `data-grow-*` always.
- **Role-based BEM** — one `.frontmatter` block + structural blocks vary by
  modifier, not by prefix. `grow` lives only in `data-*` and tokens.

---

## Run it (containerised)

```sh
git clone https://github.com/phat-cat-dev/grow-ct.git
cd grow-ct
docker compose up --build        # → http://localhost:8080
```

First run clones the Adapt framework into a named volume, installs plugins,
drops the `grow-ct` plugin in as `_theme`, builds and serves. `THEME` and
`ADAPT_MODE` are the only dials — see [`docker/README.md`](docker/README.md).
No local Node / Adapt CLI / Grunt required.

To preview without a build, open `gallery/*.html` in a browser.

---

## Roadmap

- [x] GROW theme plugin — token engine, `_grow` data layer, role-based BEM
- [x] Containerised build/serve + CI, on the shared Node + Adapt base
- [ ] **Collate** the recent assets into ordered, de-duplicated snippets
- [ ] Promote snippets → Adapt **components** and **extensions**
- [ ] Package **`adapt-grow-<pack>-template`** structural template packs (CORE first)
- [ ] The **course-structure builder** — pick templates, emit a GROW course
- [ ] Define the HTML→LESS **theme interface** the theme builder consumes
- [ ] Verify the live `grunt build` in the container (column routing, schema merge)

---

## Status & lineage

Fresh repo, clean single-commit root — no prior fork/kit history. GPL-3.0 by
code inheritance from `adapt-contrib-vanilla` (the GROW plugin re-drives
vanilla's shell painting through the token engine). Sibling project:
[`know-ct`](https://github.com/phat-cat-dev/know-ct). The theme builder will be
spun out as its own repo.
