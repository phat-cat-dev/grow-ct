#!/usr/bin/env node
/**
 * phase-confirm.js
 *
 * RJ-0061 (adp-0216): lands one phase's soft and advisory gates in a
 * single run, from a draft of answers written by a `/phase-draft`
 * session (one draft file, GDP-1, covering the whole phase). This tool
 * holds the mechanical work only; it never proposes content itself and
 * never touches `config.json` or `en/*.json` (DR-1's content-authoring
 * step in `land.md` is unaffected and still runs per gate).
 *
 * Which gates a phase batches: every gate in the named phase whose
 * `hardness` (design-kb/design-kb.gates.json, read through
 * tools/gate-order.js, RJ-0059) is `soft` or `advisory`, never a
 * hardcoded list. Hard-stop gates in the same phase (e.g. crs-01_course-facets,
 * crs-03_vocabulary in Phase A) are answered one at a time via the existing
 * `/gate` and `/land` path and are not part of this batch.
 *
 * Per-gate outcome (RULINGS 5, adp-0216-outcomes-draft-reopen.md,
 * verbatim): "human-amended where Abbott marks a gate, the gate's
 * default provenance where he does not." Two branches only:
 *   - marked: provenance "human-amended"; the draft's own proposed
 *     value is carried as `originalProposal` (the schema requires it
 *     exactly here, confirmed directly in tools/validate-design-
 *     schemas.py's comment at the course-design-schema conditional).
 *   - not marked (stood on silence): the gate's own hardness/
 *     defaultType decides the word, the same mapping `land.md` step 2
 *     already uses per gate: hardness advisory -> "advisory-stated";
 *     defaultType fixed-value -> "ai-default-stood"; defaultType
 *     ai-proposal-stands -> "ai-proposal-stood". Any other defaultType
 *     on a soft gate is refused by name, not guessed.
 *
 * confirmedAt (schemas/course-design.schema.json, the records item
 * shape): enum ["gate", "phase-close"], described there as
 * distinguishing "confirmed-at-gate from bulk-blessing at phase
 * close." This tool stamps `confirmedAt: "phase-close"` on exactly the
 * not-marked branch above (the records that stood on silence in this
 * batch), per RULINGS 5's own words ("stamps confirmedAt on every
 * record that stood on silence"); marked (human-amended) records carry
 * no confirmedAt.
 *
 * FLAGGED TENSION, not resolved here (adp-0216, RJ-0061): schemas/
 * common.schema.json's own provenance-enum description reads
 * "human-confirmed at phase close is distinguished via confirmedAt" --
 * tying confirmedAt to the human-confirmed word specifically. RULINGS
 * 5's two-branch model (above) never produces human-confirmed at all,
 * so confirmedAt as implemented here stamps ai-default-stood,
 * ai-proposal-stood or advisory-stated records, not human-confirmed
 * ones. Built to RULINGS 5's own explicit words, which is this job's
 * direct and most specific instruction; the tension against the
 * common.schema.json description is named here, in the command doc
 * and in the session's report rather than silently resolved either
 * way.
 *
 * bulkBlessing (schemas/course-design.schema.json's `phases[]` item
 * shape) carries three buckets: `blessed`, `stood`, `proposalStood`.
 * This tool populates only `stood` (ai-default-stood gates) and
 * `proposalStood` (ai-proposal-stood gates); it never populates
 * `blessed`, since RULINGS 5's two-branch model has no path that
 * produces human-confirmed. advisory-stated and human-amended gate
 * ids are not listed in any bulkBlessing bucket; they are still
 * present as records on their own gates.
 *
 * Amend rate: logged by the calling session into the course's own
 * `docs/project/design-phase-logs/<slug>.md`, as a dated line, not
 * written by this tool. This tool prints the rate (`marked`/`total`,
 * which gate ids were marked) so the session has it to log without
 * recounting.
 *
 * Validate before read-back (RJ-0102, adp-0226, D-0081 (a)): after the
 * write, and before the read-back below, this tool runs the course-
 * design schema validator (tools/validate-design-schemas.py
 * --course-design) on the record it just wrote. A record the
 * validator refuses stops here: the validator's own named errors are
 * printed and the read-back is skipped. The write itself still
 * stands -- report-failed-state, not rollback, since the manifest is
 * append-only by the tool's own design (see applyPhaseBatch's
 * comment); unwinding a just-appended record would fight that
 * invariant rather than honour it, and a caller who re-runs validate-
 * design-schemas.py directly against the path this tool printed sees
 * the same failure, not a file that silently reverted. This replaces
 * the choice RJ-0080 made below (validator skipped entirely); see
 * runCourseDesignValidator's own comment for the CLI contract this
 * relies on.
 *
 * Read-back (RJ-0080, adp-0223): after a write the validator accepts,
 * this tool renders the course design specification (tools/render-
 * course-spec.js) from the just-written record and writes it beside
 * the record itself, never changing the record a second time. See
 * renderReadBack's own comment for what this does and does not run.
 *
 * Usage:
 *   node tools/phase-confirm.js --course-design=<path> --draft=<path> --phase=<id> [--store=<path>]
 *
 * Draft file shape (written by the /phase-draft session, GDP-1):
 *   { "answers": [
 *       { "gateId": "gates/B1", "decidedValue": {...}, "marked": false },
 *       { "gateId": "gates/B2", "decidedValue": {...}, "marked": true,
 *         "originalProposal": {...} }
 *   ] }
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const gateOrder = require('./gate-order.js');
const renderCourseSpecTool = require('./render-course-spec.js');

/**
 * Every soft or advisory gate in the named phase, in sequence order.
 * Never a hardcoded list: filters tools/gate-order.js's own getOrder()
 * output. Throws, naming the phase, when the result is empty (RJ-0061
 * test 3: "a run reaching no gates fails").
 */
