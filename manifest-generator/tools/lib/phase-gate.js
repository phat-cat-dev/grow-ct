/**
 * phase-gate.js
 *
 * PHA-1 (docs/project/open-decisions.md): "A check that depends on work
 * from a later stage of design reports that work as waiting, not
 * failing, until every gate placed before /scaffold is closed or
 * skipped; after that, anything missing fails. One shared function
 * decides whether that point has been reached, and /scaffold,
 * manifest-completeness.js and session-audit.js all use it." This file
 * is that shared function.
 *
 * Gate realignment (Round C/D, 7 Oct 2026, gate-redesign-2026-10-06.md):
 * the pre-scaffold boundary is now the course-level design gates of ONB
 * and CRS. /scaffold builds the page skeleton from the lesson map
 * (crs-04_lesson-map); the per-lesson interior design and activities
 * (les-01_lesson-proposal), the wrappers (wra-*) and the context pack
 * (cxp-*) come AFTER scaffold, so they are not part of this boundary.
 *
 * Lesson OUTCOMES are no longer a per-lesson pre-scaffold gate: the A6.1
 * amendment folded them into crs-04_lesson-map (a single course-level
 * record), so "every lesson's outcomes set in one pass" is satisfied by
 * crs-04 being closed. The old per-lesson B1 enumeration is therefore
 * removed; CXS gates are reserved/auto-passing (A4) and do not gate
 * scaffold.
 *
 * A gate counts as past this boundary when its last record's state is
 * "closed" OR "skipped" (PHA-1's own words), not "closed" alone.
 */

// Shared course-level gates that must be closed/skipped before /scaffold:
// all of ONB (identity + naming) and the hard-stop CRS design gates
// through the lesson map. crs-05_course-spec (advisory rollup), the
// reserved CXS gates, and the post-scaffold LES/WRA/CXP gates are
// deliberately not in this set.
const SHARED_PRE_SCAFFOLD_GATES = [
  'onb-01_theme-preset',
  'onb-02_course-theme',
  'onb-03_pitch',
  'onb-04_naming',
  'crs-01_sources',
  'crs-02_thematic-scope',
  'crs-03_course-outcomes',
  'crs-04_lesson-map'
];

function lastRecord(courseDesign, gateId) {
  const gates = (courseDesign && courseDesign.gates) || [];
  const g = gates.find(x => x.gateId === gateId);
  if (!g || !Array.isArray(g.records) || g.records.length === 0) return null;
  return g.records[g.records.length - 1];
}

function isClosedOrSkipped(record) {
  return !!record && (record.state === 'closed' || record.state === 'skipped');
}

/**
 * Has this course's design reached the point immediately before /scaffold?
 *
 * courseDesign: a parsed course-design_<slug>.json object.
 * course: the course slug (kept in the signature for call-site
 *   compatibility; the realigned boundary is course-level and does not
 *   enumerate per-lesson gate ids, so it is no longer read here).
 *
 * Returns { reached: boolean, missing: string[] }. missing names every
 * shared pre-scaffold gate not yet closed or skipped; reached is true
 * iff missing is empty.
 */
function scaffoldBoundaryStatus(courseDesign, course) { // eslint-disable-line no-unused-vars
  const missing = [];
  for (const gateId of SHARED_PRE_SCAFFOLD_GATES) {
    if (!isClosedOrSkipped(lastRecord(courseDesign, gateId))) {
      missing.push(gateId);
    }
  }
  return { reached: missing.length === 0, missing };
}

module.exports = { scaffoldBoundaryStatus, SHARED_PRE_SCAFFOLD_GATES };
