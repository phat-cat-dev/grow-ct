# Authoring prompts — write a context pack

A **context pack** teaches a *process* by writing a statement and then marking it
up **one move at a time**. The three ideas do the teaching: **steps** hold the
order the process depends on, a **fade** hands attention to what changed, and a
mark that **draws itself on** is an expert's hand showing where to look.

Give an agent the prompts below **in order** (each builds on the last). The
output is a single JSON pack valid against
[`context-pack-schema.json`](../context-pack-schema.json), renderable by
`ContextPack.render` / `.launchModal`.

---

## The contract (hand this to the agent first)

> You are building a GROW **context pack**: data that renders as a statement +
> a stage that is annotated step by step. Obey
> [`context-pack-schema.json`](../context-pack-schema.json).
>
> **Stage types** — pick the one that fits the process:
> - `annotated-prose` — mark up a piece of text in place (marking & feedback,
>   close reading, exemplar analysis). Pattern: `inline-commentary`.
> - `checklist` — judge an artefact against named criteria, stamping a verdict
>   on each (CRAAP, rubric, pre-submission review). Pattern: `spot-the-error`.
> - `assembly` — build something up part by part (a citation, a formula, a
>   paragraph structure). Pattern: `sequential-process`.
>
> **Marks** (each takes any `color` role): on-a-word → `underline`, `wavy`,
> `oval`, `box`, `strike`, `scribble`; stamped-beside → `tick`, `cross`,
> `question`, `exclaim`, `star`, `caret`.
>
> **Colour = meaning**, not decoration: `positive` (green) strength/correct ·
> `negative` (red) error/correction · `neutral` (amber) caution/query/overclaim ·
> `comment` (violet) needs-clarification · `accent` focus/attention ·
> `pen` teacher voice (margin notes) · `ink` plain.
>
> Each reveal carries a `step` number; `steps[]` gives the caption for each.
> Marks appear cumulatively as steps advance.

---

## PROMPT 1 — Frame the process

> For the process **«name»**, in one sentence each:
> 1. What judgement or skill should the learner be better at after watching it?
> 2. Whose move is this — a tutor marking? a researcher judging? a writer building?
> 3. What are the 4–7 **moves**, in the exact order an expert makes them?
>
> Then pick the stage type (`annotated-prose` / `checklist` / `assembly`) that
> matches how the artefact is worked on.

## PROMPT 2 — Write the statement

> Write the `statement`: one or two sentences that frame what the learner is
> about to watch, name the artefact, and preview the ordered moves. It is shown
> before anything is marked. No jargon the learner doesn't yet have.

## PROMPT 3 — Script the steps

> Write `steps[]`, one per move from Prompt 1, **in order**. Step 0 is the
> set-up (read / meet the source / what we're building) with nothing marked yet.
> For each step give a `title` (the move, 2–5 words) and `text` (what the move
> teaches and *why* — the reasoning, not just the instruction). This is the
> teaching; make each one earn its place.

## PROMPT 4 — Place the marks

Choose the sub-prompt for your stage type.

> **annotated-prose** — Write `segments[]` as the text in reading order. Leave
> ordinary runs as `{ "text": "…" }`. For each thing an expert would mark, make a
> target segment with an `id`, its `text`, the `step` it reveals at, and a `mark`
> `{kind, color}`. Use a mark that *means* what you intend (underline a claim,
> oval an assertion/overclaim, strike an error with a `correction`, tick a
> strength). Never mark more than one idea per step.

> **checklist** — Write the optional `source` (what's under review) and `items[]`,
> one criterion each: `letter`, `label`, the `question` it asks, a one-line
> `verdict`, a `mark` whose colour carries the verdict (tick=pass, cross=fail,
> question=partial, exclaim=caution), and its `step`.

> **assembly** — Write `intro` (what the finished thing must contain) and
> `parts[]` in build order: each part's `text`/`html`, the `step` it appears at,
> and a final part with a `tick` mark to confirm completion.

## PROMPT 5 — Write the commentary

> For `annotated-prose`, add a `note` to the segments that deserve a margin
> comment — in a tutor's voice, short, and inviting (a question beats a verdict).
> Every noted segment needs an `id`. For `checklist`, make each `verdict`
> specific to *this* artefact. For `assembly`, put the rule for each part in its
> step `text`. Show, don't grade.

## PROMPT 6 — Write the feed-forward

> Add `feedForward`: name the genuine strength, then one or two **specific,
> actionable next steps**. This is the move that changes the next attempt. Set
> its `step` to the last step (or omit for the default).

## PROMPT 7 — Assemble & check

> Output the complete pack as one JSON object valid against the schema. Then
> verify: every `step` is within `0..steps.length-1`; every noted segment has an
> `id`; every `mark.kind` and `color` is from the allowed lists; mark colours
> match their meaning; marks reveal one idea per step. Fix anything that fails.
> (Programmatically: `ContextPack.validate(pack)` must return `valid: true`.)

---

## Ready-made starters

**Marking & feedback (annotated-prose)**
> Build a context pack where a tutor marks a short student paragraph on «topic».
> Include: underline the central claim; oval an unsupported assertion (margin
> note asking for a source); strike one mechanical error with a correction above;
> oval an overclaim (margin note naming the logic gap); tick a genuine strength
> (margin note saying why); end with feed-forward. Follow Prompts 1–7.

**Evaluating a source (checklist)**
> Build a context pack that walks the CRAAP test over a named, flawed source.
> Five items (Currency, Relevance, Authority, Accuracy, Purpose), each with a
> verdict and a colour-coded stamp, then an overall verdict in feed-forward.
> Make at least two lenses fail. Follow Prompts 1–7.

**Building a reference (assembly)**
> Build a context pack that assembles a «style» reference for a «source type»
> one element at a time (author → year → title → source → access date), with the
> rule for each element in its step, and a tick when complete. Follow Prompts 1–7.