function getPhaseBatchGates(store, phaseId) {
  const gates = gateOrder.getOrder(store)
    .filter(g => g.phase === phaseId && (g.hardness === 'soft' || g.hardness === 'advisory'));
  if (gates.length === 0) {
    throw new Error(`phase-confirm: phase ${phaseId} has no soft or advisory gate in the store: nothing to batch`);
  }
  return gates;
}

/** The provenance word for one gate's answer, per RULINGS 5's two branches. */
function computeProvenance(gate, marked) {
  if (marked) return 'human-amended';
  if (gate.hardness === 'advisory') return 'advisory-stated';
  if (gate.defaultType === 'fixed-value') return 'ai-default-stood';
  if (gate.defaultType === 'ai-proposal-stands') return 'ai-proposal-stood';
  throw new Error(
    `phase-confirm: ${gate.id} is soft with defaultType '${gate.defaultType}', ` +
    `neither 'fixed-value' nor 'ai-proposal-stands': refusing to choose a word for it`
  );
}

/**
 * Builds the batch's records and its phases[] entry from a phase's
 * gate list and the draft's answers. Pure: takes and returns plain
 * objects, writes nothing. Throws, naming the gate, when a gate the
 * phase batches has no answer (RJ-0061 test 2: "a planted course
 * missing a gate fails with a named error" -- "missing" here is the
 * answer, found missing against the store's own phase list).
 */
function buildPhaseBatch(store, phaseId, answers) {
  const gates = getPhaseBatchGates(store, phaseId);
  const byId = new Map(answers.map(a => [a.gateId, a]));
  const nowIso = new Date().toISOString();

  const records = [];
  const stood = [];
  const proposalStood = [];
  let markedCount = 0;

  for (const gate of gates) {
    const answer = byId.get(gate.id);
    if (!answer) {
      throw new Error(`phase-confirm: no answer supplied for ${gate.id}, required by phase ${phaseId}`);
    }
    const marked = Boolean(answer.marked);
    const provenance = computeProvenance(gate, marked);
    if (marked) {
      markedCount += 1;
      if (answer.originalProposal === undefined) {
        throw new Error(`phase-confirm: ${gate.id} is marked but carries no originalProposal (required when provenance is human-amended)`);
      }
    }
    const record = {
      state: 'closed',
      provenance,
      decidedValue: answer.decidedValue,
      timestamp: nowIso,
      grounding: answer.grounding || []
    };
    if (marked) {
      record.originalProposal = answer.originalProposal;
    } else {
      record.confirmedAt = 'phase-close';
      if (provenance === 'ai-default-stood') stood.push(gate.id);
      if (provenance === 'ai-proposal-stood') proposalStood.push(gate.id);
    }
    records.push({ gateId: gate.id, record });
  }

  const phaseEntry = {
    phaseId,
    closedAt: nowIso,
    bulkBlessing: { stood, proposalStood }
  };

  return {
    records,
    phaseEntry,
    amendRate: { phaseId, marked: markedCount, total: gates.length, gateIds: gates.map(g => g.id) }
  };
}

/**
 * Appends the batch's records (one per gate, next seq) and its
 * phases[] entry into a course-design object. Mutates and returns the
 * same object; append-only, matching the manifest's own invariant.
 */
function applyPhaseBatch(courseDesign, batch) {
  for (const { gateId, record } of batch.records) {
    let entry = courseDesign.gates.find(g => g.gateId === gateId);
    if (!entry) {
      entry = { gateId, records: [] };
      courseDesign.gates.push(entry);
    }
    const nextSeq = entry.records.length > 0
      ? Math.max(...entry.records.map(r => r.seq)) + 1
      : 1;
    entry.records.push(Object.assign({ seq: nextSeq }, record));
  }
  courseDesign.phases.push(batch.phaseEntry);
  return courseDesign;
}

/**
 * RJ-0102 (adp-0226, D-0081 (a)): runs tools/validate-design-
 * schemas.py --course-design <path> on the record just written, by
 * shelling out to it the same way the test suite's own CLI tests
 * shell out to this tool (node:child_process, execFileSync). The
 * validator's CLI contract (read directly from its own main(), not
 * assumed): prints "PASS" and exits 0 when the instance is clean;
 * prints "FAIL - N error(s):" followed by one named line per error
 * and exits 1 otherwise. All of that printing is to the validator's
 * own stdout (it uses print(), not a stderr stream), which is why
 * this function reads err.stdout, not err.stderr, on failure.
 * Returns null on PASS; returns the validator's own stdout (the
 * named errors) on FAIL, for the caller to print and act on. The
 * validator script's own path is resolved from this file's own
 * directory (__dirname), not from process.cwd(), so this still works
 * run from anywhere.
 */
