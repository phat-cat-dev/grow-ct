#!/usr/bin/env python3
"""
validate-design-schemas.py — Design-schema validator for course-design manifests,
design-kb.gates.json, and source-kb / institutional-kb stores.

Uses jsonschema (draft-07) for schema validation, plus explicit structural
invariants the schema alone cannot express.

Usage:
    python3 tools/validate-design-schemas.py [--course-design FILE] [--gates FILE]
    python3 tools/validate-design-schemas.py [--source-kb FILE] [--institutional-kb FILE]
    python3 tools/validate-design-schemas.py [--vocab-kb FILE] [--hecos-kb FILE]
    python3 tools/validate-design-schemas.py --test-fixtures

Landed: 27 Aug 2026, Session 2 close-out (honesty item: offline validator
never landed in repo; this makes the pass non-vacuous and reproducible).
Extended: 27 Aug 2026, Session 4 — source-kb and institutional-kb stores.
Extended: 18 Sep 2026, Prompt 68 — vocab-kb store (schema + structural
invariants: parent resolution, no duplicate codes, fails on empty/missing
store rather than passing vacuously).
Extended: 18 Sep 2026, Prompt 69 — every store mode now fails cleanly
(FAIL + exit 1, never a traceback) on a missing, unreadable, or malformed
store, not just vocab-kb; fixed PR-S-35 (--all-defaults pointed at a dead
course-design path). --all-defaults now covers every store with a fixed
single-file repo location (gates, source-kb, vocab-kb, and the four
design-kb stores) and no longer defaults a course-design, since none is
privileged as "the" pilot among the courses now built under
archive/courses-2026-09/.
Extended: 20 Sep 2026, Prompt 124 — design-kb.content-shapes.json store
(CS-1): the shapes book content takes, seven anchored on Horn's
Information Mapping types and eight academic-skills extensions. Added to
--all-defaults; structural invariants check shape-id uniqueness and that
the seven Horn types are covered exactly once.
Extended: 20 Sep 2026, Prompt 126 — activity-patterns mode gains four
cross-store invariants: every pattern's servesShapes id resolves in the
content-shapes store; every formative/either pattern carries a non-empty
servesShapes; every content-shape is served by at least one pattern
(zero shapes or zero patterns FAILs, never passes vacuously); every
realisation's component id resolves in the palette.
Extended: 20 Sep 2026, Prompt 132 — --source-maps mode (SMAP-1, BM-1): a
directory scan over source-kb/source-maps/, not a single-file path, since
one map file exists per source. Checks per file: schema validity against
schemas/source-map.schema.json; chunk-id uniqueness within the file; every
shapeId resolves in the content-shapes store; every chunk's heading
appears verbatim in the resolved source text (via textPointer.file or the
source-kb entry's locator.repoPath — a markdown/text working copy, never a
PDF, per BM-1's "gates read maps, never PDFs"); every pathwayTag carries
non-empty evidence. Zero map files, or zero chunks in a file, FAILs, never
passes vacuously. Added to --all-defaults (the directory is now as fixed a
repo-conventional location as any single-file store above).
Extended: 21 Sep 2026, Prompt 145, SMAP-1 AMENDMENT — every pathwayTag's
pathway value must resolve in catalogue/pathways.json's own pathway ids;
a tag naming anything else FAILs. Closes the gap that let this file carry
referencing-citation-integrity and work-based-experiential, neither a
catalogue pathway id, unnoticed by any check.
Extended: 21 Sep 2026, Prompt 140 Unit 2 — --catalogue mode (CAT-1, CAT-1
AMENDMENT): validates catalogue.json against schemas/catalogue.schema.json,
catalogue/pathways.json against schemas/catalogue.pathways.schema.json, and
every catalogue/pathways/<pathway>.json against
schemas/catalogue.pathway.schema.json. Structural invariants beyond schema:
every pathway file named in pathways.json exists; every pathway has exactly
one file (no two pathway entries share a file path); no course slug is
claimed by two tiers, across every pathway file combined. Zero pathways in
pathways.json FAILs, never a vacuous pass. Added to --all-defaults.
Extended: 26 Sep 2026, adp-0184 (HSV-1) — --hecos-kb mode: validates
vocab-kb/hecos.json against schemas/hecos-kb.schema.json, plus a
cross-store invariant against vocab-kb/cah.json (every term's cah3 code
must resolve to an existing CAH3 code in the CAH store; a dangling
reference FAILs). Zero terms in the hecos-kb store FAILs, never a vacuous
pass. Added to --all-defaults.
"""

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import jsonschema
    from jsonschema import Draft7Validator, RefResolver
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False

# Paths relative to repo root
REPO_ROOT = Path(__file__).resolve().parent.parent
SCHEMAS_DIR = REPO_ROOT / "schemas"
DESIGN_KB_DIR = REPO_ROOT / "design-kb"
TEST_FIXTURES_DIR = REPO_ROOT / "tools" / "test-fixtures"

# Default files
#
# PR-S-35 (Prompt 69): course-design has no fixed default path and none is
# added here. DEFAULT_PILOT used to point at
# schemas/course-design_academic-writing-introductory.json; that file was
# moved out of schemas/ in 598e147 (7 Sep 2026, "move Introductory
# manifest to conventional path") and, after further moves, now lives
# under archive/courses-2026-09/academic-writing-introductory/ alongside
# three sibling course-design instances (academic-writing-advanced,
# academic-writing-intermediate, presenting-introductory) that are equally
# valid — of an eventual 39 pathway-tiers (docs/curriculum/pathway-tier-
# mapping.md). No single course-design is privileged as "the" pilot, so
# --all-defaults validates course-design only when --course-design is
# given explicitly.
#
# The stores below DO have a fixed, single-file location in the repo and
# are covered by --all-defaults.
DEFAULT_GATES = DESIGN_KB_DIR / "design-kb.gates.json"
DEFAULT_SKELETONS = DESIGN_KB_DIR / "design-kb.skeletons.json"
DEFAULT_PALETTE = DESIGN_KB_DIR / "design-kb.palette.json"
DEFAULT_TIER_BANDS = DESIGN_KB_DIR / "design-kb.tier-bands.json"
DEFAULT_ACTIVITY_PATTERNS = DESIGN_KB_DIR / "design-kb.activity-patterns.json"
DEFAULT_CONTENT_SHAPES = DESIGN_KB_DIR / "design-kb.content-shapes.json"
DEFAULT_PATHWAYS = DESIGN_KB_DIR / "design-kb.pathways.json"
# TLS-1, HMD-1 (adp-0204, 30 Sep 2026): vocab-kb/ moved to
# tools/subject/core/vocab/; this is the one constant both this default
# and validate_hecos_kb's cross-store check below read, not a second
# hard-coded path.
DEFAULT_VOCAB_KB = REPO_ROOT / "tools" / "subject" / "core" / "vocab" / "cah.json"
# HSV-1 (Prompt adp-0184, 26 Sep 2026): hecos.json has the same fixed
# single-file repo location as cah.json above, so it is covered by
# --all-defaults the same way.
DEFAULT_HECOS_KB = REPO_ROOT / "tools" / "subject" / "core" / "vocab" / "hecos.json"
DEFAULT_SOURCE_KB = REPO_ROOT / "source-kb" / "source-kb.json"
# SMAP-1 (Prompt 132): source maps are one file per source under this fixed
# directory, so --source-maps is a directory scan rather than a single-file
# path, but the directory itself has a fixed repo-conventional location like
# every other --all-defaults store below.
DEFAULT_SOURCE_MAPS_DIR = REPO_ROOT / "source-kb" / "source-maps"
# CAT-1 AMENDMENT (Prompt 140 Unit 2): catalogue.json is a fixed single-file
# root at repo top level, like gates/skeletons/palette above, so it is
# covered by --all-defaults the same way.
DEFAULT_CATALOGUE = REPO_ROOT / "catalogue.json"
# SMAP-1 AMENDMENT (Prompt 145, 21 Sep 2026): a source map's pathwayTags
# must use catalogue/pathways.json's own pathway ids, so --source-maps
# reads this fixed path as a cross-store dependency the same way it
# already reads the content-shapes and source-kb stores below.
DEFAULT_CATALOGUE_PATHWAYS = REPO_ROOT / "catalogue" / "pathways.json"
# BM-1 AMENDMENT (Prompt 148, 21 Sep 2026) relied on QAAVector, a separate,
# read-only sibling workspace, as ground truth for a benchmark-kind source
# map's chunk headings, text and verification state. RJ-0073 (adp-0217,
# META D-0125, D-0062 (a)): QAAVector is retired; the reference is
# removed, not replaced. A benchmark-kind map now gets the same schema
# and invariant checks as any other kind, with no ground-truth
# cross-check against an external workspace.
# BM-1's closed 15-value block-type list, duplicated here only for the
# planted-fault proof harness's own reference; the schema's own enum
# (schemas/source-map.schema.json) is what actually enforces this against
# a source-map instance, via validate_with_jsonschema below.
BM1_BLOCK_TYPES = {
    "context_and_purpose", "distinctive_features", "subject_knowledge",
    "research_methods", "subject_specific_skills", "transferable_skills",
    "teaching_and_learning", "assessment_and_feedback", "benchmark_standards",
    "equality_diversity_inclusion", "accessibility", "sustainability",
    "enterprise_entrepreneurship", "professional_context", "discipline_specific",
}
# institutional-kb has no fixed store file anywhere in the repo (only
# schema/test-fixture/docs copies exist), so it has no default either and
# is validated only when --institutional-kb is given explicitly.

# Schema files
COURSE_DESIGN_SCHEMA = SCHEMAS_DIR / "course-design.schema.json"
GATES_SCHEMA = SCHEMAS_DIR / "design-kb.gates.schema.json"
SOURCE_KB_SCHEMA = SCHEMAS_DIR / "source-kb.schema.json"
INSTITUTIONAL_KB_SCHEMA = SCHEMAS_DIR / "institutional-kb.schema.json"
VOCAB_KB_SCHEMA = SCHEMAS_DIR / "vocab-kb.schema.json"
HECOS_KB_SCHEMA = SCHEMAS_DIR / "hecos-kb.schema.json"
SKELETONS_SCHEMA = SCHEMAS_DIR / "design-kb.skeletons.schema.json"
PALETTE_SCHEMA = SCHEMAS_DIR / "design-kb.palette.schema.json"
TIER_BANDS_SCHEMA = SCHEMAS_DIR / "design-kb.tier-bands.schema.json"
ACTIVITY_PATTERNS_SCHEMA = SCHEMAS_DIR / "design-kb.activity-patterns.schema.json"
CONTENT_SHAPES_SCHEMA = SCHEMAS_DIR / "design-kb.content-shapes.schema.json"
PATHWAYS_SCHEMA = SCHEMAS_DIR / "design-kb.pathways.schema.json"
SOURCE_MAP_SCHEMA = SCHEMAS_DIR / "source-map.schema.json"
CATALOGUE_SCHEMA = SCHEMAS_DIR / "catalogue.schema.json"
CATALOGUE_PATHWAYS_SCHEMA = SCHEMAS_DIR / "catalogue.pathways.schema.json"
CATALOGUE_PATHWAY_SCHEMA = SCHEMAS_DIR / "catalogue.pathway.schema.json"
COMMON_SCHEMA = SCHEMAS_DIR / "common.schema.json"


class ValidationError(Exception):
    """Raised when validation fails."""
    pass


