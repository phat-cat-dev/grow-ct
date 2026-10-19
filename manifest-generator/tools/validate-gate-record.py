#!/usr/bin/env python3
"""
validate-gate-record.py — standalone shape validator for one draft gate record.

Validates a single record against the record subschema nested inside
schemas/course-design.schema.json (properties.gates.items.properties.records.items),
confirmed reachable standalone: it does not reference anything outside itself
except common.schema.json (citation, gateState, provenance), which
validate-design-schemas.py's own create_resolver() already resolves. No
manifest is read, nothing is written, nothing is left behind (PR-S-59
ruling 2).

This is a TOOL, not a documented scratch-copy method (PR-S-59 ruling 1): the
scratch-copy approach used once at A7 gives a PASS that silently stops
meaning anything the moment the draft is edited after copying, or spliced
into a stale copy. This tool takes the draft file itself, fresh, every run.

What a PASS means, and does not mean (PR-S-59 ruling 3): PASS means the
record is well-formed against the schema. It does NOT mean the record is
right. In particular, shape validation cannot tell a correct provenance
word from an incorrect one that happens to also be a valid enum member —
schema validation cannot see the gate's own defaultType/hardness to check
provenance against (PR-S-60). A PASS from this tool is silent on that
question; it is not evidence either way.

Fails on nothing (PR-S-59 ruling 4, the standing rule from PR-S-46/PR-S-47
applied here from the start): a missing file, an unreadable file, invalid
JSON, an empty object, or a non-object top level is a FAIL with its own
message, exit 1. Never a pass, never an uncaught traceback.

Usage:
    python3 tools/validate-gate-record.py <path-to-draft-record.json>

Landed: 18 Sep 2026, Prompt 77 (PR-S-59).
"""

import importlib.util
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCHEMAS_DIR = REPO_ROOT / "schemas"

# Reuse validate-design-schemas.py's load_json/create_resolver rather than
# duplicating the resolver-construction logic a second time (task 1.3: the
# same schema/resolver pairing is already correct there and proven against
# the full course-design manifest, including this exact record subschema,
# via --course-design). Loaded via importlib.util because the module's
# filename contains a hyphen and is not a valid `import` identifier.
_VDS_PATH = REPO_ROOT / "tools" / "validate-design-schemas.py"
_spec = importlib.util.spec_from_file_location("validate_design_schemas", _VDS_PATH)
vds = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(vds)

try:
    from jsonschema import Draft7Validator
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False


def load_record_schema() -> dict:
    """
    Extract the single-record subschema from course-design.schema.json:
    properties.gates.items.properties.records.items. Confirmed standalone-
    validatable (task 1.2/1.6): it carries its own type/required/properties/
    additionalProperties/allOf and no $ref outside common.schema.json, which
    vds.create_resolver() already resolves. No manifest wrapper needed.
    """
    schema = vds.load_json(vds.COURSE_DESIGN_SCHEMA)
    try:
        return schema["properties"]["gates"]["items"]["properties"]["records"]["items"]
    except KeyError as e:
        # Not expected to happen against the schema as it stands (task 1.2
        # confirmed the path); fail loudly rather than silently, if the
        # schema's shape ever moves.
        print(f"FAIL - could not locate the record subschema at properties.gates.items.properties.records.items: missing key {e}")
        sys.exit(1)


def load_record(path: Path):
    """
    Load a draft record for validation. Returns (record, None) on success,
    or (None, error_message) on any failure. Every failure condition is its
    own message; every one is a FAIL, never a pass, never an uncaught
    traceback (PR-S-59 ruling 4 / the standing PR-S-46/PR-S-47 rule).
    """
    if not path.exists():
        return None, f"FAIL - record file not found: {path}"
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as e:
        return None, f"FAIL - record file unreadable: {path} ({e})"
    try:
        record = json.loads(raw)
    except json.JSONDecodeError as e:
        return None, f"FAIL - record file is not valid JSON: {path} ({e})"
    if not isinstance(record, dict):
        return None, f"FAIL - record must be a JSON object, found {type(record).__name__}: {path}"
    if not record:
        return None, f"FAIL - record is empty: no fields to validate: {path}"
    return record, None


def main():
    if len(sys.argv) != 2:
        print("Usage: python3 tools/validate-gate-record.py <path-to-draft-record.json>")
        print("\nValidates one draft gate record, standalone, against the record")
        print("subschema in schemas/course-design.schema.json. Writes nothing.")
        sys.exit(1)

    if not HAS_JSONSCHEMA:
        print("FAIL - jsonschema library not available (pip install jsonschema)")
        sys.exit(1)

    record_path = Path(sys.argv[1])
    record, load_error = load_record(record_path)
    if load_error:
        print(load_error)
        sys.exit(1)

    record_schema = load_record_schema()
    resolver = vds.create_resolver()
    validator = Draft7Validator(record_schema, resolver=resolver)
    errors = sorted(validator.iter_errors(record), key=lambda e: str(e.path))

    if errors:
        print(f"FAIL - {len(errors)} error(s):")
        for error in errors:
            path = ".".join(str(p) for p in error.path) if error.path else "(root)"
            print(f"  [{path}] {error.message}")
        sys.exit(1)

    print("PASS - record is well-formed against the record subschema.")
    print("PASS means shape only. It does NOT mean the record is correct:")
    print("shape validation cannot check whether the provenance word is the")
    print("right one for this gate's defaultType/hardness (PR-S-60 — no")
    print("cross-field constraint exists in the schema for this). Do not")
    print("read this PASS as anything beyond 'well-formed'.")
    sys.exit(0)


if __name__ == "__main__":
    main()