function runCourseDesignValidator(courseDesignPath, storePath) {
  const validatorPath = path.join(__dirname, 'validate-design-schemas.py');
  const validatorArgs = [validatorPath, '--course-design', courseDesignPath];
  // Validate the just-written record against the SAME store this run was
  // given (--store), not the validator's repo default: the records carry
  // whatever gate ids that store defines, so resolution must use it too.
  // Omitted in production (no --store), where both sides default to the
  // repo gates store, so this is a no-op there.
  if (storePath) {
    validatorArgs.push('--course-design-gates', storePath);
  }
  try {
    execFileSync('python3', validatorArgs, { encoding: 'utf8' });
    return null;
  } catch (err) {
    return err.stdout || err.message;
  }
}

/**
 * RJ-0080's own read-back (adp-cds-pd-spec.md section 6: "at phase
 * confirm... never as a step that changes a record"). Renders the
 * course design specification from the just-written courseDesign and
 * writes it beside the course design record itself, never under
 * courses/<slug>/ by a hardcoded path (a course-design path handed to
 * this tool is not always under courses/, e.g. a test fixture), so
 * production use still lands at courses/<slug>/adp-course-design-
 * specification_<slug>.md (spec section 2's own naming rule) while a
 * fixture-driven run writes beside its own fixture instead. This
 * function is now called only once the record has already passed
 * tools/validate-design-schemas.py --course-design (see main(), RJ-
 * 0102): this read-back renders the just-validated record and does
 * not itself run the validator a second time. Never throws past this
 * function: a read-back that cannot render (store/field-list drift)
 * is named on stderr and the phase-confirm write it follows still
 * stands, since this is a read-back, not a gate on the write -- the
 * same report-failed-state choice RJ-0102 makes for a validator
 * failure, for the same reason (the manifest is append-only).
 */
function renderReadBack(courseDesignPath, courseDesign, store) {
  try {
    const specPath = path.join(
      path.dirname(courseDesignPath),
      `adp-course-design-specification_${courseDesign.slug}.md`
    );
    const result = renderCourseSpecTool.renderCourseSpec(courseDesign, store, {});
    fs.writeFileSync(specPath, result.markdown);
    return { specPath, notReadyCount: result.notReady.length };
  } catch (err) {
    console.error(`phase-confirm: read-back render failed, write already stands: ${err.message}`);
    return null;
  }
}

function parseArgs(argv) {
  const args = { courseDesign: null, draft: null, phase: null, store: null };
  argv.forEach(param => {
    const eq = param.indexOf('=');
    if (eq === -1) return;
    const key = param.slice(2, eq);
    const value = param.slice(eq + 1);
    if (key === 'course-design') args.courseDesign = value;
    if (key === 'draft') args.draft = value;
    if (key === 'phase') args.phase = value;
    if (key === 'store') args.store = value;
  });
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.courseDesign || !args.draft || !args.phase) {
    console.error('phase-confirm: usage: --course-design=<path> --draft=<path> --phase=<id> [--store=<path>]');
    process.exit(1);
  }
  try {
    const store = gateOrder.loadStore(args.store);
    const courseDesignPath = path.resolve(args.courseDesign);
    const courseDesign = JSON.parse(fs.readFileSync(courseDesignPath, 'utf8'));
    const draft = JSON.parse(fs.readFileSync(path.resolve(args.draft), 'utf8'));
    const batch = buildPhaseBatch(store, args.phase, draft.answers || []);
    applyPhaseBatch(courseDesign, batch);
    fs.writeFileSync(courseDesignPath, JSON.stringify(courseDesign, null, 2) + '\n');
    const validatorOutput = runCourseDesignValidator(courseDesignPath, args.store);
    if (validatorOutput !== null) {
      console.error(
        'phase-confirm: tools/validate-design-schemas.py --course-design refused the record ' +
        'just written; the read-back is skipped. The write stands (RJ-0102: report-failed-' +
        'state, not rollback -- the manifest is append-only, see applyPhaseBatch). ' +
        'Validator output:\n' + validatorOutput
      );
      process.exit(1);
    }
    const readBack = renderReadBack(courseDesignPath, courseDesign, store);
    console.log(JSON.stringify({
      wrote: courseDesignPath,
      phaseId: args.phase,
      gateIds: batch.amendRate.gateIds,
      amendRate: `${batch.amendRate.marked}/${batch.amendRate.total}`,
      bulkBlessing: batch.phaseEntry.bulkBlessing,
      readBack: readBack || '*(read-back render failed: see stderr)*'
    }, null, 2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  getPhaseBatchGates,
  computeProvenance,
  buildPhaseBatch,
  applyPhaseBatch,
  runCourseDesignValidator,
  renderReadBack
};
