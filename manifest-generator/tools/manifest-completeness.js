#!/usr/bin/env node
/**
 * manifest-completeness.js
 *
 * 5.88 gate-coverage / manifest-completeness check. Sibling to
 * conformance-lint.js - same CLI convention (--course=<slug>).
 *
 * Usage:
 *   node tools/manifest-completeness.js --course=<course-slug>
 *
 * Seven read-only clauses over a course's course-design_<slug>.json,
 * en/*.json, content/context-packs/ and design-kb stores. Each
 * clause prints what it checked and how many items, never a bare
 * PASS. A clause that checks zero items is a FAIL, not a PASS.
 *
 * Exit 0 only when every clause passed with at least one item
 * checked. Exit 1 otherwise.
 *
 * Landed: 8 Sep 2026, backlog 5.88 (gate-coverage tooling gap),
 * extended per 5.101 (D1-vs-context-packs) fix direction; extended
 * again 19 Sep 2026 per LN-1 (docs/project/open-decisions.md) with
 * clause 7, lesson-key numbering.
 */

const fs = require('fs-extra');
const path = require('path');
const { matchesPageKey } = require('./lib/page-match');
const { resolveCourse } = require('./lib/course-resolve');
const { scaffoldBoundaryStatus } = require('./lib/phase-gate');

const ROOT = path.resolve(__dirname, '..');

function parseArgs() {
  const args = { course: null };
  process.argv.slice(2).forEach(param => {
    const parts = param.replace(/^--/, '').split('=');
    if (parts[0] === 'course') {
      args.course = parts.slice(1).join('=');
    }
  });
  if (!args.course) {
    console.error('Usage: node tools/manifest-completeness.js --course=<course-slug>');
    process.exit(1);
  }
  return args;
}

function loadJsonIfExists(p) {
  if (!p || !fs.existsSync(p)) return null;
  return fs.readJsonSync(p);
}

