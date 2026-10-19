/**
 * page-match.js
 *
 * Shared pageKey matcher for conformance-lint.js and
 * manifest-completeness.js. Single source of truth so the two tools
 * cannot silently diverge on what "matches" means (see backlog 5.113,
 * Ruling C, 9 Sep 2026).
 *
 * A pageKey may be written bare ("L02") or course-slug-prefixed
 * ("academic-writing-intermediate-L02") in an instantiations[] entry
 * (see PK-1, docs/project/open-decisions.md #49: pageKeys for courses
 * designed after 29 Aug 2026 are slug-prefixed for cross-course
 * uniqueness; the pilot and some earlier courses keep bare keys).
 * Independently, the built _id (contentObjects.json) or _parentId
 * (blocks.json) an instantiation is matched against may ALSO be bare
 * or slug-prefixed, and the two are not guaranteed to agree (see 5.88
 * recon, 8 Sep 2026: presenting-introductory's pageKeys are bare but
 * its blocks' _parentId values are slug-prefixed).
 *
 * matchesPageKey therefore tries both the bare and the slug-prefixed
 * form of pageKey against the given id/_parentId, and accepts either.
 */

/**
 * Does idOrParentId belong to the page identified by pageKey?
 *
 * idOrParentId: a contentObject _id ("L02-co-01",
 *   "presenting-introductory-L02-co-01") or a block _parentId
 *   (an article id, "L02-a-01", "presenting-introductory-L02-a-01").
 *   Matched by prefix-with-boundary, so this also correctly matches
 *   ids/parentIds with further segments after the page's own base.
 * courseSlug: the course slug, e.g. "presenting-introductory".
 * pageKey: the instantiation's pageKey, bare or slug-prefixed.
 *
 * Returns true if idOrParentId's page-base is either the bare or the
 * slug-prefixed form of pageKey.
 */
function matchesPageKey(idOrParentId, courseSlug, pageKey) {
  if (!idOrParentId || !courseSlug || !pageKey) return false;

  const bareKey = pageKey.startsWith(`${courseSlug}-`)
    ? pageKey.slice(courseSlug.length + 1)
    : pageKey;

  const candidates = [bareKey, `${courseSlug}-${bareKey}`];

  return candidates.some(
    c => idOrParentId === c || idOrParentId.startsWith(`${c}-`)
  );
}

module.exports = { matchesPageKey };