def load_json(path: Path) -> dict:
    """Load JSON from file."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_store(path: Path):
    """
    Load a JSON store file for validation, never letting a missing,
    unreadable, or malformed store crash uncaught.

    Returns (instance, None) on success, or (None, error_message) on
    failure. Every caller prints error_message and sets exit_code = 1;
    it is never a traceback and never a pass.

    Extended: 18 Sep 2026, Prompt 69 — generalised from the try/except
    Prompt 68 wrote for --vocab-kb alone, so every store mode fails the
    same way instead of only vocab-kb catching this and the rest
    crashing with an uncaught FileNotFoundError/JSONDecodeError traceback.
    """
    try:
        if not path.exists():
            raise FileNotFoundError(f"{path} does not exist")
        return load_json(path), None
    except (FileNotFoundError, OSError) as e:
        return None, f"FAIL - store unreadable: {e}"
    except json.JSONDecodeError as e:
        return None, f"FAIL - store is not valid JSON: {e}"


def create_resolver() -> RefResolver:
    """Create a RefResolver that can resolve $ref to common.schema.json."""
    common_schema = load_json(COMMON_SCHEMA)
    # Build a store mapping schema URIs to their contents
    schema_store = {
        common_schema.get("$id", "common.schema.json"): common_schema,
        "common.schema.json": common_schema,  # Also allow relative ref
    }
    # Use the schemas directory as the base URI
    base_uri = f"file://{SCHEMAS_DIR}/"
    return RefResolver(base_uri, {}, store=schema_store)


def validate_with_jsonschema(instance: dict, schema_path: Path, name: str) -> list:
    """
    Validate instance against schema using jsonschema library.
    Returns list of error messages (empty if valid).
    """
    if not HAS_JSONSCHEMA:
        return [f"jsonschema library not available; cannot validate {name}"]

    schema = load_json(schema_path)
    resolver = create_resolver()
    validator = Draft7Validator(schema, resolver=resolver)

    errors = []
    for error in sorted(validator.iter_errors(instance), key=lambda e: str(e.path)):
        path = ".".join(str(p) for p in error.path) if error.path else "(root)"
        errors.append(f"  [{path}] {error.message}")

    return errors


def _gate_type_for_id(gate_id: str, all_types):
    """
    LCR-1 / GF-1 (docs/project/open-decisions.md, Prompt 143); extended by
    CPL-1 (Prompt 153) to also match gates/A5; extended by SHP-1 (Prompt
    175) to resolve against every gate type the gates store currently
    defines (shaped or not), never a hardcoded list, so that a closed
    record whose id matches no store gate at all can be told apart from
    one that matches a real, merely unshaped, gate (Task 3b).
    A course-design gates[] entry's gateId is matched to the gate type it
    names. Phase A gate ids (CTX, A1 to A7, EXM) are bare (GF-1);
    per-lesson gates (Phase B, S) are slug-prefixed
    (gates/<slug>-L<NN>-B<n>), never bare, so they are matched by suffix,
    not by const equality on the whole id. Bare match is tried first
    against every store gate type; suffix match follows, longest type
    name first, so no gate type can be shadowed by another that happens
    to be one of its own suffixes.
    Returns the matched gate type string, or None if gate_id resolves to
    no gate the store defines at all.

    RJ-0108 C (adp-0230): 9 of these types were renamed off the old
    bare "gates/"-prefixed form to a phase-slug id carrying no prefix
    (e.g. crs-03_course-outcomes); such a type is matched by exact
    equality on the whole gateId, tried first alongside the pre-existing
    bare match, since the new form has no prefix to strip and is never
    itself per-lesson-suffixed.
    """
    if gate_id in all_types:
        return gate_id
    if gate_id in {"gates/" + t for t in all_types}:
        return gate_id[len("gates/"):]
    for gate_type in sorted(all_types, key=len, reverse=True):
        if gate_id.endswith("-" + gate_type):
            return gate_type
    # Six-phase per-lesson id form <slug>-L<NN>-les-01 (settled 7 Oct 2026):
    # the manifest id carries a gate type's SHORT id (its phase-number prefix
    # before "_", e.g. les-01), not the full type (les-01_lesson-proposal).
    # Match that last, longest short-id first, so a full-id/suffix match above
    # always wins over it.
    for gate_type in sorted(all_types, key=len, reverse=True):
        short = gate_type.split("_", 1)[0]
        if short != gate_type and gate_id.endswith("-" + short):
            return gate_type
    return None


def load_gate_shapes(gates_path: Path = DEFAULT_GATES):
    """
    LCR-1 (Prompt 143); extended by CPL-1 (Prompt 153) to also load A5's
    shape; extended by SHP-1 (Prompt 175) to read every gate's shape off
    the gates store itself rather than a hardcoded five-type allowlist,
    and to also return the store's full set of gate types (shaped or
    not), so a closed record's id can be resolved against every gate the
    store defines, not only the shaped subset (Task 3b: "FAIL a closed
    record whose id resolves to no store gate").
    Extended by RJ-0060 (GI-2, R18, docs/project/design-phase-logs/
    referencing-introductory.md) to also read each gate's own hardness
    and defaultType off the same store record, keyed the same way, so a
    closed record's provenance value can be checked against the gate it
    belongs to (see _gi2_provenance_error) without a second read of the
    gates store.
    Extended by RJ-0067 (NSK-1, docs/project/open-decisions.md, adp-0217)
    to also read each gate's own sequence off the same store record, so
    the validator can tell which gates the store sequences after "CO"
    without a second read of the gates store and without any list of
    gate ids typed into this script (see the NSK-1 check in
    validate_course_design).
    Reads decidedValueShape off each gate record in the gates store,
    keyed by gate type (the full phase-slug id, e.g. "crs-03_course-outcomes",
    or the tail after a legacy "gates/" prefix).
    Returns (shapes, shaped_types, all_types, gate_meta, error): shapes
    maps gate type to its decidedValueShape; shaped_types is the set of
    gate types the store itself currently says carry one, in SHP-1's own
    words: "the list of gates that carry a shape from the gates store
    itself, never from a list of its own"; all_types is every gate type
    the store defines, shaped or not; gate_meta maps gate type to its
    own {hardness, defaultType, sequence} (GI-2, R18; NSK-1). Returns
    ({}, set(), set(), {}, error) on any load failure rather than
    raising, since course-design validation still runs its full-schema
    pass even if the gates store cannot be read; the caller reports the
    load failure as its own error.
    """
    shapes = {}
    all_types = set()
    gate_meta = {}
    try:
        gates_doc = load_json(gates_path)
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        return {}, set(), set(), {}, f"could not read gates store at {gates_path} to apply LCR-1 record shapes"
    for gate in gates_doc.get("gates", []):
        gate_id = gate.get("id", "")
        if gate_id.startswith("gates/"):
            gate_type = gate_id[len("gates/"):]
        elif gate_id:
            # RJ-0108 C (adp-0230): 9 gates renamed off the old "gates/"
            # prefix to a phase-slug id (e.g. crs-03_course-outcomes) carry
            # no prefix to strip; the full id is its own type, so it is not
            # skipped here as it was before this fix.
            gate_type = gate_id
        else:
            continue
        all_types.add(gate_type)
        shape = gate.get("decidedValueShape")
        if shape:
            shapes[gate_type] = shape
        gate_meta[gate_type] = {
            "hardness": gate.get("hardness"),
            "defaultType": gate.get("defaultType"),
            "sequence": gate.get("sequence"),
        }
    return shapes, set(shapes.keys()), all_types, gate_meta, None


def _gi2_provenance_error(gate_id, seq, provenance, meta):
    """
    GI-2 (docs/project/open-decisions.md, 27 Aug 2026) narrowly checked:
    only the two directions GI-2's own text evidences, nothing invented
    beyond it (RJ-0060, R18). GI-2's two found mislabels were a
    defaultType confusion (A6, defaultType ai-proposal-stands, recorded
    as ai-default-stood, "the value reserved for fixed-value defaultType
    gates") and a hardness confusion (A7, hardness advisory, recorded as
    human-confirmed, "implying a confirmation ask that never took place
    \u2014 advisories are stated ... never opened for confirmation").
    Checks both directions of each: ai-default-stood requires
    defaultType fixed-value; ai-proposal-stood requires defaultType
    ai-proposal-stands; advisory-stated requires hardness advisory;
    human-confirmed on an advisory-hardness gate is the converse of
    GI-2's own A7 finding. Returns an error string, or None if no GI-2
    mismatch is found or meta is unavailable for this gate type.
    """
    if not meta:
        return None
    hardness = meta.get("hardness")
    default_type = meta.get("defaultType")
    if provenance == "ai-default-stood" and default_type != "fixed-value":
        return (
            f"  [{gate_id} seq {seq} provenance] 'ai-default-stood' is reserved for "
            f"fixed-value defaultType gates (GI-2); this gate's defaultType is "
            f"'{default_type}'"
        )
    if provenance == "ai-proposal-stood" and default_type != "ai-proposal-stands":
        return (
            f"  [{gate_id} seq {seq} provenance] 'ai-proposal-stood' is reserved for "
            f"ai-proposal-stands defaultType gates (GI-2); this gate's defaultType is "
            f"'{default_type}'"
        )
    if provenance == "advisory-stated" and hardness != "advisory":
        return (
            f"  [{gate_id} seq {seq} provenance] 'advisory-stated' is reserved for "
            f"advisory-hardness gates (GI-2); this gate's hardness is '{hardness}'"
        )
    if provenance == "human-confirmed" and hardness == "advisory":
        return (
            f"  [{gate_id} seq {seq} provenance] 'human-confirmed' implies a confirmation "
            f"ask; advisory gates are stated, never opened for confirmation (GI-2); this "
            f"gate's hardness is 'advisory'"
        )
    return None


def load_skeleton_archetype_slots(skeletons_path: Path = DEFAULT_SKELETONS):
    """
    CPL-1 (docs/project/open-decisions.md, Prompt 153): read each of the
    three archetypes gate A5's plan can name pages against
    (skeletons/lesson, skeletons/wrapper-open, skeletons/wrapper-close) off
    the skeletons store, as {archetype_id: {slotType: [contextCoupling...]}}.
    Returns ({}, error) on any load failure, the same shape load_gate_shapes
    returns, rather than raising.
    """
    slots_by_archetype = {}
    try:
        skeletons_doc = load_json(skeletons_path)
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        return {}, f"could not read skeletons store at {skeletons_path} to apply CPL-1 slot/depth checks"
    wanted = ("skeletons/lesson", "skeletons/wrapper-open", "skeletons/wrapper-close")
    for archetype in skeletons_doc.get("archetypes", []):
        archetype_id = archetype.get("id")
        if archetype_id not in wanted:
            continue
        slot_map = {}
        for block in archetype.get("blockSequence", []):
            slot = block.get("slot")
            if isinstance(slot, dict) and slot.get("slotType"):
                slot_map[slot["slotType"]] = slot.get("contextCoupling", [])
        slots_by_archetype[archetype_id] = slot_map
    return slots_by_archetype, None


def _vds_changed_paths(old, new, prefix=""):
    """Coarsest decidedValue dot-paths where `new` differs from `old`
    (published-course edit-mode; field-locks-and-edit-mode.md)."""
    if json.dumps(old, sort_keys=True) == json.dumps(new, sort_keys=True):
        return []
    if isinstance(old, dict) and isinstance(new, dict):
        out = []
        for k in set(list(old.keys()) + list(new.keys())):
            sub = f"{prefix}.{k}" if prefix else k
            out += _vds_changed_paths(old.get(k), new.get(k), sub)
        return out
    return [prefix or "(root)"]


def _vds_covered(path, locks):
    return any(path == u or path.startswith(u + ".") or u.startswith(path + ".") for u in locks)


def validate_course_design(
    instance: dict,
    instance_path: Path,
    gates_path: Path = DEFAULT_GATES,
    skeletons_path: Path = DEFAULT_SKELETONS,
) -> list:
    """
    Validate a course-design instance.
    Returns list of error messages (empty if valid).
    """
    errors = []

    # 1. JSON Schema validation
    schema_errors = validate_with_jsonschema(instance, COURSE_DESIGN_SCHEMA, "course-design")
    errors.extend(schema_errors)

    # Additional structural checks are handled by the schema's conditional rules:
    # - closed records require decidedValue
    # - closed records require provenance UNLESS reconstruction.basis is "inferred"
    # - human-amended requires originalProposal
    # - deferred requires deferReason
    # These are already encoded in course-design.schema.json via allOf/if/then

    # 2. LCR-1 (docs/project/open-decisions.md, Prompt 143): per-gate record
    # shapes from the gates store, applied to decidedValue on every gate
    # type the store itself currently shapes. Structural invariant the
    # schema itself cannot express (GF-1's slug-prefixed per-lesson gate
    # ids have no sibling gateId visible to a record-level schema
    # conditional \u2014 see decidedValueShape's own description in
    # design-kb.gates.schema.json). Extended by SHP-1 (Prompt 175): the
    # set of gate types checked is read from the store at call time
    # (load_gate_shapes), never from a hardcoded list, and only CLOSED
    # records are checked; a course with no closed record that reaches a
    # shape fails, it does not pass (see the shp1_checked count below).
    if not HAS_JSONSCHEMA:
        return errors

    gate_shapes, shaped_types, all_gate_types, gate_meta, load_error = load_gate_shapes(gates_path)
    if load_error:
        errors.append(f"  [gates] {load_error}")
        return errors

    course_outcome_ids = set()
    lesson_map_keys = set()  # crs-04_lesson-map decidedValue.lessons[].key (was gates/A3, LK-1)
    lesson_serves = []  # (gate_id, seq, serves): crs-04 lessons[].outcomes[].serves (was gates/B1)
    confidence_outcome_ids = set()  # AL-4: crs-03 courseOutcomeBanks[].outcomeId (confidence; was gates/A6 act-02)
    confidence_seen = False  # True once crs-03's courseOutcomeBanks are walked
    shp1_checked = 0  # SHP-1 (Prompt 175): closed records checked against a shape
    shp1_failed = 0
    gi2_checked = 0  # GI-2 (RJ-0060, R18): closed records checked, provenance vs hardness/defaultType
    gi2_failed = 0
    nsk1_offenders = []  # RJ-0067 (NSK-1, adp-0217): (gate_id, seq, gate_type) for closed crs-04/after-outcomes records
    co_record_seen = False  # RJ-0067 (NSK-1): True once any record, any state, is seen under a gate resolving to "CO"
    co_sequence = gate_meta.get("crs-03_course-outcomes", {}).get("sequence") if gate_meta.get("crs-03_course-outcomes") else None

    for gate_entry in instance.get("gates", []):
        gate_id = gate_entry.get("gateId", "")
        gate_type = _gate_type_for_id(gate_id, all_gate_types)
        shape = gate_shapes.get(gate_type) if gate_type else None
        # Only the authoritative (non-superseded) record of a gate feeds the
        # cross-store aggregations below (LK-1's lesson_map_keys, OC-1/CO-1's
        # lesson_serves). A record whose seq is named in another record's
        # `supersedes` has been replaced - e.g. a reopened crs-04_lesson-map
        # whose earlier lowercase keys were corrected to the LN-1 form - and
        # cross-checking its decidedValue reads stale data. Append-only history
        # keeps the superseded record on disk; it is simply not authoritative.
        superseded_seqs = {
            r.get("supersedes")
            for r in gate_entry.get("records", [])
            if isinstance(r.get("supersedes"), int)
        }
        for record in gate_entry.get("records", []):
            # RJ-0067 (NSK-1, adp-0217): a crs-03_course-outcomes record is
            # seen here, before the decidedValue skip below, so "no outcomes
            # record" means what it says (no record under
            # crs-03_course-outcomes at all), not "no outcomes record that
            # happens to carry a decidedValue".
            if gate_type == "crs-03_course-outcomes":
                co_record_seen = True
            decided_value = record.get("decidedValue")
            if decided_value is None:
                continue
            seq = record.get("seq", "?")

            # SHP-1 (docs/project/open-decisions.md, Prompt 175): every
            # CLOSED record whose gate carries a decidedValueShape (read
            # from the store itself, never a hardcoded list \u2014 see
            # load_gate_shapes) is checked against it, one PASS/FAIL line
            # printed per checked record. Non-closed records (proposed,
            # assumed, deferred, skipped) are not shape-checked: SHP-1's
            # own ruling speaks only of "closed record[s]".
            # A superseded record is historical, not authoritative (see the
            # superseded_seqs note above): it is not shape-checked, so a shape
            # tightened by a later reopen (e.g. les-01 check 2 -> 3 items) does
            # not retroactively fail the record it replaced.
            if record.get("state") == "closed" and shape and seq not in superseded_seqs:
                shp1_checked += 1
                validator = Draft7Validator(shape)
                shape_errors = sorted(
                    validator.iter_errors(decided_value), key=lambda e: str(e.path)
                )
                if shape_errors:
                    shp1_failed += 1
                    print(f"SHP-1 FAIL: {gate_id} seq {seq} ({gate_type})")
                    for error in shape_errors:
                        path = ".".join(str(p) for p in error.path) if error.path else "(root)"
                        errors.append(
                            f"  [{gate_id} seq {seq} decidedValue.{path}] {error.message} (LCR-1 shape)"
                        )
                else:
                    print(f"SHP-1 PASS: {gate_id} seq {seq} ({gate_type})")
            elif record.get("state") == "closed" and gate_type is None and seq not in superseded_seqs:
                # Task 3b (Prompt 175): "FAIL a closed record whose id
                # resolves to no store gate, naming it" \u2014 distinct from
                # a record whose gate is real but simply unshaped (that
                # case falls through both branches here, silently, since
                # it is not a shape fault).
                print(f"SHP-1 FAIL: {gate_id} seq {seq} (no matching store gate)")
                errors.append(
                    f"  [{gate_id} seq {seq}] SHP-1: gateId resolves to no gate defined in the store (LCR-1 shape)"
                )

            # GI-2 (docs/project/open-decisions.md, 27 Aug 2026; RJ-0060,
            # R18 docs/project/design-phase-logs/referencing-introductory.md):
            # a closed record's provenance word is checked against its own
            # gate's hardness and defaultType (see _gi2_provenance_error for
            # the exact, narrowly-evidenced rule). Only closed records with
            # a provenance value and a gate type that resolves in the store
            # are checked; a record whose gate does not resolve is already
            # reported by the SHP-1 branch above and is not double-counted
            # here.
            provenance = record.get("provenance")
            if record.get("state") == "closed" and provenance and gate_type:
                gi2_checked += 1
                gi2_error = _gi2_provenance_error(gate_id, seq, provenance, gate_meta.get(gate_type))
                if gi2_error:
                    gi2_failed += 1
                    print(f"GI-2 FAIL: {gate_id} seq {seq} ({gate_type}) provenance={provenance}")
                    errors.append(gi2_error)
                else:
                    print(f"GI-2 PASS: {gate_id} seq {seq} ({gate_type}) provenance={provenance}")

            # RJ-0067 (docs/project/open-decisions.md, NSK-1, adp-0217): "a
            # course design record with a closed lesson map, or a closed
            # record for any gate the store sequences after the outcomes
            # gate, and no outcomes record, fails validation with a named
            # error." Remembered here, closed record by closed record, so the
            # summary check after the walk below can fail the whole course
            # design once, by name, instead of the OC-1/CO-1 and AL-4 checks
            # further down silently skipping it (both only run "if
            # course_outcome_ids", which stays empty whenever
            # crs-03_course-outcomes carries no record, so neither has
            # anything to report even though a later-sequenced gate has
            # already closed a record depending on a course outcome
            # existing). "Closed" is read the same way SHP-1 and GI-2 read it
            # above (record.get("state") == "closed"); "sequenced after the
            # outcomes gate" is read from gate_meta's own sequence field
            # (co_sequence = crs-03_course-outcomes' sequence), never from a
            # list of gate ids typed into this script. crs-04_lesson-map (the
            # lesson map, old gates/A3) is named explicitly and is, in the
            # store as it stands, already sequenced after the outcomes gate;
            # both conditions are kept here so the check still names the
            # lesson map correctly if a future store ever resequenced it
            # ahead of the outcomes gate.
            if record.get("state") == "closed" and (
                gate_type == "crs-04_lesson-map"
                or (
                    gate_type is not None
                    and co_sequence is not None
                    and gate_meta.get(gate_type, {}).get("sequence") is not None
                    and gate_meta[gate_type]["sequence"] > co_sequence
                )
            ):
                nsk1_offenders.append((gate_id, seq, gate_type))

            if gate_type == "crs-03_course-outcomes" and isinstance(decided_value, dict):
                # crs-03 carries both the course outcomes and their per-outcome
                # banks. courseOutcomes feed the OC-1/CO-1 and AL-4 cross-checks;
                # each courseOutcomeBank's outcomeId is that outcome's confidence
                # statement (AL-4; confidence moved onto crs-03's banks from the
                # retired act-02 gate, six-phase migration 8 Oct 2026).
                for co in decided_value.get("courseOutcomes", []) or []:
                    if isinstance(co, dict) and "id" in co:
                        course_outcome_ids.add(co["id"])
                banks = decided_value.get("courseOutcomeBanks", []) or []
                if banks:
                    confidence_seen = True
                for bank in banks:
                    if isinstance(bank, dict) and bank.get("outcomeId"):
                        confidence_outcome_ids.add(bank["outcomeId"])
            if gate_type == "crs-04_lesson-map" and isinstance(decided_value, dict) and seq not in superseded_seqs:
                for lesson in decided_value.get("lessons", []) or []:
                    if not isinstance(lesson, dict):
                        continue
                    if lesson.get("key"):
                        lesson_map_keys.add(lesson["key"])
                    # OC-1/CO-1: each lesson outcome's `serves` names a course
                    # outcome (lesson outcomes live in the map now, A6.1).
                    for outcome in lesson.get("outcomes", []) or []:
                        if isinstance(outcome, dict) and "serves" in outcome:
                            lesson_serves.append((gate_id, seq, outcome["serves"]))

    # SHP-1 (docs/project/open-decisions.md, Prompt 175): "A course with
    # no closed record that reaches a shape fails; it does not pass."
    # Printed and counted once, after every gate/record has been walked,
    # never per-gate.
    print(f"SHP-1: {shp1_checked} closed record(s) checked against a decidedValueShape, {shp1_failed} failed")
    if shp1_checked == 0:
        errors.append(
            "  [gates] SHP-1: no closed record in this course-design reaches a decidedValueShape (0 checked)"
        )

    # UNLOCK-SCOPE (field-locks-and-edit-mode.md): once a course is published
    # (status 'production'), a superseding record written AFTER publishedAt may
    # change only the decidedValue paths it unlocks; every other field must be
    # carried forward verbatim. Records written at or before publishedAt (the
    # initial-authoring history captured at publish) are grandfathered.
    if instance.get("status") == "production":
        published_at = instance.get("publishedAt")
        us_checked = 0
        for gate in instance.get("gates", []):
            recs = gate.get("records", [])
            by_seq = {r.get("seq"): r for r in recs}
            for r in recs:
                sup = r.get("supersedes")
                if not isinstance(sup, int):
                    continue
                ts = r.get("timestamp")
                if published_at and ts and ts <= published_at:
                    continue  # pre-publish reopen, grandfathered
                prior = by_seq.get(sup)
                if prior is None:
                    continue
                locks = r.get("unlocked") or []
                changed = _vds_changed_paths(
                    prior.get("decidedValue"), r.get("decidedValue")
                )
                stray = [p for p in changed if not _vds_covered(p, locks)]
                us_checked += 1
                if stray:
                    errors.append(
                        f"  [{gate.get('gateId')} seq {r.get('seq')}] UNLOCK-SCOPE: "
                        f"changed locked path(s) {stray} not in unlocked {locks} "
                        f"(published course; field-locks-and-edit-mode.md)"
                    )
        print(f"UNLOCK-SCOPE: {us_checked} post-publish superseding record(s) checked")
    else:
        print("UNLOCK-SCOPE: course not published (status != production); skipped")

    # GI-2 (RJ-0060, R18): printed and counted once, after every
    # gate/record has been walked, matching SHP-1's own summary-line
    # convention above. Unlike SHP-1, a course with zero checked records
    # is not itself a failure here (GI-2 applies narrowly only where
    # provenance is present on a closed record resolving to a known
    # gate type, not to every closed record in general), so no
    # zero-checked error is raised.
    print(f"GI-2: {gi2_checked} closed record(s) checked for provenance vs hardness/defaultType, {gi2_failed} failed")

    # RJ-0067 (docs/project/open-decisions.md, NSK-1, adp-0217): printed and
    # counted once, after every gate/record has been walked, matching
    # SHP-1's and GI-2's own summary-line convention above. This closes the
    # silent skip: without it, a course design with a closed lesson map (or a
    # closed record on any gate sequenced after the outcomes gate) and no
    # crs-03_course-outcomes record at all would reach neither the OC-1/CO-1
    # cross-check nor AL-4 below,
    # both of which only run "if course_outcome_ids", and so would pass
    # with nothing reported.
    print(f"NSK-1: {len(nsk1_offenders)} closed lesson-map/after-outcomes record(s) found, crs-03_course-outcomes record present: {co_record_seen}")
    if nsk1_offenders and not co_record_seen:
        for offender_gate_id, offender_seq, offender_gate_type in nsk1_offenders:
            errors.append(
                f"  [{offender_gate_id} seq {offender_seq} ({offender_gate_type})] "
                f"NSK-1: this record is closed and depends on a course outcome "
                f"existing, but this course design carries no crs-03_course-outcomes record at all"
            )

    # LCR-1's OC-1/CO-1 row: "at any time, a serves naming no real course
    # outcome" fails \u2014 a cross-record check (crs-04 lesson outcomes'
    # serves against crs-03's course outcomes within the same document), not
    # expressible in a single-object decidedValueShape. course_outcome_ids is
    # built from crs-03_course-outcomes' decidedValue.courseOutcomes; the
    # lesson outcomes (with their serves) live in crs-04_lesson-map's
    # lessons[].outcomes (A6.1; six-phase migration 8 Oct 2026, off the
    # retired gates/A3 + gates/B1). Only enforced when at least one course
    # outcome was found; otherwise there is nothing yet to check serves
    # against.
    if course_outcome_ids:
        for gate_id, seq, serves in lesson_serves:
            if serves not in course_outcome_ids:
                errors.append(
                    f"  [{gate_id} seq {seq} decidedValue.outcomes[].serves] "
                    f"'{serves}' names no course outcome in crs-03_course-outcomes's decidedValue.courseOutcomes "
                    f"(LCR-1 OC-1/CO-1 cross-check)"
                )

    # AL-4 (docs/project/open-decisions.md, Prompt 173; quoted in
    # .claude/commands/gate.md step 6): "every course outcome carries at
    # least one confidence statement." In the six-phase model the
    # confidence statements live on crs-03's own courseOutcomeBanks, one
    # bank per outcome keyed by outcomeId (confidence moved onto crs-03's
    # banks from the retired act-02 gate, 8 Oct 2026), so AL-4 is now an
    # intra-crs-03 cross-check: every courseOutcomes[].id must appear as a
    # courseOutcomeBanks[].outcomeId. Enforced only when crs-03's
    # courseOutcomes and at least one bank are both present; otherwise
    # there is nothing yet to check a statement against.
    if course_outcome_ids and confidence_seen:
        for co_id in sorted(course_outcome_ids):
            if co_id not in confidence_outcome_ids:
                errors.append(
                    f"  [crs-03_course-outcomes decidedValue.courseOutcomes] "
                    f"'{co_id}' carries no confidence statement in crs-03_course-outcomes decidedValue.courseOutcomeBanks[].outcomeId "
                    f"(AL-4)"
                )

    # LK-1 (docs/project/open-decisions.md, Prompt 154): once a course
    # carries instantiations[], every crs-04_lesson-map decidedValue.lessons[].key
    # must have a matching pageType "lesson" instantiation and vice versa
    # \u2014 the two identifiers LK-1 requires to be the same value.
    # Enforced only when instantiations[] is non-empty, following the
    # OC-1/CO-1 cross-check's own rule of never checking against data
    # that is not there yet.
    if instance.get("instantiations"):
        lesson_instantiation_keys = {
            inst.get("pageKey")
            for inst in instance.get("instantiations", []) or []
            if isinstance(inst, dict) and inst.get("pageType") == "lesson" and inst.get("pageKey")
        }
        # Direction 1 (crs-04 -> instantiation): a planned lesson with no
        # instantiation is not-yet-landed during incremental LES authoring,
        # not an error. Completeness (every planned lesson built) is a
        # build-readiness check enforced at LES-close by manifest-completeness
        # (clauses 1-2), carved out during the LES phase (land.md). Report it,
        # do not fail the per-land validator on it.
        not_yet_instantiated = sorted(lesson_map_keys - lesson_instantiation_keys)
        if not_yet_instantiated:
            print(
                f"LK-1: {len(not_yet_instantiated)} crs-04 lesson(s) not yet instantiated "
                f"(expected during incremental LES landing; completeness enforced at LES-close): "
                f"{', '.join(not_yet_instantiated)}"
            )
        # Direction 2 (instantiation -> crs-04): an instantiation naming no
        # crs-04 lesson is always an error (an orphan page, or a key-case drift).
        for missing_a3_key in sorted(lesson_instantiation_keys - lesson_map_keys):
            errors.append(
                f"  [instantiations] instantiations[] lesson pageKey '{missing_a3_key}' "
                f"names no crs-04_lesson-map decidedValue.lessons[].key (LK-1 cross-check)"
            )

    # CPL-1 (docs/project/open-decisions.md, Prompt 153): coupling is no
    # longer a standalone les-03_context-coupling-plan plan. Since the
    # six-phase migration (gate-redesign-2026-10-06.md, 8 Oct 2026) each
    # built page's coupling lives in the manifest's own instantiations[]
    # (pageKey + slotChoices[].contextCoupling), where les-01, wra-01/02 and
    # wra-03 deposit it via the land step. CPL-1 now validates that
    # instantiations coupling, not a retired plan. Two checks remain
    # well-defined here and are not already covered by clause 6 (slotKey
    # resolution) or the LK-1 page cross-check above: no pageKey appears
    # twice, and every coupled slot carries a variationType. The old
    # plan-shape, CP-1h per-lesson coverage and wrapper-coverage invariants
    # depended on the retired plan; the lesson-key cross-checks they shared
    # with the old gates/A3 are now carried by the crs-04_lesson-map
    # realignment above (LK-1), but the coupling-coverage invariants
    # themselves (every lesson has a coupled slot; both wrappers coupled)
    # move to the content-stage instantiations validation, still pending
    # until a course carries built, coupled instantiations, rather than
    # being enforced here against a plan that no longer exists.
    instantiations = instance.get("instantiations", []) or []
    coupled_slots = []  # (pageKey, slotKey, variationType)
    for inst in instantiations:
        if not isinstance(inst, dict):
            continue
        page = inst.get("pageKey")
        for sc in (inst.get("slotChoices", []) or []):
            if not isinstance(sc, dict):
                continue
            cc = sc.get("contextCoupling")
            if isinstance(cc, dict) and cc.get("coupled") is True:
                coupled_slots.append((page, sc.get("slotKey"), cc.get("variationType")))

    if not coupled_slots:
        print("CPL-1: NOT YET REACHABLE (no coupled slot in instantiations[])")
    else:
        cpl1_pagekey_checked = 0
        seen_page_keys = set()
        for inst in instantiations:
            if not isinstance(inst, dict):
                continue
            page = inst.get("pageKey")
            cpl1_pagekey_checked += 1
            if page in seen_page_keys:
                errors.append(
                    f"  [instantiations] pageKey '{page}' appears more than once "
                    f"(CPL-1 duplicate-page check)"
                )
            seen_page_keys.add(page)

        valid_variation = {"token-substitution", "structured-fields", "whole-prose"}
        cpl1_variation_checked = 0
        for page, slot_key, variation in coupled_slots:
            cpl1_variation_checked += 1
            if variation not in valid_variation:
                errors.append(
                    f"  [instantiations] page '{page}' slot '{slot_key}' is coupled "
                    f"but its contextCoupling.variationType is '{variation}', not one of "
                    f"{sorted(valid_variation)} (CPL-1 coupled-variationType check)"
                )

        print(f"CPL-1 duplicate-page: {cpl1_pagekey_checked} page(s) checked")
        if cpl1_pagekey_checked == 0:
            errors.append("  [instantiations] CPL-1 duplicate-page check: 0 pages checked (I60)")
        print(f"CPL-1 coupled-variationType: {cpl1_variation_checked} coupled slot(s) checked")
        if cpl1_variation_checked == 0:
            errors.append("  [instantiations] CPL-1 coupled-variationType check: 0 slots checked (I60)")

    return errors


def validate_gates_file(instance: dict, instance_path: Path) -> list:
    """
    Validate design-kb.gates.json against schema plus structural invariants.
    Returns list of error messages (empty if valid).
    """
    errors = []

    # 1. JSON Schema validation
    schema_errors = validate_with_jsonschema(instance, GATES_SCHEMA, "design-kb.gates")
    errors.extend(schema_errors)

    # 2. Structural invariants the schema cannot express
    gates = instance.get("gates", [])

    # 2a. Exactly 24 gates (gate realignment Round C, 7 Oct 2026, gate-redesign-2026-10-06.md:
    # ONB 4 + CXS 6 + CRS 5 + LES 1 + WRA 4 + CXP 4; the old 30-gate model's merges/drops
    # reduced to 21, then the two post-scaffold WRA authoring gates wra-03_summative and
    # wra-04_confidence were added 8 Oct 2026 (WRA 2 -> 4, total 23), and the reserved
    # cxs-06_resources placeholder was added 8 Oct 2026 (Abbott: resources drawer, CXS 5 -> 6,
    # total 24)).
    if len(gates) != 24:
        errors.append(f"  [invariant] Expected exactly 24 gates, found {len(gates)}")

    # 2b. Gate IDs unique
    gate_ids = [g.get("id") for g in gates]
    seen = set()
    duplicates = set()
    for gid in gate_ids:
        if gid in seen:
            duplicates.add(gid)
        seen.add(gid)
    if duplicates:
        errors.append(f"  [invariant] Duplicate gate IDs: {sorted(duplicates)}")

    # Build lookup for dependency resolution
    gate_id_set = set(gate_ids)

    # 2c. Every dependsOn target resolves to an existing gate id
    for gate in gates:
        gid = gate.get("id", "<unknown>")
        depends_on = gate.get("dependsOn", [])
        for dep in depends_on:
            target = dep.get("gate")
            if target and target not in gate_id_set:
                errors.append(f"  [invariant] Gate {gid}: dependsOn target '{target}' does not exist")
            # 2d. dependencyClass validation (schema handles enum, but double-check)
            dep_class = dep.get("dependencyClass")
            if dep_class not in {"constitutive", "substantive", "nominal"}:
                errors.append(f"  [invariant] Gate {gid}: invalid dependencyClass '{dep_class}'")

    # 2e. Any gate marked propagationScope "universal" grounds the whole conversation and
    # therefore carries NO dependsOn edges (generic form; the gate realignment, Round C,
    # retired the old single facets gate `crs-01_course-facets` that this invariant was
    # pinned to — theme/pitch now ground the course across onb-01..03).
    for gate in gates:
        if gate.get("propagationScope") == "universal" and gate.get("dependsOn"):
            errors.append(f"  [invariant] Gate {gate.get('id')}: propagationScope 'universal' must have NO dependsOn edges, found {len(gate.get('dependsOn', []))}")

    # 2f. Hard-stop gates carry defaultType "none"
    for gate in gates:
        gid = gate.get("id", "<unknown>")
        hardness = gate.get("hardness")
        default_type = gate.get("defaultType")
        if hardness == "hard-stop" and default_type != "none":
            errors.append(f"  [invariant] Gate {gid}: hard-stop gate must have defaultType 'none', found '{default_type}'")

    return errors


def validate_source_kb(instance: dict, instance_path: Path) -> list:
    """
    Validate a source-kb instance.
    Returns list of error messages (empty if valid).
    """
    errors = []
    schema_errors = validate_with_jsonschema(instance, SOURCE_KB_SCHEMA, "source-kb")
    errors.extend(schema_errors)
    return errors


def validate_institutional_kb(instance: dict, instance_path: Path) -> list:
    """
    Validate an institutional-kb instance.
    Returns list of error messages (empty if valid).
    """
    errors = []
    schema_errors = validate_with_jsonschema(instance, INSTITUTIONAL_KB_SCHEMA, "institutional-kb")
    errors.extend(schema_errors)
    return errors


def validate_vocab_kb(instance: dict, instance_path: Path) -> list:
    """
    Validate a vocab-kb instance (e.g. vocab-kb/cah.json).
    Returns list of error messages (empty if valid).

    Structural invariants the schema cannot express (Prompt 68):
    - cah1/cah2/cah3 must each be present and non-empty (an empty or missing
      store must FAIL, never pass vacuously)
    - every cah2 row's parent must resolve to an existing cah1 code
    - every cah3 row's parent must resolve to an existing cah2 code
    - no code may appear twice across cah1+cah2+cah3 combined
    """
    errors = []

    # 1. JSON Schema validation
    schema_errors = validate_with_jsonschema(instance, VOCAB_KB_SCHEMA, "vocab-kb")
    errors.extend(schema_errors)

    # 2. Structural invariants
    cah1 = instance.get("cah1", [])
    cah2 = instance.get("cah2", [])
    cah3 = instance.get("cah3", [])

    # 2a. Each array present and non-empty. Zero rows is a failure,
    # never a pass, even though the schema's minItems already catches this -
    # an explicit invariant makes the failure reason legible without relying
    # on jsonschema's message wording.
    for level_name, level_rows in (("cah1", cah1), ("cah2", cah2), ("cah3", cah3)):
        if not level_rows:
            errors.append(f"  [invariant] '{level_name}' is missing or empty; a vocab-kb store with zero rows must fail")

    # 2b. cah2 parent resolves to a cah1 code
    cah1_codes = {row.get("code") for row in cah1 if isinstance(row, dict)}
    for row in cah2:
        if not isinstance(row, dict):
            continue
        parent = row.get("parent")
        if parent not in cah1_codes:
            errors.append(f"  [invariant] cah2 row '{row.get('code')}': parent '{parent}' does not resolve to a cah1 code")

    # 2c. cah3 parent resolves to a cah2 code
    cah2_codes = {row.get("code") for row in cah2 if isinstance(row, dict)}
    for row in cah3:
        if not isinstance(row, dict):
            continue
        parent = row.get("parent")
        if parent not in cah2_codes:
            errors.append(f"  [invariant] cah3 row '{row.get('code')}': parent '{parent}' does not resolve to a cah2 code")

    # 2d. No duplicate codes across cah1+cah2+cah3 combined
    all_codes = [row.get("code") for row in (cah1 + cah2 + cah3) if isinstance(row, dict)]
    seen = set()
    duplicates = set()
    for code in all_codes:
        if code in seen:
            duplicates.add(code)
        seen.add(code)
    if duplicates:
        errors.append(f"  [invariant] Duplicate CAH codes: {sorted(duplicates)}")

    return errors


def validate_hecos_kb(instance: dict, instance_path: Path) -> list:
    """
    Validate a hecos-kb instance (vocab-kb/hecos.json).
    Returns list of error messages (empty if valid).

    Structural invariants the schema cannot express (HSV-1, adp-0184):
    - 'terms' must be present and non-empty (an empty or missing store
      must FAIL, never pass vacuously)
    - every term's cah3 code must resolve to an existing CAH3 code in
      vocab-kb/cah.json (a dangling reference FAILs)

    The CAH3 cross-check loads vocab-kb/cah.json from its fixed default
    path, the same cross-store pattern validate_source_maps uses for
    content-shapes/source-kb/catalogue-pathways above: if the CAH store
    itself is unreadable or carries zero cah3 codes, that is reported as
    its own cross-store error rather than letting every term pass
    vacuously against an empty reference set.
    """
    errors = []

    # 1. JSON Schema validation
    schema_errors = validate_with_jsonschema(instance, HECOS_KB_SCHEMA, "hecos-kb")
    errors.extend(schema_errors)

    # 2. Structural invariants
    terms = instance.get("terms", [])

    # 2a. terms present and non-empty. Zero rows is a failure, never a
    # pass, even though the schema's minItems already catches this - an
    # explicit invariant makes the failure reason legible without relying
    # on jsonschema's message wording (mirrors validate_vocab_kb above).
    if not terms:
        errors.append("  [invariant] 'terms' is missing or empty; a hecos-kb store with zero rows must fail")

    # 2b. Cross-store: every term's cah3 code resolves to an existing
    # CAH3 code in vocab-kb/cah.json.
    cah_instance, cah_load_error = load_store(DEFAULT_VOCAB_KB)
    if cah_load_error:
        errors.append(f"  [cross-store] vocab-kb/cah.json unreadable: {cah_load_error}")
    else:
        cah3_codes = {row.get("code") for row in cah_instance.get("cah3", []) if isinstance(row, dict)}
        if not cah3_codes:
            errors.append("  [cross-store] vocab-kb/cah.json has zero cah3 codes; the cah3 cross-check cannot pass vacuously")
        for term in terms:
            if not isinstance(term, dict):
                continue
            cah3 = term.get("cah3")
            if cah3 not in cah3_codes:
                errors.append(f"  [invariant] hecos-kb term '{term.get('code')}': cah3 code '{cah3}' does not resolve to an existing CAH3 code")

    return errors


def validate_skeletons(instance: dict, instance_path: Path) -> list:
    """
    Validate design-kb.skeletons.json against schema plus structural invariants.
    Returns list of error messages (empty if valid).
    """
    errors = []
    schema_errors = validate_with_jsonschema(instance, SKELETONS_SCHEMA, "design-kb.skeletons")
    errors.extend(schema_errors)

    # Structural invariants
    archetypes = instance.get("archetypes", [])

    # All six page types must be present
    expected_types = {"wrapper-open", "c-pre", "lesson", "summative", "c-post", "wrapper-close"}
    found_types = {a.get("pageType") for a in archetypes}
    missing = expected_types - found_types
    if missing:
        errors.append(f"  [invariant] Missing page types: {sorted(missing)}")

    # Archetype IDs must be unique
    arch_ids = [a.get("id") for a in archetypes]
    seen = set()
    duplicates = set()
    for aid in arch_ids:
        if aid in seen:
            duplicates.add(aid)
        seen.add(aid)
    if duplicates:
        errors.append(f"  [invariant] Duplicate archetype IDs: {sorted(duplicates)}")

    # PSR-1 (20 September 2026): positionRules invariants, for any slot that carries them.
    position_rules_count = 0
    for archetype in archetypes:
        arch_id = archetype.get("id", "?")
        for block in archetype.get("blockSequence", []):
            slot = block.get("slot")
            if not slot:
                continue
            rules = slot.get("positionRules")
            if not rules:
                continue
            position_rules_count += 1
            label = f"{arch_id}/{block.get('key', '?')}"
            own_coupling = set(slot.get("contextCoupling", []))
            band_max = slot.get("band", {}).get("max")

            seen_positions = []
            rest_index = None
            for i, rule in enumerate(rules):
                pos = rule.get("position")
                if pos == "rest":
                    if rest_index is not None:
                        errors.append(f"  [invariant] {label}: positionRules has more than one 'rest' entry")
                    elif i != len(rules) - 1:
                        errors.append(f"  [invariant] {label}: 'rest' is not the last positionRules entry")
                    rest_index = i
                else:
                    if pos in seen_positions:
                        errors.append(f"  [invariant] {label}: positionRules repeats position {pos}")
                    seen_positions.append(pos)
                    if isinstance(band_max, int) and isinstance(pos, int) and pos > band_max:
                        errors.append(f"  [invariant] {label}: positionRules position {pos} exceeds band.max {band_max}")

                for coupling_value in rule.get("contextCoupling", []):
                    if coupling_value not in own_coupling:
                        errors.append(
                            f"  [invariant] {label}: positionRules coupling '{coupling_value}' is not in the slot's own contextCoupling {sorted(own_coupling)}"
                        )

            if isinstance(band_max, int) and rest_index is None:
                covered = {p for p in seen_positions if isinstance(p, int)}
                gap = [p for p in range(1, band_max + 1) if p not in covered]
                if gap:
                    errors.append(f"  [invariant] {label}: positionRules does not cover position(s) {gap} up to band.max {band_max}")

    print(f"  [info] {position_rules_count} slot(s) carry positionRules")

    return errors


def validate_palette(instance: dict, instance_path: Path) -> list:
    """
    Validate design-kb.palette.json against schema plus structural invariants.
    Returns list of error messages (empty if valid).
    """
    errors = []
    schema_errors = validate_with_jsonschema(instance, PALETTE_SCHEMA, "design-kb.palette")
    errors.extend(schema_errors)

    # Structural invariants
    entries = instance.get("entries", [])

    # Entry IDs must be unique
    entry_ids = [e.get("id") for e in entries]
    seen = set()
    duplicates = set()
    for eid in entry_ids:
        if eid in seen:
            duplicates.add(eid)
        seen.add(eid)
    if duplicates:
        errors.append(f"  [invariant] Duplicate palette entry IDs: {sorted(duplicates)}")

    return errors


def validate_tier_bands(instance: dict, instance_path: Path) -> list:
    """
    Validate design-kb.tier-bands.json against schema plus structural invariants.
    Returns list of error messages (empty if valid).
    """
    errors = []
    schema_errors = validate_with_jsonschema(instance, TIER_BANDS_SCHEMA, "design-kb.tier-bands")
    errors.extend(schema_errors)

    # Structural invariants
    tiers = instance.get("tiers", [])

    # All three tiers must be present
    expected_tiers = {"introductory", "intermediate", "advanced"}
    found_tiers = {t.get("tier") for t in tiers}
    missing = expected_tiers - found_tiers
    if missing:
        errors.append(f"  [invariant] Missing tiers: {sorted(missing)}")

    # Tier IDs must be unique
    tier_ids = [t.get("id") for t in tiers]
    seen = set()
    duplicates = set()
    for tid in tier_ids:
        if tid in seen:
            duplicates.add(tid)
        seen.add(tid)
    if duplicates:
        errors.append(f"  [invariant] Duplicate tier-band IDs: {sorted(duplicates)}")

    return errors


def validate_activity_patterns(instance: dict, instance_path: Path) -> list:
    """
    Validate design-kb.activity-patterns.json against schema plus structural
    invariants.

    Extended: 20 Sep 2026, Prompt 126 — cross-store invariants for
    servesShapes (patterns name the content-shapes they serve, CS-1
    follow-on): every servesShapes id must resolve in the content-shapes
    store; every formative/either pattern must carry a non-empty
    servesShapes; every content-shape must be served by at least one
    pattern (zero shapes or zero patterns is a FAIL, never a vacuous
    pass, matching this file's existing zero-rows discipline); every
    realisation's component id must resolve in the palette (not
    previously checked anywhere in this file).
    """
    errors = []
    schema_errors = validate_with_jsonschema(instance, ACTIVITY_PATTERNS_SCHEMA, "design-kb.activity-patterns")
    errors.extend(schema_errors)

    # Structural invariants
    patterns = instance.get("patterns", [])

    # Pattern IDs must be unique
    pattern_ids = [p.get("id") for p in patterns]
    seen = set()
    duplicates = set()
    for pid in pattern_ids:
        if pid in seen:
            duplicates.add(pid)
        seen.add(pid)
    if duplicates:
        errors.append(f"  [invariant] Duplicate activity-pattern IDs: {sorted(duplicates)}")

    # Cross-store invariants (Prompt 126): read the content-shapes
    # and palette stores at their fixed repo paths, same as this file's other
    # DEFAULT_* constants. A missing/unreadable sibling store is reported as
    # its own invariant failure rather than silently skipping the checks that
    # depend on it.
    shapes_instance, shapes_load_error = load_store(DEFAULT_CONTENT_SHAPES)
    if shapes_load_error:
        errors.append(f"  [invariant] Cannot read content-shapes store for servesShapes cross-check: {shapes_load_error}")
        shape_ids = set()
    else:
        shape_ids = {s.get("id") for s in shapes_instance.get("shapes", [])}

    palette_instance, palette_load_error = load_store(DEFAULT_PALETTE)
    if palette_load_error:
        errors.append(f"  [invariant] Cannot read palette store for realisation cross-check: {palette_load_error}")
        palette_ids = set()
    else:
        palette_ids = {e.get("id") for e in palette_instance.get("entries", [])}

    # 4a. Every servesShapes id exists in the content-shapes store.
    shapes_served = set()
    for p in patterns:
        pid = p.get("id", "<unknown>")
        for sid in (p.get("servesShapes") or []):
            shapes_served.add(sid)
            if sid not in shape_ids:
                errors.append(f"  [invariant] Pattern {pid}: servesShapes id '{sid}' does not exist in content-shapes store")

    # 4b. Every pattern with intent formative or either carries a non-empty servesShapes.
    for p in patterns:
        pid = p.get("id", "<unknown>")
        intent = p.get("intent")
        if intent in ("formative", "either") and not p.get("servesShapes"):
            errors.append(f"  [invariant] Pattern {pid}: intent '{intent}' requires a non-empty servesShapes")

    # 4c. Every shape in the content-shapes store is served by at least one
    # pattern. Zero shapes or zero patterns is a FAIL, never a vacuous pass.
    if not shape_ids:
        errors.append("  [invariant] content-shapes store has zero shapes; coverage check cannot pass vacuously")
    elif not patterns:
        errors.append("  [invariant] activity-patterns store has zero patterns; coverage check cannot pass vacuously")
    else:
        unserved = shape_ids - shapes_served
        if unserved:
            errors.append(f"  [invariant] content-shapes with no serving pattern: {sorted(unserved)}")

    # 4d. Every realisation's component id exists in the palette.
    if palette_ids:
        for p in patterns:
            pid = p.get("id", "<unknown>")
            for r in (p.get("realisations") or []):
                cid = r.get("component")
                if cid and cid not in palette_ids:
                    errors.append(f"  [invariant] Pattern {pid}: realisation component '{cid}' does not exist in palette")

    return errors


def validate_pathways(instance: dict, instance_path: Path) -> list:
    """
    Validate design-kb.pathways.json (the consolidated Layer-1 grounding store)
    against schema plus cross-store invariants:
      - pathway ids are unique and non-empty (zero pathways is a FAIL, never a
        vacuous pass, matching this file's zero-rows discipline);
      - every pathway id resolves in catalogue/pathways.json, and every
        catalogue pathway id has a record here (the two id sets match exactly);
      - every bookChunks chunk id (primary and shared) exists in the book
        source-map; every shared.with co-pathway id resolves in the catalogue.
    A missing/unreadable sibling store is its own failure, not a silent skip.
    """
    errors = []
    errors.extend(validate_with_jsonschema(instance, PATHWAYS_SCHEMA, "design-kb.pathways"))

    pathways = instance.get("pathways", [])
    if not pathways:
        errors.append("  [invariant] pathways store has zero pathways; cannot pass vacuously")

    ids = [p.get("id") for p in pathways]
    seen, dupes = set(), set()
    for pid in ids:
        if pid in seen:
            dupes.add(pid)
        seen.add(pid)
    if dupes:
        errors.append(f"  [invariant] Duplicate pathway ids: {sorted(dupes)}")
    rec_ids = set(ids)

    # cross-store: catalogue pathway ids must match this store's ids exactly.
    cat_instance, cat_err = load_store(DEFAULT_CATALOGUE_PATHWAYS)
    if cat_err:
        errors.append(f"  [invariant] Cannot read catalogue/pathways.json for id cross-check: {cat_err}")
        cat_ids = set()
    else:
        cat_ids = {p.get("id") for p in cat_instance.get("pathways", [])}
        for pid in sorted(rec_ids - cat_ids):
            errors.append(f"  [invariant] pathway '{pid}' is not in catalogue/pathways.json")
        for pid in sorted(cat_ids - rec_ids):
            errors.append(f"  [invariant] catalogue pathway '{pid}' has no record in the pathways store")

    # cross-store: every referenced book chunk id must exist in the book map.
    book_map_path = DEFAULT_SOURCE_MAPS_DIR / "book-excelling-at-university-2026.json"
    book_instance, book_err = load_store(book_map_path)
    if book_err:
        errors.append(f"  [invariant] Cannot read book source-map for chunk cross-check: {book_err}")
        chunk_ids = set()
    else:
        chunk_ids = {c.get("id") for c in book_instance.get("chunks", [])}

    for p in pathways:
        pid = p.get("id", "<unknown>")
        bc = p.get("bookChunks", {})
        for cid in bc.get("primary", []):
            if chunk_ids and cid not in chunk_ids:
                errors.append(f"  [invariant] {pid}: primary chunk '{cid}' not in book source-map")
        for s in bc.get("shared", []):
            cid = s.get("chunk")
            if chunk_ids and cid not in chunk_ids:
                errors.append(f"  [invariant] {pid}: shared chunk '{cid}' not in book source-map")
            for w in (s.get("with") or []):
                if cat_ids and w not in cat_ids:
                    errors.append(f"  [invariant] {pid}: shared chunk '{cid}' co-pathway '{w}' not in catalogue")

    return errors


def validate_content_shapes(instance: dict, instance_path: Path) -> list:
    """
    Validate design-kb.content-shapes.json against schema plus structural
    invariants (Prompt 124, CS-1).
    Returns list of error messages (empty if valid).
    """
    errors = []
    schema_errors = validate_with_jsonschema(instance, CONTENT_SHAPES_SCHEMA, "design-kb.content-shapes")
    errors.extend(schema_errors)

    # Structural invariants
    shapes = instance.get("shapes", [])

    # Shape IDs must be unique
    shape_ids = [s.get("id") for s in shapes]
    seen = set()
    duplicates = set()
    for sid in shape_ids:
        if sid in seen:
            duplicates.add(sid)
        seen.add(sid)
    if duplicates:
        errors.append(f"  [invariant] Duplicate content-shape IDs: {sorted(duplicates)}")

    # The Horn-anchored shapes must cover all seven Horn types exactly once
    expected_horn_types = {"fact", "concept", "structure", "classification", "procedure", "process", "principle"}
    horn_types_found = [
        s.get("anchor", {}).get("type")
        for s in shapes
        if isinstance(s.get("anchor"), dict) and s.get("anchor", {}).get("framework") == "horn-information-mapping"
    ]
    missing_horn = expected_horn_types - set(horn_types_found)
    if missing_horn:
        errors.append(f"  [invariant] Missing Horn-anchored types: {sorted(missing_horn)}")
    seen_horn = set()
    duplicate_horn = set()
    for t in horn_types_found:
        if t in seen_horn:
            duplicate_horn.add(t)
        seen_horn.add(t)
    if duplicate_horn:
        errors.append(f"  [invariant] Horn-anchored types covered more than once: {sorted(duplicate_horn)}")

    return errors


def validate_source_maps(maps_dir: Path) -> list:
    """
    Validate every source-map file under maps_dir (SMAP-1, BM-1), excluding
    the gitignored source-kb/source-maps/_text/ companion directory.

    Unlike every other mode in this file, this is a directory scan, not a
    single-instance validation, because SMAP-1 stores one map file per
    source rather than one store file for the whole repo.

    Checks per file, any kind:
      - schema validity against schemas/source-map.schema.json;
      - chunk ids unique within the file;
      - every shapeId resolves in design-kb/design-kb.content-shapes.json;
      - every pathwayTag carries non-empty evidence;
      - every pathwayTag's pathway value resolves in catalogue/pathways.json's
        pathway ids (SMAP-1 AMENDMENT, Prompt 145).

    Book-kind only:
      - every chunk's heading appears verbatim in the resolved source text
        (via textPointer.file, or the source-kb entry's locator.repoPath).

    Benchmark-kind only: no ground-truth cross-check (RJ-0073, adp-0217,
    META D-0125, D-0062 (a)). BM-1 AMENDMENT
    (Prompt 148) cross-checked a benchmark-kind map's chunk ids, headings
    and evidence quotes against QAAVector, an external sibling workspace
    that is now retired; that cross-check is removed, not replaced, since
    no in-repo source holds the same shape (confirmed: this repo's own
    standards module stores a chunk's section text as "heading", not
    "sectionHeading", carries no "text" field at all, only character
    offsets into a separate normalised-text file, and has no per-source
    "percentage verified" file). A benchmark-kind map still gets the same
    schema, shapeId, and pathwayTag checks as any other kind, above; it
    gets no heading or text check against a resolved source (that check
    is book-kind only, below), and no substitute cross-check of any kind.
    (blockType is checked against BM-1's 15-value list by the schema's
    own enum, via validate_with_jsonschema above, not duplicated here.)

    Zero map files, or zero chunks within a file, is a FAIL — never a
    vacuous pass (mirrors the same rule already enforced for content-shapes
    and activity-patterns).

    Returns a list of (file_name, errors, is_benchmark) tuples, one per map
    file found (or a single sentinel tuple, is_benchmark False, if the
    directory is missing or empty). is_benchmark is added by RJ-0073
    follow-up (adp-0218) so the caller's result line can say plainly that
    a PASS on a benchmark-kind map carries no quote cross-check (RJ-0073,
    adp-0217, removed the only such cross-check that ever existed, against
    the now-retired QAAVector workspace; see this function's own docstring
    above for the full history).
    """
    if not maps_dir.exists():
        return [("(no source-maps directory)", [f"FAIL - {maps_dir} does not exist; zero maps is never a vacuous pass"], False)]

    map_files = sorted(
        p for p in maps_dir.iterdir()
        if p.is_file() and p.suffix == ".json"
    )

    if not map_files:
        return [("(no map files)", [f"FAIL - zero source-map files found under {maps_dir}; never a vacuous pass"], False)]

    # Cross-store dependencies, loaded once for all map files.
    cross_store_errors = []

    shape_ids = set()
    shapes_instance, shapes_load_error = load_store(DEFAULT_CONTENT_SHAPES)
    if shapes_load_error:
        cross_store_errors.append(f"  [cross-store] content-shapes store unreadable: {shapes_load_error}")
    else:
        shape_ids = {s.get("id") for s in shapes_instance.get("shapes", [])}

    source_kb_by_id = {}
    source_kb_instance, source_kb_load_error = load_store(DEFAULT_SOURCE_KB)
    if source_kb_load_error:
        cross_store_errors.append(f"  [cross-store] source-kb store unreadable: {source_kb_load_error}")
    else:
        source_kb_by_id = {e.get("id"): e for e in source_kb_instance.get("entries", [])}

    catalogue_pathway_ids = set()
    pathways_instance, pathways_load_error = load_store(DEFAULT_CATALOGUE_PATHWAYS)
    if pathways_load_error:
        cross_store_errors.append(f"  [cross-store] catalogue/pathways.json unreadable: {pathways_load_error}")
    else:
        catalogue_pathway_ids = {p.get("id") for p in pathways_instance.get("pathways", [])}
        if not catalogue_pathway_ids:
            cross_store_errors.append("  [cross-store] catalogue/pathways.json has zero pathway ids; pathwayTag check cannot pass vacuously")

    results = []

    for map_path in map_files:
        errors = list(cross_store_errors)

        instance, load_error = load_store(map_path)
        if load_error:
            results.append((map_path.name, errors + [load_error]))
            continue

        errors.extend(validate_with_jsonschema(instance, SOURCE_MAP_SCHEMA, map_path.name))

        chunks = instance.get("chunks", [])
        if not chunks:
            errors.append("  [invariant] zero chunks; never a vacuous pass")

        # Chunk ids must be unique within this file.
        chunk_ids = [c.get("id") for c in chunks]
        seen_ids = set()
        duplicate_ids = set()
        for cid in chunk_ids:
            if cid in seen_ids:
                duplicate_ids.add(cid)
            seen_ids.add(cid)
        if duplicate_ids:
            errors.append(f"  [invariant] duplicate chunk ids: {sorted(duplicate_ids)}")

        # Resolve the source's full text once per file, for verbatim
        # heading checks below. Gates read maps, never PDFs (BM-1) — this
        # resolution never reads a PDF; it only follows textPointer.file or
        # the source-kb entry's locator.repoPath, both of which are
        # markdown/text working copies by convention.
        #
        # Book-kind only (BM-1 AMENDMENT, Prompt 148; reference removed,
        # RJ-0073, adp-0217): a benchmark-kind map has no resolved
        # source_text and gets no text-based cross-check of any kind here.
        is_benchmark = instance.get("kind") == "benchmark"
        source_text = None
        if not is_benchmark:
            text_pointer = instance.get("textPointer")
            if text_pointer and text_pointer.get("file"):
                text_path = REPO_ROOT / text_pointer["file"]
                if text_path.exists():
                    source_text = text_path.read_text(encoding="utf-8")
                else:
                    errors.append(f"  [invariant] textPointer.file does not exist: {text_pointer['file']}")
            else:
                source_id = instance.get("sourceId")
                entry = source_kb_by_id.get(source_id)
                if entry is None:
                    errors.append(f"  [invariant] sourceId '{source_id}' not found in source-kb.json")
                else:
                    repo_path = entry.get("locator", {}).get("repoPath")
                    if not repo_path:
                        errors.append(f"  [invariant] source-kb entry '{source_id}' has no locator.repoPath and the map carries no textPointer")
                    else:
                        full_path = REPO_ROOT / repo_path
                        if full_path.exists():
                            source_text = full_path.read_text(encoding="utf-8")
                        else:
                            errors.append(f"  [invariant] source-kb entry '{source_id}' locator.repoPath does not exist: {repo_path}")

        for chunk in chunks:
            cid = chunk.get("id", "(no id)")
            heading = chunk.get("heading")

            for shape in chunk.get("shapes", []) or []:
                shape_id = shape.get("shapeId")
                if shape_id and shape_ids and shape_id not in shape_ids:
                    errors.append(f"  [invariant] chunk '{cid}': shapeId '{shape_id}' not found in content-shapes store")

            for tag in chunk.get("pathwayTags", []) or []:
                evidence = tag.get("evidence")
                if not evidence or not evidence.strip():
                    errors.append(f"  [invariant] chunk '{cid}': pathwayTag '{tag.get('pathway')}' has empty evidence")
                pathway_id = tag.get("pathway")
                if pathway_id and pathway_id not in catalogue_pathway_ids:
                    errors.append(f"  [invariant] chunk '{cid}': pathwayTag '{pathway_id}' is not a catalogue pathway id (SMAP-1 AMENDMENT)")

            if not is_benchmark and source_text is not None and heading and heading not in source_text:
                errors.append(f"  [invariant] chunk '{cid}': heading '{heading}' not found verbatim in resolved source text")

        results.append((map_path.name, errors, is_benchmark))

    return results


def validate_catalogue(catalogue_path: Path) -> list:
    """
    Validate catalogue.json, catalogue/pathways.json, and every
    catalogue/pathways/<pathway>.json file (CAT-1, CAT-1 AMENDMENT,
    Prompt 140 Unit 2).

    Checks per file: schema validity against catalogue.schema.json,
    catalogue.pathways.schema.json, or catalogue.pathway.schema.json as
    appropriate.

    Structural invariants (schema alone cannot express these):
      - every pathway file named in catalogue/pathways.json's pathways[].file
        exists on disk;
      - every pathway has exactly one file (no two pathway entries point at
        the same file);
      - no course slug is claimed by two tiers, across every pathway file
        combined.

    Zero pathways listed in catalogue/pathways.json is a FAIL, never a
    vacuous pass (mirrors the same rule already enforced for content-shapes,
    activity-patterns, and source-maps above).

    Returns a list of (name, errors) tuples: one for catalogue.json, one for
    catalogue/pathways.json, one per pathway file found, plus a final
    "(cross-file invariants)" entry for checks that span multiple files.
    """
    results = []

    root_instance, root_error = load_store(catalogue_path)
    if root_error:
        return [(str(catalogue_path), [root_error])]

    root_name = str(catalogue_path.relative_to(REPO_ROOT)) if catalogue_path.is_absolute() else str(catalogue_path)
    root_errors = validate_with_jsonschema(root_instance, CATALOGUE_SCHEMA, "catalogue")
    results.append((root_name, root_errors))

    pathways_collection = next(
        (c for c in root_instance.get("collections", []) if c.get("id") == "pathways"),
        None,
    )
    if pathways_collection is None:
        results.append(("(cross-file invariants)", ["FAIL - no 'pathways' collection listed in catalogue.json"]))
        return results

    pathways_file_rel = pathways_collection.get("file")
    pathways_path = (REPO_ROOT / pathways_file_rel) if pathways_file_rel else None

    if not pathways_path or not pathways_path.exists():
        results.append((pathways_file_rel or "(pathways file)", [f"FAIL - pathways file does not exist: {pathways_file_rel}"]))
        return results

    pathways_instance, pathways_error = load_store(pathways_path)
    if pathways_error:
        results.append((pathways_file_rel, [pathways_error]))
        return results

    pathways_errors = validate_with_jsonschema(pathways_instance, CATALOGUE_PATHWAYS_SCHEMA, "catalogue.pathways")
    pathway_entries = pathways_instance.get("pathways", [])

    if not pathway_entries:
        pathways_errors.append("FAIL - zero pathways listed; never a vacuous pass")

    results.append((pathways_file_rel, pathways_errors))

    # Cross-file invariants, accumulated while walking every pathway file.
    cross_errors = []

    file_counts = {}
    for entry in pathway_entries:
        f = entry.get("file")
        file_counts[f] = file_counts.get(f, 0) + 1
    for f, count in file_counts.items():
        if count > 1:
            cross_errors.append(f"FAIL - file '{f}' claimed by {count} pathway entries; each pathway must have exactly one file")

    slug_owners = {}  # courseSlug -> list of "pathwayId/tierId"

    for entry in pathway_entries:
        pathway_id = entry.get("id")
        file_rel = entry.get("file")
        file_path = (REPO_ROOT / file_rel) if file_rel else None

        if not file_path or not file_path.exists():
            results.append((file_rel or f"(pathway {pathway_id})", [f"FAIL - pathway file does not exist: {file_rel}"]))
            continue

        pw_instance, pw_error = load_store(file_path)
        if pw_error:
            results.append((file_rel, [pw_error]))
            continue

        pw_errors = validate_with_jsonschema(pw_instance, CATALOGUE_PATHWAY_SCHEMA, file_rel)

        for tier in pw_instance.get("tiers", []):
            slug = tier.get("courseSlug")
            if slug:
                slug_owners.setdefault(slug, []).append(f"{pathway_id}/{tier.get('tierId')}")

        results.append((file_rel, pw_errors))

    for slug, owners in slug_owners.items():
        if len(owners) > 1:
            cross_errors.append(f"FAIL - course slug '{slug}' claimed by {len(owners)} tiers: {owners}")

    results.append(("(cross-file invariants)", cross_errors))

    return results


def run_test_fixtures() -> bool:
    """
    Run validation against test fixtures.
    Returns True if all tests pass (negatives reject for the right reason,
    positives accept).
    """
    print("=" * 60)
    print("NEGATIVE TEST SUITE")
    print("=" * 60)

    all_passed = True

    # Define expected fixture outcomes with required error substrings
    # Each negative fixture MUST reject AND contain its expected error
    negative_fixtures = [
        ("N1-closed-no-provenance.json", "course-design",
         "Closed record without provenance (basis not inferred)",
         "'provenance' is a required property"),
        ("N2-invalid-gate-state.json", "course-design",
         "Invalid gateState enum value",
         "'active' is not one of"),
        ("N3-additional-property.json", "course-design",
         "Stray property where additionalProperties: false",
         "'extraField' was unexpected"),
        ("N4-invalid-sweep-verdict.json", "course-design",
         "Invalid sweepEvents verdict value",
         "'reject' is not one of"),
        ("N5-nonexistent-depends-on.json", "gates",
         "dependsOn edge pointing at nonexistent gate",
         "does not exist"),
        ("N6-ctx-with-depends-on.json", "gates",
         "crs-01_course-facets (was gates/CTX) with dependsOn array",
         "must have NO dependsOn edges"),
        ("N7-malformed-grounding-gap.json", "course-design",
         "groundingGaps with invalid store enum (design-kb)",
         "'design-kb' is not one of"),
        ("N8-institutional-missing-institution.json", "institutional-kb",
         "institutional-kb entry missing required institution field",
         "'institution' is a required property"),
        ("N9-source-kb-invalid-authority-level.json", "source-kb",
         "source-kb entry with cross-store authorityLevel 'module'",
         "'module' is not one of"),
        ("N10-issuer-version-no-retrieved.json", "source-kb",
         "entry with issuerVersion but no retrieved",
         "'retrieved' is a dependency of 'issuerVersion'"),
        ("N11-missing-basis.json", "source-kb",
         "entry missing required basis field",
         "'basis' is a required property"),
        ("N12-module-authority-no-scope-module.json", "institutional-kb",
         "institutional-kb entry authorityLevel=module without scope.module",
         "'module' is a required property"),
        ("N13-disputed-corrected-no-provenance.json", "course-design",
         "provenanceDisputed WITH correctedValue still requires provenance",
         "'provenance' is a required property"),
        ("N14-gi2-provenance-mismatch.json", "course-design",
         "human-confirmed on an advisory-hardness gate (GI-2's own A7 incident, reproduced)",
         "never opened for confirmation"),
    ]

    positive_fixtures = [
        ("P1-inferred-no-provenance.json", "course-design",
         "Inferred reconstruction without provenance (A3 relaxation)"),
        ("P2-grounding-gaps.json", "course-design",
         "Valid groundingGaps array (A5 amendment)"),
        ("P3-source-kb-minimal.json", "source-kb",
         "Minimal valid source-kb instance"),
        ("P4-institutional-kb-minimal.json", "institutional-kb",
         "Minimal valid institutional-kb instance"),
        ("P5-disputed-no-corrected-no-provenance.json", "course-design",
         "provenanceDisputed without correctedValue waives provenance requirement"),
    ]

    for fixture_name, fixture_type, description, expected_error in negative_fixtures:
        fixture_path = TEST_FIXTURES_DIR / fixture_name
        if not fixture_path.exists():
            print(f"\n[SKIP] {fixture_name}: file not found")
            continue

        print(f"\n{fixture_name}: {description}")
        instance = load_json(fixture_path)

        if fixture_type == "course-design":
            errors = validate_course_design(instance, fixture_path)
        elif fixture_type == "gates":
            errors = validate_gates_file(instance, fixture_path)
        elif fixture_type == "source-kb":
            errors = validate_source_kb(instance, fixture_path)
        elif fixture_type == "institutional-kb":
            errors = validate_institutional_kb(instance, fixture_path)
        else:
            errors = [f"Unknown fixture type: {fixture_type}"]

        if not errors:
            print("  FAIL: ACCEPTED (should have rejected)")
            all_passed = False
            continue

        # Check that the expected error is present
        errors_joined = "\n".join(errors)
        if expected_error in errors_joined:
            print(f"  REJECTED — {len(errors)} error(s)")
            for err in errors:
                print(f"   {err}")
            print(f"  EXPECTED ERROR MATCHED: \"{expected_error}\"")
        else:
            print(f"  FAIL: REJECTED FOR WRONG REASON")
            print(f"  Expected error containing: \"{expected_error}\"")
            print(f"  Actual errors:")
            for err in errors:
                print(f"   {err}")
            all_passed = False

    print("\n" + "=" * 60)
    print("POSITIVE TEST SUITE")
    print("=" * 60)

    for fixture_name, fixture_type, description in positive_fixtures:
        fixture_path = TEST_FIXTURES_DIR / fixture_name
        if not fixture_path.exists():
            print(f"\n[SKIP] {fixture_name}: file not found")
            continue

        print(f"\n{fixture_name}: {description}")
        instance = load_json(fixture_path)

        if fixture_type == "course-design":
            errors = validate_course_design(instance, fixture_path)
        elif fixture_type == "gates":
            errors = validate_gates_file(instance, fixture_path)
        elif fixture_type == "source-kb":
            errors = validate_source_kb(instance, fixture_path)
        elif fixture_type == "institutional-kb":
            errors = validate_institutional_kb(instance, fixture_path)
        else:
            errors = [f"Unknown fixture type: {fixture_type}"]

        if errors:
            print(f"  FAIL: REJECTED (should have accepted)")
            for err in errors:
                print(f"   {err}")
            all_passed = False
        else:
            print("  ACCEPTED")

    return all_passed


def main():
    parser = argparse.ArgumentParser(
        description="Validate course-design manifests and design-kb.gates.json"
    )
    parser.add_argument(
        "--course-design",
        type=Path,
        help="Path to course-design instance to validate"
    )
    parser.add_argument(
        "--gates",
        type=Path,
        help="Path to design-kb.gates.json to validate"
    )
    parser.add_argument(
        "--course-design-gates",
        type=Path,
        help=(
            "Path to the gate store used to RESOLVE a --course-design's gate "
            "ids and shapes (defaults to the repo gates store). Distinct from "
            "--gates, which validates the gates FILE itself. A caller that "
            "built a course-design against a non-default store (e.g. "
            "phase-confirm.js's read-back, a test fixture store) passes it "
            "here so resolution uses the same store the records were written "
            "against, not the repo default."
        )
    )
    parser.add_argument(
        "--source-kb",
        type=Path,
        help="Path to source-kb instance to validate"
    )
    parser.add_argument(
        "--institutional-kb",
        type=Path,
        help="Path to institutional-kb instance to validate"
    )
    parser.add_argument(
        "--vocab-kb",
        type=Path,
        help="Path to vocab-kb instance to validate"
    )
    parser.add_argument(
        "--hecos-kb",
        type=Path,
        help="Path to hecos-kb instance to validate (checked against vocab-kb/cah.json's cah3 codes)"
    )
    parser.add_argument(
        "--skeletons",
        type=Path,
        help="Path to design-kb.skeletons.json to validate"
    )
    parser.add_argument(
        "--palette",
        type=Path,
        help="Path to design-kb.palette.json to validate"
    )
    parser.add_argument(
        "--tier-bands",
        type=Path,
        help="Path to design-kb.tier-bands.json to validate"
    )
    parser.add_argument(
        "--activity-patterns",
        type=Path,
        help="Path to design-kb.activity-patterns.json to validate"
    )
    parser.add_argument(
        "--content-shapes",
        type=Path,
        help="Path to design-kb.content-shapes.json to validate"
    )
    parser.add_argument(
        "--pathways",
        type=Path,
        help="Path to design-kb.pathways.json (consolidated Layer-1 grounding) to validate"
    )
    parser.add_argument(
        "--source-maps",
        action="store_true",
        help="Validate every file under source-kb/source-maps/ against schemas/source-map.schema.json plus structural invariants (SMAP-1, BM-1)"
    )
    parser.add_argument(
        "--catalogue",
        action="store_true",
        help="Validate catalogue.json, catalogue/pathways.json, and every catalogue/pathways/<pathway>.json against their schemas plus structural invariants (CAT-1, CAT-1 AMENDMENT)"
    )
    parser.add_argument(
        "--test-fixtures",
        action="store_true",
        help="Run validation against test fixtures (negative and positive)"
    )
    parser.add_argument(
        "--all-defaults",
        action="store_true",
        help="Validate every design-kb store, vocab-kb, hecos-kb, source-kb, source-kb/source-maps/, and catalogue.json at their fixed repo paths (PR-S-35: course-design has no fixed default and is excluded)"
    )

    args = parser.parse_args()

    if not HAS_JSONSCHEMA:
        print("ERROR: jsonschema library not available")
        print("This validator requires: pip install jsonschema")
        sys.exit(1)

    exit_code = 0

    if args.test_fixtures:
        if not run_test_fixtures():
            exit_code = 1
        print()

    # Validate course-design
    # PR-S-35: no --all-defaults fallback here. See the comment above
    # DEFAULT_GATES for why course-design has no fixed default path.
    course_design_path = args.course_design

    if course_design_path:
        print("=" * 60)
        print(f"COURSE-DESIGN: {course_design_path.name}")
        print("=" * 60)
        instance, load_error = load_store(course_design_path)
        if load_error:
            print(load_error)
            exit_code = 1
        else:
            errors = validate_course_design(
                instance,
                course_design_path,
                gates_path=args.course_design_gates or DEFAULT_GATES,
            )
            if errors:
                print(f"FAIL - {len(errors)} error(s):")
                for err in errors:
                    print(err)
                exit_code = 1
            else:
                print("PASS")
        print()

    # Validate gates file
    gates_path = args.gates
    if args.all_defaults and not gates_path:
        gates_path = DEFAULT_GATES

    if gates_path:
        print("=" * 60)
        print(f"GATES FILE: {gates_path.name}")
        print("=" * 60)
        instance, load_error = load_store(gates_path)
        if load_error:
            print(load_error)
            exit_code = 1
        else:
            errors = validate_gates_file(instance, gates_path)
            if errors:
                print(f"FAIL - {len(errors)} error(s):")
                for err in errors:
                    print(err)
                exit_code = 1
            else:
                print("PASS")
        print()

    # Validate source-kb
    source_kb_path = args.source_kb
    if args.all_defaults and not source_kb_path:
        source_kb_path = DEFAULT_SOURCE_KB

    if source_kb_path:
        print("=" * 60)
        print(f"SOURCE-KB: {source_kb_path.name}")
        print("=" * 60)
        instance, load_error = load_store(source_kb_path)
        if load_error:
            print(load_error)
            exit_code = 1
        else:
            errors = validate_source_kb(instance, source_kb_path)
            if errors:
                print(f"FAIL - {len(errors)} error(s):")
                for err in errors:
                    print(err)
                exit_code = 1
            else:
                print("PASS")
        print()

    # Validate institutional-kb
    if args.institutional_kb:
        print("=" * 60)
        print(f"INSTITUTIONAL-KB: {args.institutional_kb.name}")
        print("=" * 60)
        instance, load_error = load_store(args.institutional_kb)
        if load_error:
            print(load_error)
            exit_code = 1
        else:
            errors = validate_institutional_kb(instance, args.institutional_kb)
            if errors:
                print(f"FAIL - {len(errors)} error(s):")
                for err in errors:
                    print(err)
                exit_code = 1
            else:
                print("PASS")
        print()

    # Validate vocab-kb
    vocab_kb_path = args.vocab_kb
    if args.all_defaults and not vocab_kb_path:
        vocab_kb_path = DEFAULT_VOCAB_KB

    if vocab_kb_path:
        print("=" * 60)
        print(f"VOCAB-KB: {vocab_kb_path.name}")
        print("=" * 60)
        # Prompt 68: missing, unreadable, or invalid-JSON store
        # must FAIL, not crash uncaught and not pass. Prompt 69 generalised
        # this into load_store() so every mode fails the same way, not
        # just this one.
        instance, load_error = load_store(vocab_kb_path)
        if load_error:
            print(load_error)
            exit_code = 1
        else:
            errors = validate_vocab_kb(instance, vocab_kb_path)
            if errors:
                print(f"FAIL - {len(errors)} error(s):")
                for err in errors:
                    print(err)
                exit_code = 1
            else:
                print("PASS")
        print()

    # Validate hecos-kb
    hecos_kb_path = args.hecos_kb
    if args.all_defaults and not hecos_kb_path:
        hecos_kb_path = DEFAULT_HECOS_KB

    if hecos_kb_path:
        print("=" * 60)
        print(f"HECOS-KB: {hecos_kb_path.name}")
        print("=" * 60)
        instance, load_error = load_store(hecos_kb_path)
        if load_error:
            print(load_error)
            exit_code = 1
        else:
            errors = validate_hecos_kb(instance, hecos_kb_path)
            if errors:
                print(f"FAIL - {len(errors)} error(s):")
                for err in errors:
                    print(err)
                exit_code = 1
            else:
                print("PASS")
        print()

    # Validate skeletons
    skeletons_path = args.skeletons
    if args.all_defaults and not skeletons_path:
        skeletons_path = DEFAULT_SKELETONS

    if skeletons_path:
        print("=" * 60)
        print(f"SKELETONS: {skeletons_path.name}")
        print("=" * 60)
        instance, load_error = load_store(skeletons_path)
        if load_error:
            print(load_error)
            exit_code = 1
        else:
            errors = validate_skeletons(instance, skeletons_path)
            if errors:
                print(f"FAIL - {len(errors)} error(s):")
                for err in errors:
                    print(err)
                exit_code = 1
            else:
                print("PASS")
        print()

    # Validate palette
    palette_path = args.palette
    if args.all_defaults and not palette_path:
        palette_path = DEFAULT_PALETTE

    if palette_path:
        print("=" * 60)
        print(f"PALETTE: {palette_path.name}")
        print("=" * 60)
        instance, load_error = load_store(palette_path)
        if load_error:
            print(load_error)
            exit_code = 1
        else:
            errors = validate_palette(instance, palette_path)
            if errors:
                print(f"FAIL - {len(errors)} error(s):")
                for err in errors:
                    print(err)
                exit_code = 1
            else:
                print("PASS")
        print()

    # Validate tier-bands
    tier_bands_path = args.tier_bands
    if args.all_defaults and not tier_bands_path:
        tier_bands_path = DEFAULT_TIER_BANDS

    if tier_bands_path:
        print("=" * 60)
        print(f"TIER-BANDS: {tier_bands_path.name}")
        print("=" * 60)
        instance, load_error = load_store(tier_bands_path)
        if load_error:
            print(load_error)
            exit_code = 1
        else:
            errors = validate_tier_bands(instance, tier_bands_path)
            if errors:
                print(f"FAIL - {len(errors)} error(s):")
                for err in errors:
                    print(err)
                exit_code = 1
            else:
                print("PASS")
        print()

    # Validate activity-patterns
    activity_patterns_path = args.activity_patterns
    if args.all_defaults and not activity_patterns_path:
        activity_patterns_path = DEFAULT_ACTIVITY_PATTERNS

    if activity_patterns_path:
        print("=" * 60)
        print(f"ACTIVITY-PATTERNS: {activity_patterns_path.name}")
        print("=" * 60)
        instance, load_error = load_store(activity_patterns_path)
        if load_error:
            print(load_error)
            exit_code = 1
        else:
            errors = validate_activity_patterns(instance, activity_patterns_path)
            if errors:
                print(f"FAIL - {len(errors)} error(s):")
                for err in errors:
                    print(err)
                exit_code = 1
            else:
                print("PASS")
        print()

    # Validate content-shapes
    content_shapes_path = args.content_shapes
    if args.all_defaults and not content_shapes_path:
        content_shapes_path = DEFAULT_CONTENT_SHAPES

    if content_shapes_path:
        print("=" * 60)
        print(f"CONTENT-SHAPES: {content_shapes_path.name}")
        print("=" * 60)
        instance, load_error = load_store(content_shapes_path)
        if load_error:
            print(load_error)
            exit_code = 1
        else:
            errors = validate_content_shapes(instance, content_shapes_path)
            if errors:
                print(f"FAIL - {len(errors)} error(s):")
                for err in errors:
                    print(err)
                exit_code = 1
            else:
                print("PASS")
        print()

    pathways_path = args.pathways
    if args.all_defaults and not pathways_path:
        pathways_path = DEFAULT_PATHWAYS

    if pathways_path:
        print("=" * 60)
        print(f"PATHWAYS: {pathways_path.name}")
        print("=" * 60)
        instance, load_error = load_store(pathways_path)
        if load_error:
            print(load_error)
            exit_code = 1
        else:
            errors = validate_pathways(instance, pathways_path)
            if errors:
                print(f"FAIL - {len(errors)} error(s):")
                for err in errors:
                    print(err)
                exit_code = 1
            else:
                print("PASS")
        print()

    # Validate source-maps (SMAP-1, BM-1). A directory scan, not a
    # single-instance path, so this runs whenever --source-maps is given,
    # or under --all-defaults (mirroring every other fixed-repo-path store
    # above; the fixed path here is a directory, source-kb/source-maps/).
    run_source_maps = args.source_maps or args.all_defaults

    if run_source_maps:
        print("=" * 60)
        print(f"SOURCE MAPS: {DEFAULT_SOURCE_MAPS_DIR.relative_to(REPO_ROOT)}")
        print("=" * 60)
        results = validate_source_maps(DEFAULT_SOURCE_MAPS_DIR)
        for file_name, errors, is_benchmark in results:
            if errors:
                print(f"{file_name}: FAIL - {len(errors)} error(s):")
                for err in errors:
                    print(err)
                exit_code = 1
            elif is_benchmark:
                # RJ-0087 (adp-0219, prm N-0111 (2); standing discipline: a
                # check that reaches no subjects has not passed): adp-0218's
                # line above still said PASS on a benchmark-kind map with no
                # cross-check of any kind. D-0070 (a) rules that the
                # source-map check never says PASS when no cross-check ran;
                # UNCHECKED replaces it here. Exit codes are unchanged.
                print(f"{file_name}: UNCHECKED (benchmark-kind: no quote cross-check ran)")
            else:
                print(f"{file_name}: PASS")
        print()

    # Validate catalogue (CAT-1, CAT-1 AMENDMENT, Prompt 140 Unit 2). A
    # multi-file walk (root + pathways index + one file per pathway), not a
    # single-instance path, so this runs whenever --catalogue is given, or
    # under --all-defaults (catalogue.json is a fixed repo-top-level path
    # like gates/skeletons/palette above).
    run_catalogue = args.catalogue or args.all_defaults

    if run_catalogue:
        print("=" * 60)
        print(f"CATALOGUE: {DEFAULT_CATALOGUE.relative_to(REPO_ROOT)}")
        print("=" * 60)
        results = validate_catalogue(DEFAULT_CATALOGUE)
        for file_name, errors in results:
            if errors:
                print(f"{file_name}: FAIL - {len(errors)} error(s):")
                for err in errors:
                    print(err)
                exit_code = 1
            else:
                print(f"{file_name}: PASS")
        print()

    # If no specific action, show help
    if not any([args.course_design, args.gates, args.source_kb, args.institutional_kb,
                args.vocab_kb, args.hecos_kb, args.skeletons, args.palette, args.tier_bands,
                args.activity_patterns, args.content_shapes, args.pathways, args.source_maps,
                args.catalogue, args.test_fixtures, args.all_defaults]):
        parser.print_help()
        print("\nExamples:")
        print("  python3 tools/validate-design-schemas.py --all-defaults")
        print("  python3 tools/validate-design-schemas.py --test-fixtures --all-defaults")
        print("  python3 tools/validate-design-schemas.py --course-design schemas/course-design_academic-writing-introductory.json")
        print("  python3 tools/validate-design-schemas.py --source-kb path/to/source-kb.json")
        print("  python3 tools/validate-design-schemas.py --vocab-kb tools/subject/core/vocab/cah.json")
        print("  python3 tools/validate-design-schemas.py --hecos-kb tools/subject/core/vocab/hecos.json")

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