function main() {
  const { course } = parseArgs();
  const resolved = resolveCourse(course, ['courses', 'courses/_generated']);
  if (!resolved.found) {
    console.error(`Course not found for slug "${course}". Checked:\n  ${resolved.checked.join('\n  ')}`);
    process.exit(1);
  }
  resolved.warnings.forEach(w => console.error(`WARNING: ${w}`));

  const courseDir = resolved.courseDir;
  const courseDesignPath = resolved.courseDesignPath;
  const enDir = path.join(courseDir, 'en');
  const configPath = path.join(courseDir, 'config.json');
  const enFiles = ['contentObjects.json', 'articles.json', 'blocks.json', 'components.json'];

  console.log(`\nmanifest-completeness: ${course}`);
  console.log(`Course directory: ${path.relative(ROOT, courseDir)}`);
  console.log('');

  const results = [];

  function clause(name, fn) {
    console.log('='.repeat(60));
    console.log(`CLAUSE: ${name}`);
    console.log('='.repeat(60));
    let r;
    try {
      r = fn();
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      r = { pass: false, itemsChecked: 0 };
    }
    // PHA-1: a clause gated on the scaffold boundary reports waiting,
    // not failing, while that boundary has not been reached - checked
    // before the zero-items rule below, which still governs every
    // other way a clause can find nothing to check (PHA-1's own last
    // sentence: "A check that reaches no subjects still fails").
    if (r.notYetReachable) {
      console.log(`RESULT: NOT YET REACHABLE (${r.itemsChecked} items checked)`);
      console.log('');
      results.push({ name, pass: true, itemsChecked: r.itemsChecked, notYetReachable: true });
      return;
    }
    if (r.itemsChecked === 0) {
      console.log('0 items checked');
      r.pass = false;
    }
    console.log(`RESULT: ${r.pass ? 'PASS' : 'FAIL'} (${r.itemsChecked} items checked)`);
    console.log('');
    results.push({ name, pass: r.pass, itemsChecked: r.itemsChecked });
  }

  const courseDesign = loadJsonIfExists(courseDesignPath);

  // Match ids and gate-ids against the course's OWN declared slug
  // (manifest.slug), not the directory-derived --course arg. A _generated
  // context course (courses/_generated/<base>-<context>/) keeps the BASE
  // slug in its _id/_parentId, gate record ids and manifest.slug, while
  // verify-all-courses addresses it by its <base>-<context> directory name;
  // matching on manifest.slug makes those resolve. For a normal course the
  // two are equal, so this is a no-op there. (Option 1, 9 October 2026.)
  const matchSlug = (courseDesign && courseDesign.slug) || course;

  // Every "no course-design file" branch below this point (clauses 1, 2,
  // 6, lessonCheck() and the CO-1 IIFE) reports via
  // `path.relative(ROOT, courseDesignPath)` - which throws
  // TypeError [ERR_INVALID_ARG_TYPE] ("The 'to' argument must be of type
  // string. Received null") when courseDesignPath is null, i.e. exactly
  // the case those branches exist to report. clause()'s own try/catch
  // (above) hides this for clauses 1, 2 and 6, but lessonCheck() and the
  // CO-1 IIFE have no such wrapper, so the process crashed uncaught the
  // first time either ran against a course with no course-design_*.json
  // file. Failing outright here, before any clause or lesson check
  // starts, reports the same fact without the crash; it does not touch
  // the separate zero-lessons/zero-subjects failure any clause or check
  // can still reach once courseDesign itself loads.
  if (!courseDesign) {
    console.error(
      courseDesignPath
        ? `No course-design file for "${course}": expected file not found at ${path.relative(ROOT, courseDesignPath)}`
        : `No course-design file for "${course}": no course-design_*.json file was found in ${path.relative(ROOT, courseDir)}`
    );
    process.exit(1);
  }

  // ---- Clause 1: gate coverage (5.87 case) ----
  clause('1. Gate coverage (les-01 per lesson-map lesson)', () => {
    if (!courseDesign) {
      console.log(`No course-design file at ${path.relative(ROOT, courseDesignPath)}`);
      return { pass: false, itemsChecked: 0 };
    }
    // PHA-1: les-01 is Phase LES, after /scaffold (ORD-1). Expecting it
    // before every gate ORD-1 places before /scaffold has itself closed
    // or skipped is this clause depending on work from a later stage -
    // report waiting, not failing, until scaffoldBoundaryStatus says
    // that point has been reached. Six-phase model (8 Oct 2026): the old
    // seven per-lesson B-gates collapsed to the single consolidated
    // les-01_lesson-proposal, one per lesson, under the per-lesson id
    // `<course>-<bareKey>-les-01`.
    const boundary = scaffoldBoundaryStatus(courseDesign, course);
    if (!boundary.reached) {
      console.log(`NOT YET REACHABLE: waits on the scaffold boundary (PHA-1) - still open: ${boundary.missing.join(', ')}`);
      return { pass: true, itemsChecked: 0, notYetReachable: true };
    }
    const gates = courseDesign.gates || [];
    const gateIds = new Set(
      gates
        .filter(g => Array.isArray(g.records) && g.records.length > 0)
        .map(g => g.gateId)
    );
    const map = gates.find(g => g.gateId === 'crs-04_lesson-map');
    if (!map || !Array.isArray(map.records) || map.records.length === 0) {
      console.log('No crs-04_lesson-map record found (lesson list unavailable)');
      return { pass: false, itemsChecked: 0 };
    }
    const lastMap = map.records[map.records.length - 1];
    const lessons = (lastMap.decidedValue && lastMap.decidedValue.lessons) || [];
    console.log(`Lesson map: ${lessons.length} lessons`);

    let itemsChecked = 0;
    let missing = [];
    for (const lesson of lessons) {
      // LK-1: the field is "key", not "pageKey"; reuses the same
      // lessonBareKey() every lesson check below calls. The per-lesson
      // gate id must resolve whether or not the lesson key carries the
      // slug (bare/slug-prefixed candidate logic in tools/lib/page-match.js).
      const bareKey = lessonBareKey(lesson);
      if (bareKey === null) {
        itemsChecked++;
        missing.push(`lesson missing "key" (title "${lesson.title || '?'}")`);
        continue;
      }
      itemsChecked++;
      const gateId = `${matchSlug}-${bareKey}-les-01`;
      if (!gateIds.has(gateId)) {
        missing.push(gateId);
      }
    }
    console.log(`Checked ${itemsChecked} per-lesson les-01 gate(s) across ${lessons.length} lessons`);
    if (missing.length > 0) {
      console.log(`Missing gate records (${missing.length}):`);
      missing.forEach(id => console.log(`  - ${id}`));
    } else {
      console.log('A les-01 gate record is present for every lesson-map lesson.');
    }
    return { pass: missing.length === 0, itemsChecked };
  });

  // ---- Clause 2: instantiations coverage ----
  clause('2. Instantiations (page <-> instantiations[] match)', () => {
    if (!courseDesign) {
      console.log(`No course-design file at ${path.relative(ROOT, courseDesignPath)}`);
      return { pass: false, itemsChecked: 0 };
    }
    // PHA-1: instantiations[] entries are written during /land (les-01
    // per lesson, and the wrapper gates - see .claude/commands/land.md
    // step 4), all after /scaffold. Same reasoning as clause 1 above.
    const boundary = scaffoldBoundaryStatus(courseDesign, course);
    if (!boundary.reached) {
      console.log(`NOT YET REACHABLE: waits on the scaffold boundary (PHA-1) - still open: ${boundary.missing.join(', ')}`);
      return { pass: true, itemsChecked: 0, notYetReachable: true };
    }
    const contentObjectsPath = path.join(enDir, 'contentObjects.json');
    const contentObjects = loadJsonIfExists(contentObjectsPath);
    if (!contentObjects) {
      console.log(`No contentObjects.json at ${path.relative(ROOT, contentObjectsPath)}`);
      return { pass: false, itemsChecked: 0 };
    }
    const pages = contentObjects.filter(o => o._type === 'page');
    const instantiations = courseDesign.instantiations || [];
    console.log(`Pages in en/contentObjects.json: ${pages.length}`);
    console.log(`Entries in instantiations[]: ${instantiations.length}`);

    let itemsChecked = 0;
    const pagesWithNoInstantiation = [];
    for (const page of pages) {
      itemsChecked++;
      const hasMatch = instantiations.some(inst => matchesPageKey(page._id, matchSlug, inst.pageKey));
      if (!hasMatch) pagesWithNoInstantiation.push(page._id);
    }

    const instantiationsNamingMissingPage = [];
    for (const inst of instantiations) {
      itemsChecked++;
      const hasMatch = pages.some(page => matchesPageKey(page._id, matchSlug, inst.pageKey));
      if (!hasMatch) instantiationsNamingMissingPage.push(inst.pageKey);
    }

    console.log(`Checked ${itemsChecked} items (${pages.length} pages + ${instantiations.length} instantiations)`);
    if (pagesWithNoInstantiation.length > 0) {
      console.log(`Pages with no instantiations[] entry (${pagesWithNoInstantiation.length}):`);
      pagesWithNoInstantiation.forEach(id => console.log(`  - ${id}`));
    } else {
      console.log('Every page has a matching instantiations[] entry.');
    }
    if (instantiationsNamingMissingPage.length > 0) {
      console.log(`Instantiations naming a page that does not exist (${instantiationsNamingMissingPage.length}):`);
      instantiationsNamingMissingPage.forEach(pk => console.log(`  - ${pk}`));
    } else {
      console.log('Every instantiation names an existing page.');
    }

    return {
      pass: pagesWithNoInstantiation.length === 0 && instantiationsNamingMissingPage.length === 0,
      itemsChecked
    };
  });

  // ---- Clause 3: context packs imply D1 (5.101 case) ----
  clause('3. Context packs imply cxp-04 record', () => {
    const packsRoot = path.join(ROOT, 'content', 'context-packs');
    if (!fs.existsSync(packsRoot)) {
      console.log(`No context-packs directory at ${path.relative(ROOT, packsRoot)}`);
      return { pass: false, itemsChecked: 0 };
    }
    // CP-1j AMENDMENT (22 September 2026, Prompt 152): context packs sit
    // at content/context-packs/<subject>/<base-course-slug>/, never at a
    // generated (tier+context) slug. Derive the base slug from the
    // course-design file's own name - the same authoritative source
    // resolveCourse() already uses (see PROBLEM 2 in course-resolve.js) -
    // never by string-guessing a suffix strip off `course`.
    const baseSlugMatch = courseDesignPath
      ? /^course-design_(.+)\.json$/.exec(path.basename(courseDesignPath))
      : null;
    if (!baseSlugMatch) {
      console.log(`Cannot resolve a base course slug for "${course}": no single course-design_*.json file was found for this course (tried ${courseDesignPath ? path.relative(ROOT, courseDesignPath) : path.relative(ROOT, courseDir)}).`);
      return { pass: false, itemsChecked: 0 };
    }
    const baseSlug = baseSlugMatch[1];

    // RESERVED CONTEXTS: `baseline` is merge-context's neutral shape-reference
    // template (--context=baseline), not a delivered subject context. It has
    // no subject, qualifiers or human context-generation confirm, so it carries
    // no CXP records and is exempt from this clause (Abbott, 9 October 2026).
    const RESERVED_CONTEXTS = new Set(['baseline']);
    const allDirs = fs.readdirSync(packsRoot).filter(name => {
      const full = path.join(packsRoot, name);
      return fs.statSync(full).isDirectory();
    });
    const subjects = allDirs.filter(name => !RESERVED_CONTEXTS.has(name));
    const exemptPresent = allDirs.filter(name => RESERVED_CONTEXTS.has(name));
    if (exemptPresent.length > 0) {
      console.log(`Exempt reserved context(s) (no CXP records required): ${exemptPresent.join(', ')}`);
    }

    const subjectsWithPacksForCourse = [];
    for (const subject of subjects) {
      const slugDir = path.join(packsRoot, subject, baseSlug);
      if (!fs.existsSync(slugDir)) continue;
      const files = fs.readdirSync(slugDir).filter(f => f.endsWith('.json') && f !== 'context.json');
      if (files.length > 0) {
        subjectsWithPacksForCourse.push({ subject, files });
      }
    }

    console.log(`Subjects checked for content/context-packs/<subject>/${baseSlug}/: ${subjects.length}`);
    console.log(`Subjects with lesson pack files for ${baseSlug}: ${subjectsWithPacksForCourse.length}`);
    subjectsWithPacksForCourse.forEach(s => console.log(`  - ${s.subject} (${s.files.length} files: ${s.files.join(', ')})`));

    const itemsChecked = subjectsWithPacksForCourse.length;
    if (itemsChecked === 0) {
      console.log(`No subject has lesson-level context packs for ${baseSlug}; clause has nothing to require.`);
      return { pass: false, itemsChecked: 0 };
    }

    const gates = (courseDesign && courseDesign.gates) || [];
    // Six-phase per-pack keying (gate-redesign-2026-10-06.md, D1, 8 Oct
    // 2026): cxp-04_context-generation repeats per context pack
    // (repeatsPer: context-pack), so each subject's context-generation
    // record is keyed by the composite gate id `<baseSlug>-<subject>-cxp-04`
    // (old D1; subject is the content/context-packs/<subject>/ directory
    // name), written by /new-context on confirm. Each subject that has
    // lesson pack files for this course must carry its own such record.
    const subjectsMissingCxp04 = [];
    for (const { subject } of subjectsWithPacksForCourse) {
      const gateId = `${baseSlug}-${subject}-cxp-04`;
      const g = gates.find(x => x.gateId === gateId);
      const present = !!(g && Array.isArray(g.records) && g.records.length > 0);
      console.log(present
        ? `Found: ${gateId} has ${g.records.length} record(s).`
        : `Not found: ${gateId} has no record in course-design.`);
      if (!present) subjectsMissingCxp04.push(subject);
    }
    if (subjectsMissingCxp04.length > 0) {
      console.log(`Subjects with packs and no per-pack cxp-04 record (${subjectsMissingCxp04.length}):`);
      subjectsMissingCxp04.forEach(s => console.log(`  - ${s}`));
    }

    return { pass: subjectsMissingCxp04.length === 0, itemsChecked };
  });

  // ---- Clause 4: scaffold outputs (5.85 case) ----
  clause('4. Scaffold outputs (config.json + four en/*.json)', () => {
    const checks = [{ label: 'config.json', p: configPath }];
    enFiles.forEach(f => checks.push({ label: `en/${f}`, p: path.join(enDir, f) }));

    let itemsChecked = 0;
    const missing = [];
    for (const c of checks) {
      itemsChecked++;
      const exists = fs.existsSync(c.p);
      console.log(`${exists ? 'FOUND' : 'MISSING'}: ${path.relative(ROOT, c.p)}`);
      if (!exists) missing.push(c.label);
    }
    return { pass: missing.length === 0, itemsChecked };
  });

  // ---- Clause 5: duplicate ids (5.86 case) ----
  clause('5. Duplicate _id across the four en/*.json files', () => {
    const idLocations = new Map(); // id -> [ "file#index", ... ]
    let itemsChecked = 0;

    for (const f of enFiles) {
      const p = path.join(enDir, f);
      const data = loadJsonIfExists(p);
      if (!data) {
        console.log(`SKIP (not found): en/${f}`);
        continue;
      }
      const items = Array.isArray(data) ? data : [data];
      items.forEach((item, idx) => {
        if (!item || typeof item !== 'object' || !item._id) return;
        itemsChecked++;
        const loc = `en/${f}[${idx}] (_id: ${item._id})`;
        if (!idLocations.has(item._id)) idLocations.set(item._id, []);
        idLocations.get(item._id).push(loc);
      });
    }

    console.log(`Checked ${itemsChecked} items with an _id across: ${enFiles.join(', ')}`);
    const duplicates = [...idLocations.entries()].filter(([, locs]) => locs.length > 1);
    if (duplicates.length > 0) {
      console.log(`Duplicate _id values (${duplicates.length}):`);
      duplicates.forEach(([id, locs]) => {
        console.log(`  - ${id}:`);
        locs.forEach(l => console.log(`      ${l}`));
      });
    } else {
      console.log('No duplicate _id values found.');
    }
    return { pass: duplicates.length === 0, itemsChecked };
  });

  // ---- Clause 6: slotKey resolution (5.97 case) ----
  // Extended 9 Sep 2026 (5.113 follow-on): a slotKey resolving against
  // its archetype only proves the manifest names a valid slot - it does
  // not prove a block was actually built for it. This clause now also
  // requires a block on the matched built page whose _skeletonKey equals
  // the slotKey, and reports that failure SEPARATELY from an
  // archetype-resolution failure, per instruction. Page/block lookup
  // reuses the shared matchesPageKey() from tools/lib/page-match.js
  // (contentObjects/articles/blocks parentage chain, tolerant of both
  // bare and slug-prefixed pageKey forms) - see the Records note below
  // for what was actually observed running this against all four
  // courses.
  clause('6. slotKey resolution against skeleton archetypes + built blocks', () => {
    if (!courseDesign) {
      console.log(`No course-design file at ${path.relative(ROOT, courseDesignPath)}`);
      return { pass: false, itemsChecked: 0 };
    }
    const skeletonsPath = path.join(ROOT, 'design-kb', 'design-kb.skeletons.json');
    const skeletons = loadJsonIfExists(skeletonsPath);
    if (!skeletons || !Array.isArray(skeletons.archetypes)) {
      console.log(`design-kb.skeletons.json not found or has no "archetypes" array at ${path.relative(ROOT, skeletonsPath)}`);
      console.log('clause 6 not implementable against the store as it stands');
      return { pass: false, itemsChecked: 0 };
    }
    // Confirm the store defines slots in a form this clause can read:
    // archetypes[].blockSequence[] entries carrying a "slot" object,
    // keyed by blockSequence[].key.
    const archetypeSlotKeys = new Map(); // archetypeId -> Set(keys with a slot)
    for (const arch of skeletons.archetypes) {
      if (!Array.isArray(arch.blockSequence)) continue;
      const keys = new Set(
        arch.blockSequence.filter(b => b && typeof b === 'object' && b.slot).map(b => b.key)
      );
      archetypeSlotKeys.set(arch.id, keys);
    }
    if (archetypeSlotKeys.size === 0) {
      console.log('No archetype in design-kb.skeletons.json defines blockSequence[].slot.');
      console.log('clause 6 not implementable against the store as it stands');
      return { pass: false, itemsChecked: 0 };
    }
    console.log(`Archetypes with readable slot definitions: ${archetypeSlotKeys.size}`);

    const contentObjects = loadJsonIfExists(path.join(enDir, 'contentObjects.json')) || [];
    const articles = loadJsonIfExists(path.join(enDir, 'articles.json')) || [];
    const blocks = loadJsonIfExists(path.join(enDir, 'blocks.json')) || [];
    const pages = contentObjects.filter(o => o._type === 'page');

    // pageKey -> Set(_skeletonKey) of blocks on the matched page(s), or
    // null if no page in contentObjects.json matches this pageKey at all
    // (distinct from a matched page that simply has zero blocks).
    const pageSkeletonKeysCache = new Map();
    function getPageSkeletonKeys(pageKey) {
      if (pageSkeletonKeysCache.has(pageKey)) return pageSkeletonKeysCache.get(pageKey);
      const matchedPages = pages.filter(p => matchesPageKey(p._id, matchSlug, pageKey));
      let result;
      if (matchedPages.length === 0) {
        result = null;
      } else {
        const pageIds = new Set(matchedPages.map(p => p._id));
        const articleIds = new Set(articles.filter(a => pageIds.has(a._parentId)).map(a => a._id));
        const pageBlocks = blocks.filter(b => articleIds.has(b._parentId));
        result = new Set(pageBlocks.filter(b => b._skeletonKey).map(b => b._skeletonKey));
      }
      pageSkeletonKeysCache.set(pageKey, result);
      return result;
    }

    const instantiations = courseDesign.instantiations || [];
    let itemsChecked = 0;
    const archUnresolved = [];   // slotKey invalid against its archetype
    const blockMissing = [];     // slotKey valid against archetype, no built block carries it
    const uncheckableBlockLevel = []; // page itself not found in contentObjects.json - cannot attempt the block-level check at all
    for (const inst of instantiations) {
      const archetypeId = inst.archetype && inst.archetype.id;
      const slotChoices = inst.slotChoices || [];
      if (slotChoices.length === 0) continue;
      const pageSkeletonKeys = getPageSkeletonKeys(inst.pageKey);
      for (const sc of slotChoices) {
        itemsChecked++;
        const validKeys = archetypeSlotKeys.get(archetypeId);
        const archOk = !!(validKeys && validKeys.has(sc.slotKey));
        if (!validKeys) {
          archUnresolved.push({ pageKey: inst.pageKey, archetypeId, slotKey: sc.slotKey, reason: 'archetype not found in skeletons store' });
        } else if (!archOk) {
          archUnresolved.push({ pageKey: inst.pageKey, archetypeId, slotKey: sc.slotKey, reason: 'slotKey not in archetype' });
        }

        if (pageSkeletonKeys === null) {
          uncheckableBlockLevel.push({ pageKey: inst.pageKey, slotKey: sc.slotKey, reason: 'no page in contentObjects.json matches this pageKey (bare or slug-prefixed) - block-level match cannot be attempted' });
          continue;
        }
        const blockOk = pageSkeletonKeys.has(sc.slotKey);
        if (archOk && !blockOk) {
          blockMissing.push({ pageKey: inst.pageKey, archetypeId, slotKey: sc.slotKey, reason: 'slotKey resolves against its archetype, but no built block on the matched page carries a matching _skeletonKey' });
        }
      }
    }

    console.log(`Checked ${itemsChecked} slotChoices entries across ${instantiations.length} instantiations`);
    if (archUnresolved.length > 0) {
      console.log(`Unresolved against archetype (${archUnresolved.length}):`);
      archUnresolved.forEach(u => console.log(`  - pageKey=${u.pageKey} archetype=${u.archetypeId} slotKey="${u.slotKey}" (${u.reason})`));
    } else {
      console.log('Every slotChoices[].slotKey resolves against its archetype.');
    }
    if (blockMissing.length > 0) {
      console.log(`Resolves against archetype but no matching built block (${blockMissing.length}):`);
      blockMissing.forEach(u => console.log(`  - pageKey=${u.pageKey} archetype=${u.archetypeId} slotKey="${u.slotKey}"`));
    } else {
      console.log('Every archetype-valid slotKey has a matching built block on its page.');
    }
    if (uncheckableBlockLevel.length > 0) {
      console.log(`Cannot check block-level match, page not locatable (${uncheckableBlockLevel.length}) - reported, not counted as failures:`);
      uncheckableBlockLevel.forEach(u => console.log(`  - pageKey=${u.pageKey} slotKey="${u.slotKey}"`));
    }
    return { pass: archUnresolved.length === 0 && blockMissing.length === 0, itemsChecked };
  });

  // ---- Clause 7: lesson-key numbering (LN-1) ----
  // LN-1 (docs/project/open-decisions.md, 19 Sep 2026): a course's
  // first lesson is L01, and lesson keys run consecutively from
  // there with no gaps. Reads the same A3 decidedValue.lessons[]
  // list clause 1 reads, and the same bare/slug-prefixed pageKey
  // derivation clause 1 uses. Non-numeric structural pages (W-OPEN,
  // C-PRE, SUMM, C-POST, W-CLOSE) are not part of A3's lessons[]
  // list and are not this clause's concern.
  clause('7. Lesson-key numbering (LN-1: L01-first, no gaps)', () => {
    if (!courseDesign) {
      console.log(`No course-design file at ${path.relative(ROOT, courseDesignPath)}`);
      return { pass: false, itemsChecked: 0 };
    }
    const gates = courseDesign.gates || [];
    const map = gates.find(g => g.gateId === 'crs-04_lesson-map');
    if (!map || !Array.isArray(map.records) || map.records.length === 0) {
      console.log('No crs-04_lesson-map record found (lesson list unavailable)');
      return { pass: false, itemsChecked: 0 };
    }
    const lastMap = map.records[map.records.length - 1];
    const lessons = (lastMap.decidedValue && lastMap.decidedValue.lessons) || [];
    console.log(`Lesson map: ${lessons.length} lessons`);

    let itemsChecked = 0;
    const malformed = [];
    const numbers = [];
    for (const lesson of lessons) {
      itemsChecked++;
      const bareKey = lessonBareKey(lesson);
      if (bareKey === null) {
        malformed.push(`lesson missing "key" (title "${lesson.title || '?'}")`);
        continue;
      }
      const m = /^L(\d+)$/.exec(bareKey);
      if (!m) {
        malformed.push(bareKey);
        continue;
      }
      numbers.push(parseInt(m[1], 10));
    }
    console.log(`Checked ${itemsChecked} lesson key values`);

    if (malformed.length > 0) {
      console.log(`key values not matching the L<NN> lesson-key form (${malformed.length}):`);
      malformed.forEach(pk => console.log(`  - ${pk}`));
    }

    numbers.sort((a, b) => a - b);
    const distinct = [...new Set(numbers)];
    const hasDuplicates = numbers.length !== distinct.length;
    const startsAtOne = distinct.length > 0 && distinct[0] === 1;
    const noGaps = distinct.every((n, i) => n === i + 1);

    if (distinct.length > 0) {
      console.log(`Lesson numbers found: ${distinct.map(n => `L${String(n).padStart(2, '0')}`).join(', ')}`);
    }
    if (hasDuplicates) {
      console.log('Duplicate lesson numbers found among lesson-map lessons.');
    }
    if (distinct.length > 0 && !startsAtOne) {
      console.log(`First lesson number is L${String(distinct[0]).padStart(2, '0')}, not L01.`);
    }
    if (distinct.length > 0 && !noGaps) {
      const missing = [];
      for (let n = 1; n < distinct[distinct.length - 1]; n++) {
        if (!distinct.includes(n)) missing.push(n);
      }
      console.log(`Gap(s) in lesson numbering: missing ${missing.map(n => `L${String(n).padStart(2, '0')}`).join(', ')}`);
    }
    const pass = malformed.length === 0 && !hasDuplicates && startsAtOne && noGaps;
    if (pass) {
      console.log('Lesson keys start at L01 and run consecutively with no gaps (LN-1).');
    }
    return { pass, itemsChecked };
  });

  // ---- Lesson-level checks (LCR-1) ----
  // docs/project/open-decisions.md LCR-1 (Prompt 143), built Prompt 146.
  // Extended 21 Sep 2026 (Prompt 147): CP-1h's wait gate and CK-1's
  // coupling test fixed, PSR-1 added. Extended 25 Sep 2026 (AL-3, AL-4,
  // docs/project/open-decisions.md, Prompt 173): CK-1 aligned to
  // exactly two items; AL-3a, AL-3b and AL-4 added. Thirteen checks
  // (recounted directly against lessonCheck() calls and IIFE checks,
  // not carried forward from this comment's own prior figure), reached
  // through verify-course.js's call to this tool at
  // /land's verification step. Four outcomes, only one of which fails
  // this tool's own exit code:
  //   PASS               - the check id and how many items it checked.
  //   FAIL               - the lesson, the check id, what failed. Makes
  //                        this tool exit non-zero.
  //   NOT YET REACHABLE  - the check id and the gate it waits on. Never
  //                        printed as a pass; never fails the run.
  //                        Without this, closing crs-04_lesson-map would
  //                        fail every lesson-level check because no
  //                        les-01 has run yet.
  //   EXEMPT             - the lesson, the check id, Abbott's reason,
  //                        printed on every run (EX-1; course-design
  //                        record's top-level exemptions[] array, shape
  //                        fixed at schemas/course-design.schema.json's
  //                        "exemptions" property).
  // A subject whose gate HAS closed but which finds nothing to check
  // (crs-04_lesson-map closed but 0 lessons) is a FAIL, not a vacuous
  // pass - the same zero-items rule clauses 1-7 above already enforce.
  //
  // "Closed" here reads a gate record's own state field
  // (schemas/common.schema.json #/$defs/gateState: pending, proposed,
  // assumed, closed, deferred, skipped) - distinct from clause 1 above,
  // which only asks whether a record exists at all, in any state.
  const lessonCheckResults = [];

  function gateRecordsFor(gateId) {
    const gates = (courseDesign && courseDesign.gates) || [];
    const g = gates.find(x => x.gateId === gateId);
    return (g && Array.isArray(g.records)) ? g.records : [];
  }

  function lastGateRecord(gateId) {
    const records = gateRecordsFor(gateId);
    return records.length ? records[records.length - 1] : null;
  }

  function gateClosed(gateId) {
    const rec = lastGateRecord(gateId);
    return !!(rec && rec.state === 'closed');
  }

  // LK-1 (design-kb.gates.json, crs-04_lesson-map decidedValueShape): the
  // lesson field is "key", required string, equal to that lesson's page's
  // pageKey in instantiations[] - not "pageKey" itself, which lesson-map
  // lesson objects never carry. Returns null, never '', when a lesson has
  // no key, so every caller fails that item by name rather than silently
  // matching against an empty string.
  function lessonBareKey(lesson) {
    const key = lesson.key;
    if (typeof key !== 'string' || key.length === 0) return null;
    return key.startsWith(`${matchSlug}-`) ? key.slice(matchSlug.length + 1) : key;
  }

  function exemptionFor(lessonId, checkId) {
    const exemptions = (courseDesign && courseDesign.exemptions) || [];
    return exemptions.find(e => e.lessonId === lessonId && e.check === checkId) || null;
  }

  function lessonMapClosed() {
    // Six-phase model: the lesson list is crs-04_lesson-map, not gates/A3.
    const rec = lastGateRecord('crs-04_lesson-map');
    if (!rec || rec.state !== 'closed') return { closed: false, lessons: [] };
    return { closed: true, lessons: (rec.decidedValue && rec.decidedValue.lessons) || [] };
  }

  // A per-lesson check. waitGate(lesson, bareKey) names the gate id this
  // lesson's data depends on, OR an array of gate ids when more than
  // one gate must close first (extended 21 Sep 2026, Prompt 147, for
  // CP-1h). evaluate(lesson, bareKey, gateRecord) returns {pass, detail}
  // once every named gate has closed for this lesson.
  function lessonCheck(checkId, title, waitGate, evaluate) {
    console.log('='.repeat(60));
    console.log(`LESSON CHECK: ${checkId} - ${title}`);
    console.log('='.repeat(60));

    if (!courseDesign) {
      console.log(`No course-design file at ${path.relative(ROOT, courseDesignPath)}`);
      console.log('RESULT: FAIL (0 items checked)');
      console.log('');
      lessonCheckResults.push({ name: checkId, status: 'FAIL' });
      return;
    }

    const { closed: mapClosed, lessons } = lessonMapClosed();
    if (!mapClosed) {
      console.log(`NOT YET REACHABLE: ${checkId} waits on crs-04_lesson-map`);
      console.log('RESULT: NOT YET REACHABLE (0 items checked)');
      console.log('');
      lessonCheckResults.push({ name: checkId, status: 'NOT_YET_REACHABLE' });
      return;
    }
    if (lessons.length === 0) {
      console.log(`FAIL: ${checkId} - crs-04_lesson-map closed but 0 lessons found; nothing to check`);
      console.log('RESULT: FAIL (0 items checked)');
      console.log('');
      lessonCheckResults.push({ name: checkId, status: 'FAIL' });
      return;
    }

    let itemsChecked = 0;
    let exemptedCount = 0;
    let notReachableCount = 0;
    let anyFail = false;

    for (const lesson of lessons) {
      const bareKey = lessonBareKey(lesson);
      if (bareKey === null) {
        anyFail = true;
        itemsChecked++;
        console.log(`FAIL: ${checkId} - lesson missing "key" (title "${lesson.title || '?'}")`);
        continue;
      }
      const lessonId = bareKey;
      const exemption = exemptionFor(lessonId, checkId);
      if (exemption) {
        exemptedCount++;
        console.log(`EXEMPT: ${lessonId} ${checkId} - ${exemption.reason}`);
        continue;
      }
      const waited = waitGate(lesson, bareKey);
      const gateIds = Array.isArray(waited) ? waited : [waited];
      const openGates = gateIds.filter(gid => !gateClosed(gid));
      if (openGates.length > 0) {
        notReachableCount++;
        console.log(`NOT YET REACHABLE: ${lessonId} ${checkId} waits on ${openGates.join(', ')}`);
        continue;
      }
      const gateRecord = lastGateRecord(gateIds[gateIds.length - 1]);
      itemsChecked++;
      const r = evaluate(lesson, bareKey, gateRecord);
      if (r.pass) {
        console.log(`PASS: ${lessonId} ${checkId} - ${r.detail}`);
      } else {
        anyFail = true;
        console.log(`FAIL: ${lessonId} ${checkId} - ${r.detail}`);
      }
    }

    let status;
    if (anyFail) status = 'FAIL';
    else if (itemsChecked > 0) status = 'PASS';
    else if (exemptedCount > 0 && notReachableCount === 0) status = 'PASS';
    else status = 'NOT_YET_REACHABLE';

    console.log(`RESULT: ${status.replace(/_/g, ' ')} (${itemsChecked} items checked)`);
    console.log('');
    lessonCheckResults.push({ name: checkId, status });
  }

  // ---- OC-1: learning outcomes and lesson frame (crs-04_lesson-map) ----
  // Lesson outcomes live in the lesson map (A6.1), not a per-lesson gate;
  // the lesson object the harness passes carries them. The old "exactly 3
  // or an outcomeCountReason" rule was a per-lesson B1 field that crs-04
  // lessons do not carry, so it no longer applies per lesson.
  lessonCheck(
    'OC-1',
    'Learning outcomes and lesson frame',
    () => 'crs-04_lesson-map',
    (lesson) => {
      const outcomes = Array.isArray(lesson.outcomes) ? lesson.outcomes : [];
      if (outcomes.length === 0) {
        return { pass: false, detail: 'no outcomes' };
      }
      const bad = outcomes.filter(o => !o || typeof o.id !== 'string' || typeof o.text !== 'string');
      if (bad.length > 0) {
        return { pass: false, detail: `${bad.length} outcome(s) missing id/text` };
      }
      return { pass: true, detail: `${outcomes.length} outcomes` };
    }
  );

  // ---- CO-1: course outcomes served, both halves ----
  // Six-phase model (8 Oct 2026): course outcomes live in
  // crs-03_course-outcomes; lesson outcomes (with their "serves") live in
  // crs-04_lesson-map's lessons[].outcomes (A6.1), a single course-level
  // record, so there is no per-lesson B1 to wait on - once crs-03 and
  // crs-04 are both closed every lesson outcome's serves is available.
  // Half 1: each serves names a real course outcome. Half 2: every course
  // outcome is served by at least one lesson outcome.
  (function () {
    const checkId = 'CO-1';
    console.log('='.repeat(60));
    console.log(`LESSON CHECK: ${checkId} - Course outcomes served`);
    console.log('='.repeat(60));
    if (!courseDesign) {
      console.log(`No course-design file at ${path.relative(ROOT, courseDesignPath)}`);
      console.log('RESULT: FAIL (0 items checked)');
      console.log('');
      lessonCheckResults.push({ name: checkId, status: 'FAIL' });
      return;
    }
    const coRec = lastGateRecord('crs-03_course-outcomes');
    const mapRec = lastGateRecord('crs-04_lesson-map');
    if (!coRec || coRec.state !== 'closed' || !mapRec || mapRec.state !== 'closed') {
      const waitOn = (!coRec || coRec.state !== 'closed') ? 'crs-03_course-outcomes' : 'crs-04_lesson-map';
      console.log(`NOT YET REACHABLE: ${checkId} waits on ${waitOn}`);
      console.log('RESULT: NOT YET REACHABLE (0 items checked)');
      console.log('');
      lessonCheckResults.push({ name: checkId, status: 'NOT_YET_REACHABLE' });
      return;
    }
    const courseOutcomes = Array.isArray(coRec.decidedValue && coRec.decidedValue.courseOutcomes) ? coRec.decidedValue.courseOutcomes : [];
    const lessons = Array.isArray(mapRec.decidedValue && mapRec.decidedValue.lessons) ? mapRec.decidedValue.lessons : [];
    if (courseOutcomes.length === 0 || lessons.length === 0) {
      const why = courseOutcomes.length === 0 ? 'zero courseOutcomes (crs-03)' : 'zero lessons (crs-04)';
      console.log(`FAIL: ${checkId} - closed but ${why}; nothing to check`);
      console.log('RESULT: FAIL (0 items checked)');
      console.log('');
      lessonCheckResults.push({ name: checkId, status: 'FAIL' });
      return;
    }
    const coIds = new Set(courseOutcomes.map(co => co.id));
    let itemsChecked = 0;
    let anyFail = false;
    const servedCoIds = new Set();
    for (const lesson of lessons) {
      const bareKey = lessonBareKey(lesson);
      if (bareKey === null) {
        anyFail = true;
        console.log(`FAIL: ${checkId} - lesson missing "key" (title "${lesson.title || '?'}")`);
        continue;
      }
      const lessonId = bareKey;
      const exemption = exemptionFor(lessonId, checkId);
      const outcomes = Array.isArray(lesson.outcomes) ? lesson.outcomes : [];
      for (const outcome of outcomes) {
        itemsChecked++;
        const valid = !!(outcome.serves && coIds.has(outcome.serves));
        if (!valid && exemption) {
          console.log(`EXEMPT: ${lessonId} ${checkId} - outcome ${outcome.id || '?'} serves "${outcome.serves}" - ${exemption.reason}`);
        } else if (!valid) {
          anyFail = true;
          console.log(`FAIL: ${lessonId} ${checkId} - outcome ${outcome.id || '?'} serves "${outcome.serves}" which is not a course outcome id`);
        } else {
          servedCoIds.add(outcome.serves);
          console.log(`PASS: ${lessonId} ${checkId} - outcome ${outcome.id || '?'} serves ${outcome.serves}`);
        }
      }
    }
    // Every course outcome served: reachable now, since crs-04 holds every
    // lesson's outcomes in one record (no per-lesson gate to wait on).
    itemsChecked++;
    const unserved = courseOutcomes.filter(co => !servedCoIds.has(co.id));
    if (unserved.length > 0) {
      anyFail = true;
      console.log(`FAIL: ${checkId} - course outcome(s) not served by any lesson: ${unserved.map(co => co.id).join(', ')}`);
    } else {
      console.log(`PASS: ${checkId} - every course outcome is served by at least one lesson outcome`);
    }
    let status;
    if (anyFail) status = 'FAIL';
    else if (itemsChecked > 0) status = 'PASS';
    else status = 'NOT_YET_REACHABLE';
    console.log(`RESULT: ${status.replace(/_/g, ' ')} (${itemsChecked} items checked)`);
    console.log('');
    lessonCheckResults.push({ name: checkId, status });
  })();

  // ---- AL-3b: summative items test each course outcome twice ----
  // AL-3 / AL-6 (docs/project/open-decisions.md, Prompt 173): once
  // wra-03_summative closes, every course outcome from crs-03_course-outcomes
  // is named by at least two summative items' `tests`, and every item's
  // `tests` names a real course outcome. Course-level, not per lesson:
  // modelled on CO-1's IIFE shape above, not lessonCheck(), because it
  // waits on a single course-level gate rather than a per-lesson one.
  // Six-phase migration 8 Oct 2026 (was gates/A3 + act-04).
  (function () {
    const checkId = 'AL-3b';
    console.log('='.repeat(60));
    console.log(`LESSON CHECK: ${checkId} - Summative items test each course outcome twice`);
    console.log('='.repeat(60));
    if (!courseDesign) {
      console.log(`No course-design file at ${path.relative(ROOT, courseDesignPath)}`);
      console.log('RESULT: FAIL (0 items checked)');
      console.log('');
      lessonCheckResults.push({ name: checkId, status: 'FAIL' });
      return;
    }
    const coRec = lastGateRecord('crs-03_course-outcomes');
    if (!coRec || coRec.state !== 'closed') {
      console.log(`NOT YET REACHABLE: ${checkId} waits on crs-03_course-outcomes`);
      console.log('RESULT: NOT YET REACHABLE (0 items checked)');
      console.log('');
      lessonCheckResults.push({ name: checkId, status: 'NOT_YET_REACHABLE' });
      return;
    }
    const courseOutcomes = Array.isArray(coRec.decidedValue && coRec.decidedValue.courseOutcomes)
      ? coRec.decidedValue.courseOutcomes : [];
    if (courseOutcomes.length === 0) {
      console.log(`FAIL: ${checkId} - crs-03_course-outcomes closed but 0 courseOutcomes; nothing to check`);
      console.log('RESULT: FAIL (0 items checked)');
      console.log('');
      lessonCheckResults.push({ name: checkId, status: 'FAIL' });
      return;
    }
    // Summative items are authored by wra-03_summative (old act-04), one
    // record carrying items[].tests (AL-6), six-phase migration 8 Oct 2026.
    const s1Rec = lastGateRecord('wra-03_summative');
    if (!s1Rec || s1Rec.state !== 'closed') {
      console.log(`NOT YET REACHABLE: ${checkId} waits on wra-03_summative`);
      console.log('RESULT: NOT YET REACHABLE (0 items checked)');
      console.log('');
      lessonCheckResults.push({ name: checkId, status: 'NOT_YET_REACHABLE' });
      return;
    }
    const coIds = new Set(courseOutcomes.map(co => co.id));
    const items = Array.isArray(s1Rec.decidedValue && s1Rec.decidedValue.items) ? s1Rec.decidedValue.items : [];
    let itemsChecked = 0;
    let anyFail = false;
    const countByOutcome = new Map();
    for (const item of items) {
      itemsChecked++;
      const t = item && item.tests;
      if (!t || !coIds.has(t)) {
        anyFail = true;
        console.log(`FAIL: ${checkId} - item tests "${t}" which is not a course outcome id`);
        continue;
      }
      countByOutcome.set(t, (countByOutcome.get(t) || 0) + 1);
      console.log(`PASS: ${checkId} - item tests ${t}`);
    }
    itemsChecked++;
    const short = courseOutcomes.filter(co => (countByOutcome.get(co.id) || 0) < 2);
    if (short.length > 0) {
      anyFail = true;
      console.log(`FAIL: ${checkId} - course outcome(s) with fewer than two summative items: ${short.map(co => `${co.id} (${countByOutcome.get(co.id) || 0})`).join(', ')}`);
    } else {
      console.log(`PASS: ${checkId} - every course outcome is tested by at least two summative items`);
    }
    let status;
    if (anyFail) status = 'FAIL';
    else if (itemsChecked > 0) status = 'PASS';
    else status = 'NOT_YET_REACHABLE';
    console.log(`RESULT: ${status.replace(/_/g, ' ')} (${itemsChecked} items checked)`);
    console.log('');
    lessonCheckResults.push({ name: checkId, status });
  })();

  // ---- AL-4: confidence statements rate each course outcome (crs-03) ----
  // AL-4 (docs/project/open-decisions.md, Prompt 173): every course outcome
  // carries a confidence statement. Six-phase model (8 Oct 2026): the
  // statements live on crs-03's own courseOutcomeBanks, one bank per outcome
  // keyed by outcomeId (confidence moved onto crs-03's banks from the retired
  // act-02 gate), so AL-4 is now an intra-crs-03 check: every
  // courseOutcomes[].id must appear as a courseOutcomeBanks[].outcomeId.
  (function () {
    const checkId = 'AL-4';
    console.log('='.repeat(60));
    console.log(`LESSON CHECK: ${checkId} - Confidence statements rate each course outcome`);
    console.log('='.repeat(60));
    if (!courseDesign) {
      console.log(`No course-design file at ${path.relative(ROOT, courseDesignPath)}`);
      console.log('RESULT: FAIL (0 items checked)');
      console.log('');
      lessonCheckResults.push({ name: checkId, status: 'FAIL' });
      return;
    }
    const coRec = lastGateRecord('crs-03_course-outcomes');
    if (!coRec || coRec.state !== 'closed') {
      console.log(`NOT YET REACHABLE: ${checkId} waits on crs-03_course-outcomes`);
      console.log('RESULT: NOT YET REACHABLE (0 items checked)');
      console.log('');
      lessonCheckResults.push({ name: checkId, status: 'NOT_YET_REACHABLE' });
      return;
    }
    const courseOutcomes = Array.isArray(coRec.decidedValue && coRec.decidedValue.courseOutcomes)
      ? coRec.decidedValue.courseOutcomes : [];
    if (courseOutcomes.length === 0) {
      console.log(`FAIL: ${checkId} - crs-03_course-outcomes closed but 0 courseOutcomes; nothing to check`);
      console.log('RESULT: FAIL (0 items checked)');
      console.log('');
      lessonCheckResults.push({ name: checkId, status: 'FAIL' });
      return;
    }
    const coIds = new Set(courseOutcomes.map(co => co.id));
    const banks = Array.isArray(coRec.decidedValue && coRec.decidedValue.courseOutcomeBanks) ? coRec.decidedValue.courseOutcomeBanks : [];
    let itemsChecked = 0;
    let anyFail = false;
    const ratedOutcomes = new Set();
    for (const bank of banks) {
      itemsChecked++;
      const r = bank && bank.outcomeId;
      if (!r || !coIds.has(r)) {
        anyFail = true;
        console.log(`FAIL: ${checkId} - courseOutcomeBank rates "${r}" which is not a course outcome id`);
        continue;
      }
      ratedOutcomes.add(r);
      console.log(`PASS: ${checkId} - courseOutcomeBank rates ${r}`);
    }
    itemsChecked++;
    const unrated = courseOutcomes.filter(co => !ratedOutcomes.has(co.id));
    if (unrated.length > 0) {
      anyFail = true;
      console.log(`FAIL: ${checkId} - course outcome(s) rated by no statement: ${unrated.map(co => co.id).join(', ')}`);
    } else {
      console.log(`PASS: ${checkId} - every course outcome is rated by at least one statement`);
    }
    let status;
    if (anyFail) status = 'FAIL';
    else if (itemsChecked > 0) status = 'PASS';
    else status = 'NOT_YET_REACHABLE';
    console.log(`RESULT: ${status.replace(/_/g, ' ')} (${itemsChecked} items checked)`);
    console.log('');
    lessonCheckResults.push({ name: checkId, status });
  })();

  // ---- BKS-1: source sections resolve in the source map (A3) ----
  // Directory-scan of source-kb/source-maps/*.json keyed by each file's
  // own sourceId field, the same pattern validate-design-schemas.py's
  // validate_source_maps() uses.
  let sourceMapsCache = null;
  function loadSourceMaps() {
    if (sourceMapsCache) return sourceMapsCache;
    sourceMapsCache = new Map(); // sourceId -> Map(chunkId -> chunk)
    const mapsDir = path.join(ROOT, 'source-kb', 'source-maps');
    if (!fs.existsSync(mapsDir)) return sourceMapsCache;
    const files = fs.readdirSync(mapsDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const data = loadJsonIfExists(path.join(mapsDir, f));
      if (!data || !data.sourceId || !Array.isArray(data.chunks)) continue;
      const chunkMap = new Map(data.chunks.map(c => [c.id, c]));
      sourceMapsCache.set(data.sourceId, chunkMap);
    }
    return sourceMapsCache;
  }

  lessonCheck(
    'BKS-1',
    'Source sections resolve in the source map',
    () => 'crs-04_lesson-map',
    (lesson) => {
      const sourceSections = Array.isArray(lesson.sourceSections) ? lesson.sourceSections : [];
      if (sourceSections.length === 0) {
        return { pass: false, detail: 'no sourceSections' };
      }
      const sourceMaps = loadSourceMaps();
      const problems = [];
      for (const section of sourceSections) {
        const chunkMap = sourceMaps.get(section.sourceId);
        if (!chunkMap) {
          problems.push(`sourceId "${section.sourceId}" has no source map`);
          continue;
        }
        const chunk = chunkMap.get(section.chunkId);
        if (!chunk) {
          problems.push(`chunkId "${section.chunkId}" not found in ${section.sourceId}`);
          continue;
        }
        if (chunk.status !== 'confirmed') {
          problems.push(`chunkId "${section.chunkId}" has status "${chunk.status}", not "confirmed"`);
        }
        if (chunk.heading !== section.heading) {
          problems.push(`chunkId "${section.chunkId}" heading mismatch: map has "${chunk.heading}", lesson has "${section.heading}"`);
        }
        const mapPages = chunk.locator && chunk.locator.pages;
        if (mapPages !== section.pages) {
          problems.push(`chunkId "${section.chunkId}" pages mismatch: map has "${mapPages}", lesson has "${section.pages}"`);
        }
      }
      if (problems.length > 0) {
        return { pass: false, detail: problems.join('; ') };
      }
      return { pass: true, detail: `${sourceSections.length} sourceSections resolved` };
    }
  );

  // ---- Shared helper: items[] against a slot's positionRules[] ----
  // Added 21 Sep 2026 (Prompt 147, PSR-1), shared by CK-1 and PSR-1:
  // "Lesson checks read position rules from this field, never from
  // hard-coded values." Reads design-kb.skeletons.json's own
  // archetypes[].blockSequence[].slot.positionRules, never a
  // hard-coded value.
  const LESSON_ARCHETYPE_ID = 'skeletons/lesson';
  // Six-phase model (8 Oct 2026): all per-lesson slot items live in the
  // single consolidated les-01_lesson-proposal record. Today only the
  // "check" slot has decided-item data recorded, at
  // decidedValue.check.items. Any other slot that gains positionRules in
  // the store has no known items path here, so PSR-1 fails it as carrying
  // positionRules with no gate recording its items, rather than waiting on
  // a gate that does not exist for it.
  const PSR1_SLOT_ITEMS_GATE = { check: 'les-01' };
  // Extract a slot's items[] from a closed les-01 decidedValue.
  function les01SlotItems(dv, slotKey) {
    if (slotKey === 'check') {
      return (dv && dv.check && Array.isArray(dv.check.items)) ? dv.check.items : [];
    }
    return [];
  }

  let archetypePositionRulesCache = null;
  function loadArchetypePositionRules() {
    if (archetypePositionRulesCache) return archetypePositionRulesCache;
    archetypePositionRulesCache = new Map(); // archetypeId -> Map(slotKey -> positionRules[])
    const skeletonsPath = path.join(ROOT, 'design-kb', 'design-kb.skeletons.json');
    const skeletons = loadJsonIfExists(skeletonsPath);
    if (!skeletons || !Array.isArray(skeletons.archetypes)) return archetypePositionRulesCache;
    for (const arch of skeletons.archetypes) {
      if (!Array.isArray(arch.blockSequence)) continue;
      const slotMap = new Map();
      for (const b of arch.blockSequence) {
        if (b && b.slot && Array.isArray(b.slot.positionRules)) {
          slotMap.set(b.key, b.slot.positionRules);
        }
      }
      archetypePositionRulesCache.set(arch.id, slotMap);
    }
    return archetypePositionRulesCache;
  }

  function getLessonArchetypePositionRules() {
    return loadArchetypePositionRules().get(LESSON_ARCHETYPE_ID) || new Map();
  }

  // Checks a recorded items[] list against one slot's positionRules[].
  // Each rule names a position (a 1-based number, or "rest" for every
  // position not named individually) and the contextCoupling values
  // that position's item is allowed to carry. Returns an array of
  // problem strings, empty when every item matches its position's rule.
  function checkItemsAgainstPositionRules(items, positionRules) {
    const problems = [];
    items.forEach((item, idx) => {
      const positionNumber = idx + 1;
      const rule = positionRules.find(r => r.position === positionNumber)
        || positionRules.find(r => r.position === 'rest');
      if (!rule) {
        problems.push(`position ${positionNumber} has no matching positionRules entry`);
        return;
      }
      const coupling = item && item.coupling;
      if (!rule.contextCoupling.includes(coupling)) {
        problems.push(`position ${positionNumber} coupling is "${coupling}", not one of [${rule.contextCoupling.join(', ')}]`);
      }
    });
    return problems;
  }

  // ---- CK-1: check-slot coupling pattern (B4) ----
  // Fixed 21 Sep 2026 (Prompt 147): reads the "check" slot's
  // positionRules from design-kb.skeletons.json via the shared helper
  // above, replacing the earlier hard-coded "first item coupling none"
  // test. Aligned to exactly three items 9 October 2026 (AL-3, three
  // learning outcomes per lesson, one check item per outcome; see
  // docs/authoring/token-substitution-coupling-and-three-outcome-model.md):
  // a lesson's check has exactly three questions, one per lesson outcome.
  lessonCheck(
    'CK-1',
    'Check-slot coupling pattern',
    (lesson, bareKey) => `${matchSlug}-${bareKey}-les-01`,
    (lesson, bareKey, gateRecord) => {
      const dv = gateRecord.decidedValue || {};
      const items = les01SlotItems(dv, 'check');
      if (items.length !== 3) {
        return { pass: false, detail: `check item count ${items.length}, not 3` };
      }
      const positionRules = getLessonArchetypePositionRules().get('check');
      if (!positionRules) {
        return { pass: false, detail: '"check" slot has no positionRules in design-kb.skeletons.json' };
      }
      const problems = checkItemsAgainstPositionRules(items, positionRules);
      if (problems.length > 0) {
        return { pass: false, detail: problems.join('; ') };
      }
      return { pass: true, detail: `${items.length} items, coupling pattern correct per positionRules` };
    }
  );

  // ---- AL-3a: check items test named, different lesson outcomes ----
  // AL-3 / AL-6 (9 Oct 2026, three-outcome model; see
  // docs/authoring/token-substitution-coupling-and-three-outcome-model.md):
  // les-01's three check items each record `tests`, naming a lesson outcome
  // id present in this lesson's crs-04_lesson-map entry, the three `tests`
  // values distinct and together covering all three lesson outcomes (one
  // item per outcome). Lesson outcomes live in the crs-04 lesson object;
  // the check items live in les-01.check.items.
  lessonCheck(
    'AL-3a',
    'Check items test named, different lesson outcomes',
    (lesson, bareKey) => `${matchSlug}-${bareKey}-les-01`,
    (lesson, bareKey, gateRecord) => {
      const outcomeIds = new Set(
        (Array.isArray(lesson.outcomes) ? lesson.outcomes : []).map(o => o.id)
      );
      const items = les01SlotItems(gateRecord.decidedValue || {}, 'check');
      if (items.length !== 3) {
        return { pass: false, detail: `check item count ${items.length}, not 3` };
      }
      const tests = items.map(i => i && i.tests);
      const problems = [];
      tests.forEach((t, idx) => {
        if (!t || !outcomeIds.has(t)) {
          problems.push(`item ${idx + 1} tests "${t}" which is not a lesson outcome id in this lesson's crs-04 entry`);
        }
      });
      if (problems.length === 0 && new Set(tests).size !== 3) {
        problems.push(`the three check items do not test three distinct outcomes (tests: ${tests.join(', ')})`);
      }
      if (problems.length === 0) {
        for (const oid of outcomeIds) {
          if (!tests.includes(oid)) {
            problems.push(`no check item tests lesson outcome "${oid}" (one item per outcome)`);
          }
        }
      }
      if (problems.length > 0) {
        return { pass: false, detail: problems.join('; ') };
      }
      return { pass: true, detail: `3 items, tests ${tests.join(', ')}, each a real and distinct lesson outcome` };
    }
  );

  // ---- PSR-1: position rules per archetype slot ----
  // Built 21 Sep 2026 (Prompt 147), its own check sharing the helper
  // above with CK-1. Runs the helper over every slot in the lesson
  // archetype that carries positionRules (today only "check"). A slot
  // with positionRules but no gate record holding items for it fails,
  // naming the slot, rather than being skipped.
  lessonCheck(
    'PSR-1',
    'Position rules per archetype slot',
    (lesson, bareKey) => {
      const slots = getLessonArchetypePositionRules();
      const gates = [];
      for (const slotKey of slots.keys()) {
        const gateSuffix = PSR1_SLOT_ITEMS_GATE[slotKey];
        if (gateSuffix) gates.push(`${matchSlug}-${bareKey}-${gateSuffix}`);
      }
      return gates;
    },
    (lesson, bareKey) => {
      const slots = getLessonArchetypePositionRules();
      const problems = [];
      let slotsChecked = 0;
      for (const [slotKey, positionRules] of slots.entries()) {
        const gateSuffix = PSR1_SLOT_ITEMS_GATE[slotKey];
        if (!gateSuffix) {
          problems.push(`slot "${slotKey}" carries positionRules but no gate record holds items for it`);
          continue;
        }
        const gateId = `${matchSlug}-${bareKey}-${gateSuffix}`;
        const rec = lastGateRecord(gateId);
        const dv = (rec && rec.decidedValue) || {};
        const items = les01SlotItems(dv, slotKey);
        if (items.length === 0) {
          problems.push(`slot "${slotKey}" carries positionRules but no gate record holds items for it`);
          continue;
        }
        slotsChecked++;
        const slotProblems = checkItemsAgainstPositionRules(items, positionRules);
        if (slotProblems.length > 0) {
          problems.push(`slot "${slotKey}": ${slotProblems.join('; ')}`);
        }
      }
      if (problems.length > 0) {
        return { pass: false, detail: problems.join(' | ') };
      }
      return { pass: true, detail: `${slotsChecked} positionRules-bearing slot(s) checked` };
    }
  );

  // ---- LPG-1: concept title is specific (B2) ----
  // "Internal slot name" is read from design-kb.skeletons.json's own
  // blockSequence[].key values across every archetype, never a
  // hard-coded list here - a conceptTitle that is literally e.g.
  // "worked-example" or "concept-intro" means a slot key leaked into the
  // title field rather than a human title being written.
  let skeletonBlockKeysCache = null;
  function loadSkeletonBlockKeys() {
    if (skeletonBlockKeysCache) return skeletonBlockKeysCache;
    skeletonBlockKeysCache = new Set();
    const skeletonsPath = path.join(ROOT, 'design-kb', 'design-kb.skeletons.json');
    const skeletons = loadJsonIfExists(skeletonsPath);
    if (!skeletons || !Array.isArray(skeletons.archetypes)) return skeletonBlockKeysCache;
    for (const arch of skeletons.archetypes) {
      if (!Array.isArray(arch.blockSequence)) continue;
      for (const b of arch.blockSequence) {
        if (b && typeof b === 'object' && typeof b.key === 'string') {
          skeletonBlockKeysCache.add(b.key);
        }
      }
    }
    return skeletonBlockKeysCache;
  }
  const LPG1_GENERIC_TITLES = new Set([
    'concept', 'key concept', 'the concept', 'key idea', 'introduction', 'overview'
  ]);

  lessonCheck(
    'LPG-1',
    'Concept title is specific',
    (lesson, bareKey) => `${matchSlug}-${bareKey}-les-01`,
    (lesson, bareKey, gateRecord) => {
      const dv = gateRecord.decidedValue || {};
      const title = typeof dv.conceptTitle === 'string' ? dv.conceptTitle.trim() : '';
      if (title === '') {
        return { pass: false, detail: 'conceptTitle is empty' };
      }
      const slotKeys = loadSkeletonBlockKeys();
      if (slotKeys.has(title)) {
        return { pass: false, detail: `conceptTitle "${title}" is an internal slot name from design-kb.skeletons.json` };
      }
      const normalized = title.toLowerCase().replace(/\s+/g, ' ').trim();
      if (LPG1_GENERIC_TITLES.has(normalized)) {
        return { pass: false, detail: `conceptTitle "${title}" is a generic placeholder title` };
      }
      return { pass: true, detail: `conceptTitle "${title}"` };
    }
  );

  // ---- RP-1: reflective-prompt slot choice (B5) ----
  // Reads instantiations[].slotChoices[] (not the gate's own
  // decidedValue) for the reflective-prompt slotKey, once B5 - the
  // gate that decides it per the golden fixture's decidedByGate -
  // closes for this lesson.
  lessonCheck(
    'RP-1',
    'Reflective-prompt slot choice',
    (lesson, bareKey) => `${matchSlug}-${bareKey}-les-01`,
    (lesson, bareKey, gateRecord) => {
      const instantiations = Array.isArray(courseDesign.instantiations) ? courseDesign.instantiations : [];
      const inst = instantiations.find(i => i.pageKey === lesson.key);
      if (!inst) {
        return { pass: false, detail: `no instantiations[] entry for pageKey "${lesson.key}"` };
      }
      const slotChoices = Array.isArray(inst.slotChoices) ? inst.slotChoices : [];
      const choice = slotChoices.find(sc => sc.slotKey === 'reflective-prompt');
      if (!choice) {
        return { pass: false, detail: 'no reflective-prompt slot choice in instantiations[].slotChoices[]' };
      }
      if (choice.component !== 'palette/opentext') {
        return { pass: false, detail: `reflective-prompt component is "${choice.component}", not "palette/opentext"` };
      }
      const coupled = !!(choice.contextCoupling && choice.contextCoupling.coupled);
      if (coupled) {
        return { pass: false, detail: 'reflective-prompt contextCoupling.coupled is true, not false' };
      }
      return { pass: true, detail: 'reflective-prompt is palette/opentext, coupling none' };
    }
  );

  // ---- CP-1h: lesson has a coupled slot ----
  // Derived from instantiations[].slotChoices[] as a whole for the
  // lesson, not any single gate's decidedValue. Six-phase model
  // (8 Oct 2026): every slot choice for a lesson is now made at the one
  // consolidated les-01_lesson-proposal gate (the old B2/B4/B5 slot
  // owners collapsed into it), so CP-1h waits on that single les-01
  // before reading the lesson's slotChoices.
  lessonCheck(
    'CP-1h',
    'Lesson has a coupled slot',
    (lesson, bareKey) => [
      `${matchSlug}-${bareKey}-les-01`
    ],
    (lesson) => {
      const instantiations = Array.isArray(courseDesign.instantiations) ? courseDesign.instantiations : [];
      const inst = instantiations.find(i => i.pageKey === lesson.key);
      if (!inst) {
        return { pass: false, detail: `no instantiations[] entry for pageKey "${lesson.key}"` };
      }
      const slotChoices = Array.isArray(inst.slotChoices) ? inst.slotChoices : [];
      if (slotChoices.length === 0) {
        return { pass: false, detail: 'no slot choices recorded' };
      }
      const anyCoupled = slotChoices.some(sc => sc.contextCoupling && sc.contextCoupling.coupled === true);
      if (!anyCoupled) {
        return { pass: false, detail: `no coupled slot among ${slotChoices.length} slot choices` };
      }
      return { pass: true, detail: `${slotChoices.length} slot choices, at least one coupled` };
    }
  );

  // ---- CP-1i: each wrapper page carries a coupled slot ----
  // open-decisions.md CP-1i (19 Sep 2026, Prompt 115): "Each wrapper page
  // carries one coupled prose block" (the practice-connection block), folded
  // into the wrapper default by CP-1k. Six-phase model (8 Oct 2026): that
  // coupling is deposited into instantiations[] by the wrapper gates
  // (wra-01_wrapper-open, wra-02_wrapper-close) at /land, so this reads the
  // wrapper pages' slotChoices[].contextCoupling there, not a retired A5
  // plan, and waits on both wrapper gates closing. Sibling to CP-1h (the
  // per-lesson coverage check); this is the wrapper half of the content-
  // stage coupling-coverage invariant the gate redesign deferred
  // (gate-redesign-2026-10-06.md). Distinct from MK-1 Part 2, which checks
  // the BUILT wrapper components' slot markers, not the instantiations[]
  // coupling record.
  (function () {
    const checkId = 'CP-1i';
    console.log('='.repeat(60));
    console.log(`LESSON CHECK: ${checkId} - Each wrapper page carries a coupled slot`);
    console.log('='.repeat(60));
    if (!courseDesign) {
      console.log(`No course-design file at ${path.relative(ROOT, courseDesignPath)}`);
      console.log('RESULT: FAIL (0 items checked)');
      console.log('');
      lessonCheckResults.push({ name: checkId, status: 'FAIL' });
      return;
    }
    const openClosed = gateClosed('wra-01_wrapper-open');
    const closeClosed = gateClosed('wra-02_wrapper-close');
    if (!openClosed || !closeClosed) {
      const waitOn = [
        openClosed ? null : 'wra-01_wrapper-open',
        closeClosed ? null : 'wra-02_wrapper-close'
      ].filter(Boolean).join(', ');
      console.log(`NOT YET REACHABLE: ${checkId} waits on ${waitOn}`);
      console.log('RESULT: NOT YET REACHABLE (0 items checked)');
      console.log('');
      lessonCheckResults.push({ name: checkId, status: 'NOT_YET_REACHABLE' });
      return;
    }
    const instantiations = Array.isArray(courseDesign.instantiations) ? courseDesign.instantiations : [];
    let itemsChecked = 0;
    let anyFail = false;
    // Both wrapper gates have closed, so both wrapper pages must be
    // instantiated and each must carry at least one coupled slot (CP-1i;
    // "both wrappers coupled").
    for (const pageType of ['wrapper-open', 'wrapper-close']) {
      itemsChecked++;
      const inst = instantiations.find(i => i && i.pageType === pageType);
      if (!inst) {
        anyFail = true;
        console.log(`FAIL: ${checkId} - ${pageType}: gate closed but no instantiations[] entry of this pageType`);
        continue;
      }
      const slotChoices = Array.isArray(inst.slotChoices) ? inst.slotChoices : [];
      const anyCoupled = slotChoices.some(sc => sc && sc.contextCoupling && sc.contextCoupling.coupled === true);
      if (!anyCoupled) {
        anyFail = true;
        console.log(`FAIL: ${checkId} - ${pageType} (pageKey "${inst.pageKey}"): no coupled slot among ${slotChoices.length} slot choice(s)`);
      } else {
        console.log(`PASS: ${checkId} - ${pageType} (pageKey "${inst.pageKey}"): at least one coupled slot`);
      }
    }
    let status;
    if (anyFail) status = 'FAIL';
    else if (itemsChecked > 0) status = 'PASS';
    else status = 'NOT_YET_REACHABLE';
    console.log(`RESULT: ${status.replace(/_/g, ' ')} (${itemsChecked} items checked)`);
    console.log('');
    lessonCheckResults.push({ name: checkId, status });
  })();

  // ---- PLR-1 (amended): Lesson Sources block cites chapter and pages (B1) ----
  // Reads the BUILT Lesson Sources block/component in en/blocks.json
  // and en/components.json (not a gate's decidedValue), once B1 lands
  // for the lesson, per the PLR-1 AMENDMENT (open-decisions.md,
  // 20 Sep 2026, Prompt 127): every lesson carries a references block
  // citing at least the chapter and page range of the source it draws
  // on; a lesson with no references entry, or a book citation with no
  // chapter and pages, fails.
  function findLessonReferenceItems(pageKey) {
    const contentObjects = loadJsonIfExists(path.join(enDir, 'contentObjects.json')) || [];
    const articles = loadJsonIfExists(path.join(enDir, 'articles.json')) || [];
    const blocks = loadJsonIfExists(path.join(enDir, 'blocks.json')) || [];
    const components = loadJsonIfExists(path.join(enDir, 'components.json')) || [];
    const pages = contentObjects.filter(o => o._type === 'page');
    const matchedPages = pages.filter(p => matchesPageKey(p._id, matchSlug, pageKey));
    if (matchedPages.length === 0) return null;
    const pageIds = new Set(matchedPages.map(p => p._id));
    const articleIds = new Set(articles.filter(a => pageIds.has(a._parentId)).map(a => a._id));
    const refBlocks = blocks.filter(b => articleIds.has(b._parentId) && b._skeletonKey === 'lesson-references');
    if (refBlocks.length === 0) return [];
    const blockIds = new Set(refBlocks.map(b => b._id));
    const refComponents = components.filter(c => blockIds.has(c._parentId));
    const items = [];
    for (const c of refComponents) {
      if (Array.isArray(c._items)) items.push(...c._items);
    }
    return items;
  }

  lessonCheck(
    'PLR-1',
    'Lesson Sources block cites chapter and pages',
    (lesson, bareKey) => `${matchSlug}-${bareKey}-les-01`,
    (lesson) => {
      const items = findLessonReferenceItems(lesson.key);
      if (items === null) {
        return { pass: false, detail: `no page in contentObjects.json matches pageKey "${lesson.key}"` };
      }
      if (items.length === 0) {
        return { pass: false, detail: 'no references in the Lesson Sources block' };
      }
      for (const item of items) {
        if (item.type === 'book') {
          const title = item.title || '';
          const hasChapter = /chapter\s*\d+/i.test(title);
          const hasPages = /(pp?\.?\s*\d+|pages?\s*\d+)/i.test(title);
          if (!hasChapter || !hasPages) {
            return { pass: false, detail: `book citation "${title}" missing chapter and/or pages` };
          }
        }
      }
      return { pass: true, detail: `${items.length} reference(s), all book citations carry chapter and pages` };
    }
  );

  // ---- MK-1: slot markers on Phase-B lesson components + wrapper markers ----
  // MK-1 (docs/project/open-decisions.md, 21 September 2026, AMENDMENT
  // 22 September 2026, Prompt 157): every slot marker is written by the
  // step that creates its component. Not a plain lessonCheck() call:
  // it spans a per-lesson loop (part 1) and a course-level, file-
  // existence-gated assertion (part 2), the same shape the CO-1 IIFE
  // above already uses for a check that does not fit lessonCheck()'s
  // single per-lesson-gate-wait signature, reported under one checkId
  // and one RESULT line as CO-1 is.
  //
  // Part 1 (per lesson): the four Phase-B-deferred, coupled lesson
  // slots SO-1 names an owner for - concept-intro, worked-example
  // and practical-guidance are all B2 (SO-1's own bolded ruling text:
  // "concept-intro, interior and practical-guidance are decided at
  // B2, in one record, as a single slots object with one entry per
  // slot"; "interior" there is the worked-example slot, which since the
  // v2 rename (8 Oct 2026) is keyed "worked-example" throughout (block
  // key == slotType; the old "interior" block key is retired).
  // Correction, Prompt 158: an earlier reading of this
  // check took worked-example as B3, misreading SO-1's Grounds
  // bullet - "B3's records hold content and name no component, which
  // is the evidence that B2 chooses the realisation and B3 fills it"
  // - as evidence for B3's ownership, when the bullet is evidence
  // for B2's: B3 only authors narrative content inside a realisation
  // B2 already decided), check (B4). Coupling now comes from the page's
  // own instantiations[] entry (slotChoices[].contextCoupling), not the
  // retired course-level les-03_context-coupling-plan record
  // (gate-redesign-2026-10-06.md, 8 Oct 2026). Where instantiations
  // couples the slot (contextCoupling.coupled === true,
  // CPL-1), the built component(s) under that slot's block
  // (_skeletonKey, matched via matchesPageKey/PLR-1's own pattern)
  // must carry `slot__<page>__<slotType>` (LK-1) on at least one
  // component's _classes; a multi-block slot (the worked-example and check
  // slots each render one to several blocks per
  // design-kb.skeletons.json's own notes) is not required to mark
  // every block, only to carry the marker somewhere among them - this
  // sitting's own reading, not itself ruled, flagged in the report.
  // Where instantiations does not couple the slot, no built component
  // under that block may carry any slot__ marker at all: an unplanned
  // one fails. The lesson list is crs-04_lesson-map and the per-lesson
  // gate is the single les-01_lesson-proposal (six-phase realignment,
  // 8 Oct 2026); Part 1 is reachable once crs-04 closes and each
  // lesson's les-01 lands.
  //
  // MP-1 (Prompt 159) / PKY-1 (Prompt 160, both docs/project/open-
  // decisions.md): a coupled slot is satisfied by one or more marked
  // components, each carrying either the part-less marker or a
  // part-keyed one (`slot__<page>__<slotType>__<part>`). Two components
  // on one page carrying the same page, slot and part — including two
  // both carrying the part-less form — fail, naming both. An unplanned
  // marker still fails whether or not it carries a part.
  //
  // Part 2 (course-level, not gated behind any B-gate): both wrapper
  // practice-connection markers (slot__wrapper-open__practice-connection,
  // slot__wrapper-close__practice-connection) are required once
  // en/components.json exists - the generator's own marker-writing
  // behaviour for the two single-realisation slots it creates
  // directly, regression-checked here rather than assumed.
  (function () {
    const checkId = 'MK-1';
    console.log('='.repeat(60));
    console.log(`LESSON CHECK: ${checkId} - Slot markers (Phase B + wrapper)`);
    console.log('='.repeat(60));
    if (!courseDesign) {
      console.log(`No course-design file at ${path.relative(ROOT, courseDesignPath)}`);
      console.log('RESULT: FAIL (0 items checked)');
      console.log('');
      lessonCheckResults.push({ name: checkId, status: 'FAIL' });
      return;
    }

    // Six-phase model (8 Oct 2026): every lesson slot is owned by the
    // single consolidated les-01_lesson-proposal gate (the old per-slot
    // B2/B4 owners collapsed into it).
    const SLOT_OWNER_GATE = {
      'concept-intro': 'les-01',
      'worked-example': 'les-01',
      'practical-guidance': 'les-01',
      'check': 'les-01'
    };
    // Since the v2 rename (8 Oct 2026) the worked-example block's key
    // equals its slotType ("worked-example"), so this map is the identity:
    // the old block key "interior" is retired. slotChoices[].slotKey,
    // blockSequence[].key and the built block's _skeletonKey now all read
    // "worked-example", which is what clause 6 and this check both match on.
    const SKELETON_KEY_FOR_SLOT = {
      'concept-intro': 'concept-intro',
      'worked-example': 'worked-example',
      'practical-guidance': 'practical-guidance',
      'check': 'check'
    };
    const SLOTS = ['concept-intro', 'worked-example', 'practical-guidance', 'check'];

    function builtComponentsForSlot(pageKey, skeletonKey) {
      const contentObjects = loadJsonIfExists(path.join(enDir, 'contentObjects.json')) || [];
      const articles = loadJsonIfExists(path.join(enDir, 'articles.json')) || [];
      const blocks = loadJsonIfExists(path.join(enDir, 'blocks.json')) || [];
      const components = loadJsonIfExists(path.join(enDir, 'components.json')) || [];
      const pages = contentObjects.filter(o => o._type === 'page');
      const matchedPages = pages.filter(p => matchesPageKey(p._id, matchSlug, pageKey));
      if (matchedPages.length === 0) return null;
      const pageIds = new Set(matchedPages.map(p => p._id));
      const articleIds = new Set(articles.filter(a => pageIds.has(a._parentId)).map(a => a._id));
      const targetBlocks = blocks.filter(b => articleIds.has(b._parentId) && b._skeletonKey === skeletonKey);
      if (targetBlocks.length === 0) return [];
      const blockIds = new Set(targetBlocks.map(b => b._id));
      return components.filter(c => blockIds.has(c._parentId));
    }

    // Part 2's two wrapper pages: the generator builds each fixedPages
    // entry's page _id stem from its "baseKey" (design-kb.skeletons.json
    // pageSet.fixedPages, e.g. "W-OPEN"), never from its archetype key
    // (e.g. "wrapper-open") - see tools/generate-course-shell.js's page
    // stem construction. The practice-connection marker token is still
    // named by archetype key (slot__wrapper-open__practice-connection),
    // so this maps archetype key -> baseKey for page lookup only, reading
    // the same store loadSkeletonBlockKeys() above reads.
    let wrapperBaseKeyCache = null;
    function loadWrapperBaseKeys() {
      if (wrapperBaseKeyCache) return wrapperBaseKeyCache;
      wrapperBaseKeyCache = new Map();
      const skeletonsPath = path.join(ROOT, 'design-kb', 'design-kb.skeletons.json');
      const skeletons = loadJsonIfExists(skeletonsPath);
      const fixedPages = skeletons && skeletons.pageSet && Array.isArray(skeletons.pageSet.fixedPages)
        ? skeletons.pageSet.fixedPages : [];
      for (const fp of fixedPages) {
        if (fp && typeof fp.archetype === 'string' && typeof fp.baseKey === 'string') {
          wrapperBaseKeyCache.set(fp.archetype.replace('skeletons/', ''), fp.baseKey);
        }
      }
      return wrapperBaseKeyCache;
    }

    function classesOf(component) {
      return typeof component._classes === 'string' ? component._classes : '';
    }
    function markerTokens(classesString) {
      return classesString.split(/\s+/).filter(Boolean);
    }
    function hasAnySlotMarker(classesString) {
      // MP-1/PKY-1: the marker may carry an optional fourth, part group.
      return markerTokens(classesString).some(t => /^slot__[A-Za-z0-9-]+__[A-Za-z0-9-]+(?:__[A-Za-z0-9-]+)?$/.test(t));
    }
    // MP-1/PKY-1: does this component carry a marker for this exact
    // page+slot, part-less or part-keyed? Returns { token, part } (part
    // null for the part-less form) or null if no such marker is present.
    function markerForThisSlot(classesString, page, slot) {
      const base = `slot__${page}__${slot}`;
      for (const t of markerTokens(classesString)) {
        if (t === base) return { token: t, part: null };
        const prefix = `${base}__`;
        if (t.startsWith(prefix)) {
          const part = t.slice(prefix.length);
          if (/^[A-Za-z0-9-]+$/.test(part)) return { token: t, part };
        }
      }
      return null;
    }

    let itemsChecked = 0;
    let anyFail = false;

    // ---- Part 1: the four SO-1-owned Phase-B lesson slots ----
    const { closed: mapClosed, lessons } = lessonMapClosed();
    if (!mapClosed) {
      console.log(`NOT YET REACHABLE: ${checkId} (lesson slots) waits on crs-04_lesson-map`);
    } else if (lessons.length === 0) {
      anyFail = true;
      console.log(`FAIL: ${checkId} - crs-04_lesson-map closed but 0 lessons found; nothing to check`);
    } else {
      // Coupling source: the manifest's own instantiations[] (one entry
      // per built page, pageKey + slotChoices[].contextCoupling), not the
      // retired les-03 plan. instByPage maps pageKey -> instantiation.
      const instByPage = new Map();
      for (const inst of (courseDesign.instantiations || [])) {
        if (inst && inst.pageKey) instByPage.set(inst.pageKey, inst);
      }

      for (const lesson of lessons) {
        const bareKey = lessonBareKey(lesson);
        if (bareKey === null) {
          anyFail = true;
          itemsChecked++;
          console.log(`FAIL: ${checkId} - lesson missing "key" (title "${lesson.title || '?'}")`);
          continue;
        }
        const lessonId = bareKey;
        const exemption = exemptionFor(lessonId, checkId);
        if (exemption) {
          console.log(`EXEMPT: ${lessonId} ${checkId} - ${exemption.reason}`);
          continue;
        }
        if (!instByPage.has(lesson.key)) {
          console.log(`NOT YET REACHABLE: ${lessonId} ${checkId} waits on this page's instantiations[] entry (lesson content not landed yet)`);
          continue;
        }
        const openGates = SLOTS
          .map(slot => `${matchSlug}-${bareKey}-${SLOT_OWNER_GATE[slot]}`)
          .filter((gid, idx, arr) => arr.indexOf(gid) === idx)
          .filter(gid => !gateClosed(gid));
        if (openGates.length > 0) {
          console.log(`NOT YET REACHABLE: ${lessonId} ${checkId} waits on ${openGates.join(', ')}`);
          continue;
        }
        const planPage = instByPage.get(lesson.key) || null;
        for (const slot of SLOTS) {
          const skeletonKey = SKELETON_KEY_FOR_SLOT[slot];
          const comps = builtComponentsForSlot(lesson.key, skeletonKey);
          itemsChecked++;
          if (comps === null) {
            anyFail = true;
            console.log(`FAIL: ${lessonId} ${checkId} - ${slot}: no page in contentObjects.json matches pageKey "${lesson.key}"`);
            continue;
          }
          if (comps.length === 0) {
            anyFail = true;
            console.log(`FAIL: ${lessonId} ${checkId} - ${slot}: no built component (skeletonKey "${skeletonKey}")`);
            continue;
          }
          const planSlot = planPage && Array.isArray(planPage.slotChoices)
            ? planPage.slotChoices.find(s => s.slotKey === slot) : null;
          const cc = planSlot ? planSlot.contextCoupling : null;
          const expectMarker = !!(cc && cc.coupled === true);
          const variationType = expectMarker ? (cc.variationType || 'coupled') : 'shell-coupled';
          const expectedMarker = `slot__${lesson.key}__${slot}`;
          // MP-1/PKY-1: satisfied by one or more marked components, each
          // part-less or part-keyed for this page+slot.
          const matches = comps
            .map(c => ({ id: c._id, marker: markerForThisSlot(classesOf(c), lesson.key, slot) }))
            .filter(m => m.marker);
          const anyHasExpected = matches.length > 0;
          const anyHasAnyMarker = comps.some(c => hasAnySlotMarker(classesOf(c)));
          // Two components carrying the same page, slot and part fail,
          // naming both — including two both carrying the part-less form.
          const byPart = new Map(); // '' for part-less, else the part
          for (const m of matches) {
            const partKey = m.marker.part || '';
            if (!byPart.has(partKey)) byPart.set(partKey, []);
            byPart.get(partKey).push(m.id);
          }
          const dupes = [...byPart.entries()].filter(([, ids]) => ids.length > 1);
          if (dupes.length > 0) {
            anyFail = true;
            for (const [partKey, ids] of dupes) {
              const markerText = partKey ? `${expectedMarker}__${partKey}` : expectedMarker;
              console.log(`FAIL: ${lessonId} ${checkId} - ${slot}: two components carry the same marker "${markerText}": ${ids.join(', ')}`);
            }
          } else if (expectMarker && !anyHasExpected) {
            anyFail = true;
            console.log(`FAIL: ${lessonId} ${checkId} - ${slot}: instantiations couples this slot (variationType "${variationType}") but no built component carries "${expectedMarker}" or a part-keyed form of it`);
          } else if (!expectMarker && anyHasAnyMarker) {
            anyFail = true;
            console.log(`FAIL: ${lessonId} ${checkId} - ${slot}: instantiations does not couple this slot (shell-coupled) but a built component carries an unplanned slot marker`);
          } else {
            console.log(`PASS: ${lessonId} ${checkId} - ${slot}: ${expectMarker ? (matches.length > 1 ? `${matches.length} marked components present` : `"${matches[0].marker.token}" present`) : 'no marker, none planned'}`);
          }
        }
      }
    }

    // ---- Part 2: wrapper practice-connection markers ----
    const componentsExists = fs.existsSync(path.join(enDir, 'components.json'));
    if (!componentsExists) {
      console.log(`NOT YET REACHABLE: ${checkId} (wrapper markers) waits on en/components.json existing`);
    } else {
      for (const archetypeKey of ['wrapper-open', 'wrapper-close']) {
        itemsChecked++;
        const baseKey = loadWrapperBaseKeys().get(archetypeKey);
        const expectedMarker = `slot__${archetypeKey}__practice-connection`;
        if (!baseKey) {
          anyFail = true;
          console.log(`FAIL: ${checkId} - ${archetypeKey}: no design-kb.skeletons.json pageSet.fixedPages entry maps this archetype to a baseKey`);
          continue;
        }
        const comps = builtComponentsForSlot(baseKey, 'practice-connection');
        if (comps === null) {
          anyFail = true;
          console.log(`FAIL: ${checkId} - ${archetypeKey}: no page in contentObjects.json matches pageSet.fixedPages baseKey "${baseKey}"`);
          continue;
        }
        if (comps.length === 0) {
          anyFail = true;
          console.log(`FAIL: ${checkId} - ${archetypeKey}: no built practice-connection component`);
          continue;
        }
        const anyHasExpected = comps.some(c => markerTokens(classesOf(c)).includes(expectedMarker));
        if (!anyHasExpected) {
          anyFail = true;
          console.log(`FAIL: ${checkId} - ${archetypeKey}: no built practice-connection component carries "${expectedMarker}"`);
        } else {
          console.log(`PASS: ${checkId} - ${archetypeKey}: "${expectedMarker}" present`);
        }
      }
    }

    let status;
    if (anyFail) status = 'FAIL';
    else if (itemsChecked > 0) status = 'PASS';
    else status = 'NOT_YET_REACHABLE';
    console.log(`RESULT: ${status.replace(/_/g, ' ')} (${itemsChecked} items checked)`);
    console.log('');
    lessonCheckResults.push({ name: checkId, status });
  })();

  // ---- Summary ----
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log('');
  console.log('Clause                                          | Items | Result');
  console.log('-------------------------------------------------|-------|--------');
  let anyFailed = false;
  for (const r of results) {
    const label = r.notYetReachable ? 'NOT YET REACHABLE' : (r.pass ? 'PASS' : 'FAIL');
    if (!r.notYetReachable && !r.pass) anyFailed = true;
    console.log(`${r.name.padEnd(49)} | ${String(r.itemsChecked).padEnd(5)} | ${label}`);
  }
  console.log('');
  console.log('Lesson check (LCR-1)  | Result');
  console.log('-----------------------|----------------');
  for (const r of lessonCheckResults) {
    if (r.status === 'FAIL') anyFailed = true;
    console.log(`${r.name.padEnd(22)} | ${r.status.replace(/_/g, ' ')}`);
  }
  console.log('');
  if (anyFailed) {
    console.log('manifest-completeness: FAILED (one or more clauses failed)');
    process.exit(1);
  } else {
    console.log('manifest-completeness: PASSED (all clauses passed)');
    process.exit(0);
  }
}

main();
