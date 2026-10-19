#!/usr/bin/env bash
# =============================================================================
# sync-from-adapt3.sh
#
# Refresh this manifest-generator bundle from a source adapt3 checkout.
# Re-copies ONLY the files the Stage-A gate->manifest path needs:
#   - the generator tools (+ tools/lib) the pipeline runs
#   - the design-kb / schemas stores they read
#   - source-kb/source-kb.json (kbVersion stamp)
# Deliberately NOT copied: the 15 MB catalogue/, the Adapt build side (src/,
# grunt, adapt.json), or the interactive gate skills.
#
# Usage:
#   ./sync-from-adapt3.sh [path-to-adapt3-checkout]
# Default source: /home/user/wkspc2614-adapt3
#
# Does NOT touch node_modules/, courses/, package.json, README.md or the
# examples/ — only the extracted-from-adapt3 content. Run `npm install` after
# if dependencies changed. Review `git diff` before committing the refresh.
# =============================================================================
set -euo pipefail

SRC="${1:-/home/user/wkspc2614-adapt3}"
OUT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # this bundle, in place

[ -d "$SRC/tools" ] && [ -d "$SRC/design-kb" ] || {
  echo "ERROR: '$SRC' does not look like an adapt3 checkout (no tools/ + design-kb/)." >&2
  exit 1
}

TOOLS=(
  new-course.js gate-order.js phase-confirm.js render-course-spec.js
  render-course-spec-fields.json manifest-completeness.js
  validate-gate-record.py validate-design-schemas.py
)
LIB=(page-match.js course-resolve.js phase-gate.js)

echo "[sync] source: $SRC"
echo "[sync] target: $OUT"

mkdir -p "$OUT/tools/lib" "$OUT/schemas" "$OUT/design-kb" "$OUT/source-kb"
for f in "${TOOLS[@]}"; do cp "$SRC/tools/$f" "$OUT/tools/$f"; done
for f in "${LIB[@]}";   do cp "$SRC/tools/lib/$f" "$OUT/tools/lib/$f"; done

# stores + schemas (small; mirror wholesale so nothing dangles).
# Clear-then-copy gives rsync --delete semantics without needing rsync.
rm -rf "$OUT/design-kb" "$OUT/schemas"
mkdir -p "$OUT/design-kb" "$OUT/schemas"
cp -r "$SRC/design-kb/." "$OUT/design-kb/"
cp -r "$SRC/schemas/."   "$OUT/schemas/"
# source-kb.json only stamps a kbVersion and is optional — new-course.js falls
# back to a default when it is absent. Copy it only if the source has it.
if [ -f "$SRC/source-kb/source-kb.json" ]; then
  cp "$SRC/source-kb/source-kb.json" "$OUT/source-kb/source-kb.json"
else
  echo "[sync] note: $SRC/source-kb/source-kb.json absent — skipped (kbVersion defaults)."
fi

echo "[sync] done. Source commit:"
git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo "  (source not a git repo)"
echo "[sync] review changes with: git -C \"$OUT\" status  &&  git -C \"$OUT\" diff"
