# Author prompt — write a deep branching scenario

Give this to an agent (or follow it yourself) to turn a **topic + qualifiers**
into a finished, valid branching scenario. The builder (`builder.html`) fills the
Brief and attaches a scaffold automatically; this file is the canonical version
and explains the thinking at every layer.

---

You are an instructional designer writing a **branching learning scenario**. A
branching scenario teaches **judgement**, not facts: it puts the learner in a
role where they must decide under realistic constraints and live with the
consequences. If a quiz or a page of text would teach it as well, it should not
be a scenario.

## Inputs (the Brief)

```
Topic:            <what the scenario is about>
Audience:         <who it is for, and the role they play>
Learning outcomes:<1–4 observable judgements, phrased as actions>
Decision points:  <1–6>
Branch structure: spine | tree | mixed
Carry a variable: <name, or none>   (required for "mixed")
Tone / reading level: <optional>
```

## The three branch structures (choose per the Brief)

1. **Spine** — choices **reconverge** to a shared path and one outcome. Easiest
   to author; good for a tight 2–3 decision rehearsal.
2. **Tree** — choices **diverge**; weaker choices reach their own earlier
   endings. Produces multiple distinct outcomes. Variable depth per path.
3. **Mixed** — reconverges, **but carries a variable forward** so the ending
   reflects the whole path, not just the last click. The richest structure.

Make branching exist because the judgement has real forks — never to pad length.
Cathy Moore's guidance applies: a few meaningful decision points beat many
trivial ones.

## Process

1. **Outcomes first.** Restate each learning outcome as an observable judgement.
   Every decision you write must map to one; cut decisions that map to none.
2. **Design the decisions.** For each, invent 2–4 options that are **believable
   mental models** — distinct ways a real person would think about the moment —
   not one right answer plus distractors. Keep labels parallel so none is
   signposted as correct. Optionally tag each with `quality` (strong / workable
   / weak) and a `rationale` for the debrief, never shown before the learner
   commits.
3. **Branch.** Lay out the structure from the Brief. If mixed, declare the
   variable, add `effects` to the choices that should move it, and add a
   `branches` route near the end that selects the ending from the carried value.
4. **Write consequences.** Show what each choice set in motion — realistic,
   specific, and different per choice. Reveal cause and effect; do not grade.
   Let a weaker choice complicate the path (and, in spine/mixed, recover) rather
   than instantly ending, unless the stakes truly are terminal.
5. **Add reflections** where a principle should be pulled out: one open question
   tied to an outcome.
6. **Write endings** that follow believably from their path, name the outcome
   honestly (`positive` / `mixed` / `negative`), and debrief against the
   outcomes. Invite replay.

## Apply the purpose of each layer as you write

Each node carries a `layer`. Before writing a node, apply that layer's purpose
(full text with "ask yourself / write / avoid / quality checks" in
[`layer-prompts.json`](../layer-prompts.json)):

- **opening** — orient and invest: give a role, a context and a stake so the
  first decision feels like the learner's.
- **decision** — a genuine fork mapped to an outcome; each option a believable
  mental model, none flagged correct.
- **consequence** — show, don't grade: realistic fallout specific to the choice.
- **reflection** — pull out the principle: one open question that generalises.
- **ending** — consolidate the arc: honest outcome + debrief + invitation to
  replay. Endings should differ in outcome, not just wording.
- **info** — connective tissue: only what the next decision needs; cut the rest.

## Output

Return **only** the scenario JSON, valid against
[`schema.json`](../schema.json) (version 2). Keep the scaffold's ids, types,
links, variables and branches; replace every `[bracketed]` placeholder with real
text. Before returning, run it through [`validator.js`](../validator.js) and fix
every error (and reconsider every warning).

## Self-check before returning

- [ ] Every decision maps to a stated learning outcome.
- [ ] No option is signposted as the "right" one.
- [ ] Consequences are specific to their choice and reveal, not scold.
- [ ] Endings differ in `outcome`; at least two are reachable (tree / mixed).
- [ ] If mixed: the variable is moved by `effects` and read by `branches`.
- [ ] `validator.js` reports `valid: true` with no unexplained warnings.

---

### Design lineage

This model follows the branching-scenario practice of Cathy Moore (action
mapping; decisions over information; consequences over feedback; "how many
decision points?"), the eLearning Industry branching technique write-ups, and
worked examples such as Artha Learning's "three mental models / three branch
structures" and Syniad Learning's scenario examples.
