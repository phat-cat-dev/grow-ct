/**
 * course-resolve.js
 *
 * Shared course-path resolver for manifest-completeness.js, session-audit.js,
 * conformance-lint.js, verify-course.js, merge-health.js, verify-all-courses.js
 * and voice-lint.js. Single source of truth for "where does a course slug's
 * directory live", replacing independent (and mostly broken) hardcodes of
 * `courses/<slug>`.
 * See docs/project/pipeline-stocktake-2026-09/pipeline-requirements-register.md,
 * PR-1-11, established 16 Sep 2026 by live run.
 *
 * PROBLEM 1 - which root: since the archive move at b152c3a (17 Sep 2026),
 * `courses/<slug>` no longer exists for any of the four original courses;
 * live content is under `courses/_generated/<full-context-slug>/`. A caller
 * must say which root(s) it means to search - there is no ambient default
 * here, deliberately: a shell-only check silently reading generated output
 * would be a worse failure than the current, visible one.
 *
 * PROBLEM 2 - the course-design filename: inside every one of the 21
 * directories under `courses/_generated/`, the course-design file is named
 * for the BASE TIER, not the full context slug of the directory it lives in
 * (e.g. `course-design_academic-writing-advanced.json` inside
 * `academic-writing-advanced-banking-and-finance/`). Confirmed across all 21,
 * recounted, 16 Sep 2026. Constructing the filename by templating the slug
 * (what every tool did before this fix) fails inside all of them. This
 * resolver globs the resolved directory for `course-design_*.json` instead
 * of assuming its name, and REPORTS via `warnings` rather than silently
 * picking when it finds zero or more than one match - the whole reason this
 * file exists is that an unexamined naming assumption already produced
 * broken tools once.
 *
 * Named roots and what each means:
 *   'courses'                 -> <repo>/courses/<slug>
 *   'courses/_generated'      -> <repo>/courses/_generated/<slug>
 *
 * No archive root. RBD-1 AMENDMENT: no tool reads from the archive; there is
 * no opt-in path here for a caller to pass by mistake or on purpose.
 *
 * roots is REQUIRED and has no default - every call site must say
 * explicitly which root(s) it means (Abbott's ruling: "No ambient default
 * a caller can forget to think about. A shell check silently reading
 * generated output would be worse than the current failure.").
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const ROOT_PATHS = {
  'courses': path.join(ROOT, 'courses'),
  'courses/_generated': path.join(ROOT, 'courses', '_generated')
};

/**
 * Resolve a course slug against an explicit, ordered list of named roots.
 *
 * slug: the course slug, e.g. "academic-writing-advanced-banking-and-finance".
 * roots: required, non-empty array drawn from the keys of ROOT_PATHS, in the
 *   order they should be tried. There is no default - every call site must
 *   say what it means.
 *
 * Returns:
 *   {
 *     found: boolean,
 *     root: one of the roots array, or null,
 *     courseDir: absolute path, or null,
 *     courseDesignPath: absolute path, or null,
 *     enDir: absolute path (if <courseDir>/en exists), or null,
 *     checked: [absolute course-directory paths tried, in order],
 *     warnings: [string, ...]  // e.g. zero or multiple course-design_*.json
 *                               // matches inside a directory that was found
 *   }
 */
function resolveCourse(slug, roots) {
  if (!Array.isArray(roots) || roots.length === 0) {
    throw new Error('resolveCourse requires an explicit, non-empty roots array - no default is provided.');
  }
  for (const root of roots) {
    if (!ROOT_PATHS[root]) {
      throw new Error(`resolveCourse: unknown root "${root}". Known roots: ${Object.keys(ROOT_PATHS).join(', ')}`);
    }
  }

  const checked = [];
  const warnings = [];

  for (const root of roots) {
    const courseDir = path.join(ROOT_PATHS[root], slug);
    checked.push(courseDir);
    if (!fs.existsSync(courseDir) || !fs.statSync(courseDir).isDirectory()) continue;

    // Found the directory. Resolve the course-design file by pattern, not
    // by templating the slug (see PROBLEM 2 above).
    const entries = fs.readdirSync(courseDir).filter(f => /^course-design_.*\.json$/.test(f));
    let courseDesignPath = null;
    if (entries.length === 0) {
      warnings.push(`${courseDir}: no course-design_*.json file found`);
    } else if (entries.length > 1) {
      warnings.push(`${courseDir}: multiple course-design_*.json files found (${entries.join(', ')}) - not picking one`);
    } else {
      courseDesignPath = path.join(courseDir, entries[0]);
    }

    const enDirCandidate = path.join(courseDir, 'en');
    const enDir = fs.existsSync(enDirCandidate) && fs.statSync(enDirCandidate).isDirectory()
      ? enDirCandidate
      : null;

    return { found: true, root, courseDir, courseDesignPath, enDir, checked, warnings };
  }

  return { found: false, root: null, courseDir: null, courseDesignPath: null, enDir: null, checked, warnings };
}

module.exports = { resolveCourse };
