#!/usr/bin/env node
/**
 * new-course.js
 *
 * Cold-start writer for a brand-new course manifest. The ONE exception to
 * /land's append-only, one-gate-per-invocation, string-asserted-edit
 * invariant (`.claude/commands/land.md`) — kept on its own surface so that
 * invariant stays literally true everywhere else.
 *
 * Gate realignment (Round F, 8 Oct 2026, gate-redesign-2026-10-06.md): a new
 * course is created from the four closed ONB gates — onb-01_theme-preset,
 * onb-02_course-theme, onb-03_pitch, onb-04_naming (onb-04 mints the slug and
 * is why "no files can be created until answered" now attaches to it, not the
 * retired crs-03_vocabulary). The manifest's facetSet
 * (schemas/common.schema.json: pathway + tier required) is projected from the
 * ONB answers: theme -> pathway (onb-02), pitch -> tier (onb-03).
 *
 * It also auto-states the six reserved CXS gates at creation (Abbott,
 * 8 Oct 2026): CXS is deterministic and course-level, so cxs-01..06 are
 * written with state "closed", provenance "advisory-stated" (GI-2), cxs-04
 * carrying the live Harvard/Cite Them Right referencing default and the rest
 * no value. The human/agent gates (crs-*, les-*, wra-*, cxp-01/02/04) are
 * still decided one at a time via /gate + /land; cxp-03 (reserved, CXP) is
 * left to the CXP flow.
 *
 * Usage:
 *   node tools/new-course.js --slug=<slug> --answers=<path-to-answers.json>
 *
 * answers.json shape: an object keyed by the four ONB gate ids, each a gate
 * record ({state:"closed", provenance, decidedValue, grounding?, confirmedAt?,
 * sessionRef?}); seq and timestamp are assigned on write, not trusted from
 * input.
 *   {
 *     "onb-01_theme-preset": { ... },
 *     "onb-02_course-theme": { ... },   // decidedValue.theme -> pathway
 *     "onb-03_pitch":        { ... },   // decidedValue.pitch -> tier
 *     "onb-04_naming":       { ... }    // decidedValue.slug must equal --slug
 *   }
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const HARD_STOP_PROVENANCE = new Set(['human-confirmed', 'human-specified', 'human-amended']);
const ONB_GATES = ['onb-01_theme-preset', 'onb-02_course-theme', 'onb-03_pitch', 'onb-04_naming'];

// Reserved/auto CXS gates (gate-redesign-2026-10-06.md; Abbott, 8 Oct 2026,
// "reserved-gate record-writing"). CXS is deterministic and course-level, so
// its six reserved gates are auto-stated at course creation rather than opened
// via /gate. All are advisory hardness, so provenance is advisory-stated
// (GI-2: advisory-stated is reserved for advisory-hardness gates, stated at the
// moment they apply, never opened for confirmation). cxs-04 carries a live
// default (Harvard / Cite Them Right); the other five auto-pass with no value.
// cxp-03 (CXP, per-subject) is NOT written here — it is written by the CXP
// context-pack flow when that phase is built (deferred, same shape).
const CXS_AUTO_GATES = [
  'cxs-01_institutional-context',
  'cxs-02_subject-context',
  'cxs-03_qualifiers',
  'cxs-04_referencing-style',
  'cxs-05_external-standards',
  'cxs-06_resources'
];
const CXS_DECIDED_VALUES = {
  'cxs-04_referencing-style': { referencingStyle: 'Harvard (Cite Them Right)' }
};
// A closed record requires decidedValue (course-design.schema.json's
// state=="closed" conditional), so the five pure placeholders carry an
// explicit reserved/none value rather than nothing.
const CXS_RESERVED_VALUE = { value: 'none', reserved: true };

function cxsAutoRecord(gateId, now) {
  return {
    seq: 1,
    state: 'closed',
    provenance: 'advisory-stated',
    grounding: [],
    decidedValue: CXS_DECIDED_VALUES[gateId] || CXS_RESERVED_VALUE,
    timestamp: now
  };
}

function fail(message) {
  console.error(`REFUSED: ${message}`);
  process.exit(1);
}

function parseArgs() {
  const args = { slug: null, answers: null };
  process.argv.slice(2).forEach(param => {
    const eq = param.indexOf('=');
    if (eq === -1) return;
    const key = param.slice(2, eq);
    const value = param.slice(eq + 1);
    if (key === 'slug') args.slug = value;
    if (key === 'answers') args.answers = value;
  });
  if (!args.slug) fail('--slug=<slug> is required.');
  if (!args.answers) fail('--answers=<path-to-answers.json> is required.');
  return args;
}

function loadAnswers(answersPath) {
  const resolved = path.resolve(answersPath);
  if (!fs.existsSync(resolved)) fail(`answers file not found: ${resolved}`);
  let raw;
  try { raw = fs.readFileSync(resolved, 'utf8'); }
  catch (err) { fail(`answers file unreadable: ${resolved} (${err.message})`); }
  try { return JSON.parse(raw); }
  catch (err) { fail(`answers file is not valid JSON: ${resolved} (${err.message})`); }
}

function checkGateRecord(record, gateId) {
  if (!record) fail(`answers file carries no "${gateId}" key: ${gateId} is unanswered.`);
  if (record.state !== 'closed') {
    fail(`${gateId}.state is "${record.state}", not "closed": every ONB gate must be answered and closed before a manifest can be created.`);
  }
  if (!record.decidedValue || typeof record.decidedValue !== 'object' || Array.isArray(record.decidedValue)) {
    fail(`${gateId}.decidedValue is missing or not an object.`);
  }
  if (!HARD_STOP_PROVENANCE.has(record.provenance)) {
    fail(`${gateId}.provenance is "${record.provenance}": ONB gates are hard-stop and require one of ${[...HARD_STOP_PROVENANCE].join(', ')}.`);
  }
}

function loadKbVersion(storeRelPath, fallback) {
  const storePath = path.join(ROOT, storeRelPath);
  if (!fs.existsSync(storePath)) return fallback;
  try { return JSON.parse(fs.readFileSync(storePath, 'utf8')).kbVersion || fallback; }
  catch (err) { return fallback; }
}

function main() {
  const args = parseArgs();
  const slug = args.slug;

  const courseDir = path.join(ROOT, 'courses', slug);
  if (fs.existsSync(courseDir)) {
    const existingManifests = fs.readdirSync(courseDir).filter(f => /^course-design_.*\.json$/.test(f));
    if (existingManifests.length > 0) {
      fail(`${courseDir} already carries a manifest (${existingManifests.join(', ')}). This tool creates a course's FIRST manifest only; do not overwrite.`);
    }
    fail(`${courseDir} already exists (no manifest inside it, but the directory is not empty or is pre-created). Remove it or choose a different slug.`);
  }

  const answers = loadAnswers(args.answers);
  for (const gateId of ONB_GATES) checkGateRecord(answers[gateId], gateId);

  const theme = answers['onb-02_course-theme'].decidedValue.theme;
  const pitch = answers['onb-03_pitch'].decidedValue.pitch;
  const namedSlug = answers['onb-04_naming'].decidedValue.slug;

  if (!theme) fail('onb-02_course-theme.decidedValue.theme is missing: it becomes facetSet.pathway.');
  if (!pitch) fail('onb-03_pitch.decidedValue.pitch is missing: it becomes facetSet.tier.');
  if (!['introductory', 'intermediate', 'advanced'].includes(pitch)) {
    fail(`onb-03_pitch.decidedValue.pitch is "${pitch}", which facetSet.tier does not allow (introductory|intermediate|advanced). A no-tier course needs the no-tier machinery, not yet wired (A3).`);
  }
  if (namedSlug !== slug) {
    fail(`--slug="${slug}" does not match onb-04_naming.decidedValue.slug="${namedSlug}".`);
  }

  const facetSet = { pathway: theme, tier: pitch };

  const now = new Date().toISOString();
  const manifest = {
    schemaVersion: '0.1.0',
    courseId: slug,
    slug: slug,
    status: 'in-development',
    facetSet: facetSet,
    kbVersions: {
      'design-kb': loadKbVersion('design-kb/design-kb.gates.json', '0.10.0'),
      'source-kb': loadKbVersion('source-kb/source-kb.json', '0.1.0')
    },
    gates: [
      ...ONB_GATES.map(gateId => ({
        gateId,
        records: [Object.assign({}, answers[gateId], { seq: 1, timestamp: now })]
      })),
      ...CXS_AUTO_GATES.map(gateId => ({
        gateId,
        records: [cxsAutoRecord(gateId, now)]
      }))
    ],
    phases: [],
    instantiations: []
  };

  fs.mkdirSync(courseDir, { recursive: true });
  const manifestPath = path.join(courseDir, `course-design_${slug}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  console.log(`Wrote ${manifestPath}`);
  console.log('');
  console.log(`facetSet projected from ONB (theme -> pathway, pitch -> tier):`);
  console.log(JSON.stringify(facetSet, null, 2));
  console.log('');
  console.log(`Auto-stated ${CXS_AUTO_GATES.length} reserved CXS gates (advisory-stated): ${CXS_AUTO_GATES.join(', ')}`);
  console.log(`  cxs-04_referencing-style carries ${JSON.stringify(CXS_DECIDED_VALUES['cxs-04_referencing-style'])}; the rest carry no value.`);
  console.log('');

  console.log('='.repeat(60));
  console.log('VALIDATE: validate-design-schemas.py --course-design');
  console.log('='.repeat(60));
  try {
    const out = execSync(
      `python3 tools/validate-design-schemas.py --course-design "${manifestPath}"`,
      { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    console.log(out);
  } catch (err) {
    console.log(err.stdout || '');
    console.error(err.stderr || '');
    fs.rmSync(manifestPath);
    if (fs.readdirSync(courseDir).length === 0) fs.rmdirSync(courseDir);
    fail(`assembled manifest failed schema validation; ${manifestPath} removed, not left behind.`);
  }

  console.log('');
  console.log(`Manifest created: ${manifestPath}`);
  console.log('Next: /gate ' + slug + ' crs-01_sources');
}

main();
