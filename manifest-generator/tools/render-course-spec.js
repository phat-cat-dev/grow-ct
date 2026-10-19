#!/usr/bin/env node
/**
 * render-course-spec.js
 *
 * RJ-0080 (adp-0223). Renders a course design record
 * (courses/<slug>/course-design_<slug>.json) into the course design
 * specification Markdown the golden spec names (adp-cds-pd-spec.md,
 * version 0.1.0-draft, 2 October 2026): "Generated, never written by
 * hand... the same render is the read-back at each phase confirm and
 * the specification at the end... where it and the record disagree,
 * the record wins (GDG-1)."
 *
 * This tool never writes a course-design record and never changes one
 * (spec section 6: "Never as a step that changes a record"). It only
 * reads the record and the gates store and produces Markdown text.
 *
 * Sections render from design-kb/design-kb.gates.json at render time
 * (spec section 3): every gate whose phase is ONB, CXS, CRS, LES or
 * WRA, in sequence order; a gate with repeatsPer:"lesson" (les-01)
 * renders once per lesson, in crs-04_lesson-map's own lesson order,
 * under a per-lesson gate id `<slug>-<bareKey>-les-01` (the per-lesson
 * id form settled 7 Oct 2026; see lessonBareKey below, a deliberate
 * small duplicate of phase-gate.js's own private helper of the same
 * name, which that file does not export). CXP (context packs, per
 * subject) is excluded by name, as old Phase D was
 * (gate-redesign-2026-10-06.md; six-phase migration, 8 Oct 2026).
 *
 * Rendering rules by decidedValueShape (spec section 4) are applied
 * generally (object of scalars -> two-column table; array of strings
 * -> bulleted list; array of objects -> table, id/key first; nested
 * {code,label} -> "label (code)"; enum -> value as written; boolean ->
 * yes/no; a string over 200 characters -> a paragraph below the
 * table; a field absent from the record -> shown absent), and this
 * general renderer is applied recursively to any property whose own
 * value is itself an object or an array of objects, so a shape with no
 * per-gate override below (including crs-06_outcomes-matrix, whose decidedValueShape
 * nests arrays of objects inside its own two top-level arrays, and
 * which the golden spec's own per-gate table does not name at all,
 * since OBK postdates that spec's own mirror point, commit 89ee9c4)
 * still renders, compositionally, rather than refusing. This is a
 * finding of this job, not a ruling: flagged in the RJ-0080 report
 * section for Abbott, in the same spirit as the spec's own section 8
 * open point 1 (B3/B5/B6/B7/W1's missing shapes).
 *
 * Two further findings of this job, also flagged rather than silently
 * decided:
 *   - The spec's rule 6 names an "`inferred` value" as a fifth Not
 *     Ready trigger, beside a failing validator, an open gate, an
 *     unconfirmed answer and a gate with no value shape (test 4 in
 *     section 7 names only the latter four, not inferred - the spec's
 *     own two lists already disagree on this one). schemas/
 *     common.schema.json's citation shape (a record's grounding[]
 *     entries) carries no field by which a value could be marked
 *     "inferred": its nearest cousin, the separate sourceBasis $def
 *     ("document-in-hand" / "unverified"), is not referenced from
 *     citation or from the records item shape anywhere in schemas/
 *     course-design.schema.json. Read in full this job; confirmed by
 *     printing both schemas directly. This tool therefore implements
 *     the four triggers test 4 names and does not implement an
 *     "inferred value" trigger, for want of a field to read it from -
 *     not a choice to omit it.
 *   - "An open gate" (rule 6) is implemented here as state "proposed"
 *     only. schemas/common.schema.json's gateState description names
 *     "proposed and undemoted-deferred" as the model's only phase-
 *     close blockers; "undemoted" is not a field on the records item
 *     shape in schemas/course-design.schema.json (checked directly),
 *     so a deferred record's blocking/non-blocking distinction is not
 *     implemented here either. Flagged, not decided.
 *
 * Usage:
 *   node tools/render-course-spec.js --course=<slug> [--store=<path>] [--out=<path>] [--skip-validator]
 *
 * --out, when given, writes there instead of the spec's own default
 * path (courses/<slug>/adp-course-design-specification_<slug>.md,
 * spec section 2) - used for a read-only render into scratch, which
 * never writes under the course's own folder at all.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const gateOrder = require('./gate-order.js');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_FIELDS_PATH = path.join(__dirname, 'render-course-spec-fields.json');
const RENDERER_NAME = 'render-course-spec.js';
const RENDERER_VERSION = '0.1.0';
// The course-design spec renders the course-level phases. CXP (context
// packs, per subject, standalone) is excluded, as old Phase D was
// (gate-redesign-2026-10-06.md; six-phase migration, 8 Oct 2026).
const RENDERED_PHASES = ['ONB', 'CXS', 'CRS', 'LES', 'WRA'];

// Spec section 4, verbatim word-mapping: "Provenance renders in the
// template's words from ADAPT's enum."
const PROVENANCE_WORDS = {
  'human-specified': 'stated',
  'human-confirmed': 'confirmed',
  'human-amended': 'amended',
  'ai-default-stood': 'default stood',
  'ai-proposal-stood': 'proposal stood',
  'advisory-stated': 'advisory stated',
  'fixed-default': 'fixed default',
  'deferred': 'deferred'
};

// phase-confirm.js's own two-branch provenance model: these three
// provenances are exactly the ones that "stood on silence" and so
// carry confirmedAt when the record is complete (spec rule 4: "every
// answer that stood on silence and has no confirmedAt is marked").
const STOOD_PROVENANCES = new Set(['ai-default-stood', 'ai-proposal-stood', 'advisory-stated']);

// Per-gate override table (spec section 4). Keyed by the full STORE
// gate id. The six-phase migration (8 Oct 2026) re-keyed these off the
// retired old suffixes (CTX/A2/CO/A3/...) onto the new gate ids, keeping
// a bespoke renderer only where it reads better than the generic
// shape-driven renderer: crs-02 (scope), crs-03 (course outcomes) and
// crs-04 (lesson map). The old CTX/A5/A6/A7/B1/B4/S1 overrides are
// dropped: those gates were retired or merged, and their new homes
// (crs-02/03/04, les-01, wra-03/04, cxs-*) render through the generic
// renderer below.
const OVERRIDE_GATES = new Set(['crs-02_thematic-scope', 'crs-03_course-outcomes', 'crs-04_lesson-map']);

/** phase-gate.js's own private helper, duplicated here (not exported
 * by that file) rather than re-derived differently: a per-lesson
 * gate's bare key strips a leading "<course>-" from lesson.key if
 * present, exactly as manifest-completeness.js and phase-gate.js do. */
function lessonBareKey(lesson, course) {
  const key = lesson && lesson.key;
  if (typeof key !== 'string' || key.length === 0) return null;
  return key.startsWith(`${course}-`) ? key.slice(course.length + 1) : key;
}

function loadFieldLists(fieldsPath) {
  const resolved = fieldsPath ? path.resolve(fieldsPath) : DEFAULT_FIELDS_PATH;
  if (!fs.existsSync(resolved)) {
    throw new Error(`render-course-spec: no field-list file at ${resolved}`);
  }
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

/**
 * Walks decidedValue along a dotted field path, where any segment
 * ending "[]" iterates that array. Returns { present, reason }.
 * present is false when the gate has no record at all, no
 * decidedValue, or the path does not resolve on every branch it
 * reaches (an empty array is treated as present: there is nothing in
 * it to be missing from).
 */
function fieldStatus(courseDesign, gateId, fieldPath) {
  const entry = (courseDesign.gates || []).find(g => g.gateId === gateId);
  if (!entry || entry.records.length === 0) {
    return { present: false, reason: `${gateId} is absent from this course design` };
  }
  const record = entry.records[entry.records.length - 1];
  if (fieldPath === '(existence, closed)') {
    if (record.state !== 'closed') {
      return { present: false, reason: `${gateId}'s latest record is "${record.state}", not closed` };
    }
    return { present: true };
  }
  if (record.decidedValue === undefined || record.decidedValue === null) {
    return { present: false, reason: `${gateId}'s latest record carries no decidedValue` };
  }
  // Every field-list entry writes its path starting "decidedValue.",
  // matching the record's own shape (RJ-0080's render-course-spec-
  // fields.json, read in full this job). cursors already starts at
  // record.decidedValue, so that leading segment is stripped here
  // rather than walked a second time.
  const relativePath = fieldPath.startsWith('decidedValue.') ? fieldPath.slice('decidedValue.'.length) : fieldPath;
  const parts = relativePath.split('.');
  let cursors = [record.decidedValue];
  for (const part of parts) {
    const isArray = part.endsWith('[]');
    const key = isArray ? part.slice(0, -2) : part;
    const next = [];
    for (const cur of cursors) {
      if (cur === undefined || cur === null || typeof cur !== 'object') continue;
      const val = cur[key];
      if (val === undefined) continue;
      if (isArray) {
        if (!Array.isArray(val)) continue;
        for (const item of val) next.push(item);
      } else {
        next.push(val);
      }
    }
    if (next.length === 0 && !(isArray && cursors.some(c => c && Array.isArray(c[key]) && c[key].length === 0))) {
      return { present: false, reason: `"${fieldPath}" not found on ${gateId} (missing at "${part}")` };
    }
    cursors = next;
  }
  return { present: true };
}

/** Renders section 5 ("what production may rely on") from the field
 * lists and this course design. Returns { markdown, missing }. */
function renderSection5(courseDesign, fieldLists) {
  const lines = ['## What production may rely on', ''];
  const missing = [];
  for (const stepKey of Object.keys(fieldLists).filter(k => !k.startsWith('_'))) {
    const step = fieldLists[stepKey];
    lines.push(`### ${step.command} (\`${step.tool}\`)`, '');
    lines.push('| Gate | Field | Status | Provenance |', '|---|---|---|---|');
    for (const f of step.fields) {
      const status = fieldStatus(courseDesign, f.gate, f.field);
      const entry = (courseDesign.gates || []).find(g => g.gateId === f.gate);
      const record = entry && entry.records.length > 0 ? entry.records[entry.records.length - 1] : null;
      const provenanceCell = record && record.provenance ? provenanceWord(record.provenance) : '(none)';
      const statusCell = status.present ? 'present' : '**MISSING**';
      lines.push(`| ${f.gate} | \`${f.field}\` | ${statusCell} | ${provenanceCell} |`);
      if (!status.present) {
        missing.push({ step: stepKey, gate: f.gate, field: f.field, reason: status.reason });
      }
    }
    lines.push('');
  }
  return { markdown: lines.join('\n'), missing };
}

function provenanceWord(p) {
  if (!(p in PROVENANCE_WORDS)) {
    throw new Error(`render-course-spec: provenance "${p}" is not one of the eight words this tool knows`);
  }
  return PROVENANCE_WORDS[p];
}

function isLongString(v) {
  return typeof v === 'string' && v.length > 200;
}

function isCodeLabelObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v)
    && typeof v.code === 'string' && typeof v.label === 'string'
    && Object.keys(v).length === 2;
}

/** General rules (spec section 4), applied to one property's shape
 * and value. Returns { inline, block, longParas } where inline is a
 * single-cell string (used in object-of-scalars tables and
 * array-of-objects table cells), block is a standalone sub-rendering
 * (bulleted list / nested table) when the value does not fit one
 * cell, and longParas names long strings to render as paragraphs
 * below the table rather than inline. Exactly one of inline/block is
 * set. Recurses for nested object/array-of-object values, which is
 * what lets a shape with no per-gate override (including crs-06_outcomes-matrix)
 * still render. */
function renderFieldValue(fieldName, value) {
  if (value === undefined) return { inline: '*(absent)*' };
  if (typeof value === 'boolean') return { inline: value ? 'yes' : 'no' };
  if (isCodeLabelObject(value)) return { inline: `${value.label} (${value.code})` };
  if (Array.isArray(value)) {
    if (value.length === 0) return { inline: '*(none)*' };
    if (value.every(v => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) {
      return { block: value.map(v => `- ${v}`).join('\n') };
    }
    // array of objects: a table, id/key first column.
    const allKeys = [];
    for (const item of value) {
      if (item && typeof item === 'object') {
        for (const k of Object.keys(item)) if (!allKeys.includes(k)) allKeys.push(k);
      }
    }
    const idKey = allKeys.includes('id') ? 'id' : (allKeys.includes('key') ? 'key' : null);
    const cols = idKey ? [idKey, ...allKeys.filter(k => k !== idKey)] : allKeys;
    const longParas = [];
    const rows = value.map((item, idx) => {
      return cols.map(c => {
        const cellRender = renderFieldValue(`${fieldName}[${idx}].${c}`, item[c]);
        if (cellRender.inline !== undefined) {
          if (isLongString(item[c])) {
            longParas.push({ heading: `${fieldName}[${idx}].${c}`, text: item[c] });
            return '*(below)*';
          }
          return cellRender.inline;
        }
        longParas.push({ heading: `${fieldName}[${idx}].${c}`, text: cellRender.block });
        return '*(below)*';
      });
    });
    const header = `| ${cols.join(' | ')} |`;
    const sep = `|${cols.map(() => '---').join('|')}|`;
    const body = rows.map(r => `| ${r.join(' | ')} |`).join('\n');
    return { block: [header, sep, body].join('\n'), longParas };
  }
  if (value && typeof value === 'object') {
    // object of scalars (general rule) with recursion for any nested
    // object/array property this general rule does not otherwise
    // cover - the compositional fallback that renders crs-06_outcomes-matrix.
    const keys = Object.keys(value);
    const longParas = [];
    const rows = keys.map(k => {
      const v = value[k];
      if (isLongString(v)) {
        longParas.push({ heading: k, text: v });
        return `| ${k} | *(below)* |`;
      }
      const r = renderFieldValue(k, v);
      if (r.inline !== undefined) return `| ${k} | ${r.inline} |`;
      longParas.push({ heading: k, text: r.block });
      if (r.longParas) longParas.push(...r.longParas);
      return `| ${k} | *(below)* |`;
    });
    return { block: ['| field | value |', '|---|---|', ...rows].join('\n'), longParas };
  }
  if (isLongString(value)) return { longOnly: true, text: value };
  return { inline: String(value) };
}

function renderLongParas(longParas) {
  if (!longParas || longParas.length === 0) return '';
  return longParas.map(p => `\n**${p.heading}**\n\n${p.text}\n`).join('\n');
}

/** Per-gate override renderers (spec section 4's per-gate table),
 * keyed by the full store gate id (e.g. "crs-03_course-outcomes"). Each
 * takes the record's decidedValue (never undefined/null - callers check
 * first) and returns a Markdown block. */
const GATE_OVERRIDES = {
  'crs-02_thematic-scope'(dv) {
    const rows = [];
    for (const k of ['sourceType', 'priorExperienceAnchor']) {
      if (dv[k] !== undefined) {
        const r = renderFieldValue(k, dv[k]);
        rows.push(`| ${k} | ${r.inline !== undefined ? r.inline : '*(below)*'} |`);
      }
    }
    if (dv.tierWindow && typeof dv.tierWindow === 'object') {
      for (const k of Object.keys(dv.tierWindow)) {
        const r = renderFieldValue(`tierWindow.${k}`, dv.tierWindow[k]);
        rows.push(`| tierWindow.${k} | ${r.inline !== undefined ? r.inline : '*(see list below)*'} |`);
      }
    }
    let block = ['| field | value |', '|---|---|', ...rows].join('\n');
    if (Array.isArray(dv.sectionsInScope)) {
      block += '\n\n**sectionsInScope**\n\n' + dv.sectionsInScope.map(s => `- ${JSON.stringify(s)}`).join('\n');
    }
    if (Array.isArray(dv.sectionsOutOfScope)) {
      block += '\n\n**sectionsOutOfScope**\n\n' + dv.sectionsOutOfScope.map(s => `- ${JSON.stringify(s)}`).join('\n');
    }
    if (Array.isArray(dv.subThemes) && dv.subThemes.length > 0) {
      block += '\n\n**subThemes**\n\n' + dv.subThemes.map(s => `- ${typeof s === 'string' ? s : JSON.stringify(s)}`).join('\n');
    }
    return block;
  },
  'crs-03_course-outcomes'(dv) {
    let block = Array.isArray(dv.courseOutcomes)
      ? dv.courseOutcomes.map((o, i) => `${i + 1}. **${o.id}**: ${o.text}`).join('\n')
      : '*(no courseOutcomes on this record)*';
    if (dv.courseOutcomeCountReason) {
      block += `\n\n**courseOutcomeCountReason**\n\n${dv.courseOutcomeCountReason}`;
    }
    if (Array.isArray(dv.courseOutcomeBanks) && dv.courseOutcomeBanks.length > 0) {
      const r = renderFieldValue('courseOutcomeBanks', dv.courseOutcomeBanks);
      block += '\n\n**courseOutcomeBanks**\n\n' + (r.block || r.inline || '');
    }
    return block;
  },
  'crs-04_lesson-map'(dv) {
    const lessons = Array.isArray(dv.lessons) ? dv.lessons : [];
    const rows = lessons.map(l => {
      const outcomes = Array.isArray(l.outcomes)
        ? l.outcomes.map(o => (typeof o === 'string' ? o : (o.id || o.text || JSON.stringify(o)))).join('; ')
        : '*(none)*';
      const sections = Array.isArray(l.sourceSections)
        ? l.sourceSections.map(s => `${s.chapterTitle || s.chapter || '?'} / ${s.heading || '?'} (${s.pages || '?'})`).join('; ')
        : (l.sourceSection || '*(none)*');
      return `| ${l.key} | ${l.title || '?'} | ${l.topic || '?'} | ${outcomes} | ${sections} |`;
    });
    let block = ['| key | title | topic | outcomes | source |', '|---|---|---|---|---|', ...rows].join('\n');
    if (dv.progression) {
      const r = renderFieldValue('progression', dv.progression);
      block += '\n\n**progression**\n\n' + (r.inline !== undefined ? r.inline : (r.block || ''));
    }
    return block;
  }
};

/** Classifies a record's "emptiness" per spec rule 5's five kinds.
 * Returns one of: null (not empty - has a real decidedValue),
 * 'skipped', 'deferred', or 'not-recordable' (the single bucket this
 * tool uses for "none stated" / "unknown" / "not applicable by
 * design", which share no field of their own in ADAPT's record -
 * spec section 8 open point 2, read and confirmed against schemas/
 * course-design.schema.json's records item shape this job). */
function classifyEmpty(record) {
  if (!record) return 'not-recordable';
  if (record.state === 'skipped') return 'skipped';
  if (record.state === 'deferred' || record.provenance === 'deferred') return 'deferred';
  const dv = record.decidedValue;
  if (dv === undefined || dv === null) return 'not-recordable';
  if (typeof dv === 'object' && !Array.isArray(dv) && Object.keys(dv).length === 0) return 'not-recordable';
  if (Array.isArray(dv) && dv.length === 0) return 'not-recordable';
  return null;
}

/** Not Ready triggers for one gate (spec rule 6 / section 7 test 4),
 * minus the "inferred value" trigger (see file header: no field to
 * read it from) and minus a separate "failing validator" trigger,
 * which is whole-document, not per-gate, and is added by the caller. */
function notReadyReasons(record, shape) {
  const reasons = [];
  if (!shape) reasons.push('no value shape');
  if (record) {
    if (record.state === 'proposed') reasons.push('open gate');
    if (record.provenance && STOOD_PROVENANCES.has(record.provenance) && !record.confirmedAt) {
      reasons.push('unconfirmed answer');
    }
  }
  return reasons;
}

function renderGateHeading(gateId, title) {
  return `### ${title} (\`${gateId}\`)`;
}

/** Renders one gate's subsection: rendered value, then provenance /
 * confirmation / grounding / gaps / dependsOn / record-number table
 * (spec section 3's own words for Part B of the per-gate template). */
function renderGateSection(storeGate, manifestGateId, entry, lessonHeading) {
  const lines = [];
  if (lessonHeading) lines.push(`#### ${lessonHeading}`, '');
  lines.push(renderGateHeading(manifestGateId, storeGate.name), '');

  const notReady = [];
  let emptyKind = null;

  if (!entry || entry.records.length === 0) {
    lines.push('*(pending: no record for this gate in this course design)*', '');
    return { markdown: lines.join('\n'), notReady: [{ gate: manifestGateId, reasons: ['no value shape'].filter(() => !storeGate.decidedValueShape) }], emptyKind: 'not-recordable' };
  }

  const records = entry.records;
  const record = records[records.length - 1];
  const shape = storeGate.decidedValueShape;
  const suffix = storeGate.id;
  emptyKind = classifyEmpty(record);

  if (record.supersedes !== undefined) {
    lines.push(`*(supersedes record ${record.supersedes})*`, '');
  }

  if (emptyKind === 'skipped') {
    lines.push('*(skipped: this gate\'s reachability condition was never met)*', '');
  } else if (emptyKind === 'deferred') {
    lines.push('*(deferred' + (record.deferReason ? `: ${record.deferReason}` : '') + ')*', '');
  } else if (emptyKind === 'not-recordable') {
    lines.push('*(not recordable in ADAPT\'s record)*', '');
  } else if (!shape) {
    const dv = record.decidedValue && typeof record.decidedValue === 'object' ? record.decidedValue : {};
    const fields = Object.keys(dv);
    lines.push(
      fields.length > 0
        ? fields.map(f => `- ${f}: ${renderFieldValue(f, dv[f]).inline || '*(see value)*'}`).join('\n')
        : '*(no top-level fields on this record)*',
      ''
    );
  } else if (OVERRIDE_GATES.has(suffix) && record.decidedValue && typeof record.decidedValue === 'object') {
    lines.push(GATE_OVERRIDES[suffix](record.decidedValue), '');
  } else {
    const r = renderFieldValue(storeGate.id, record.decidedValue);
    lines.push(r.inline !== undefined ? r.inline : r.block, '');
    if (r.longParas) lines.push(renderLongParas(r.longParas), '');
  }

  lines.push('| | |', '|---|---|');
  lines.push(`| state | ${record.state} |`);
  lines.push(`| provenance | ${record.provenance ? provenanceWord(record.provenance) : '*(none)*'} |`);
  lines.push(`| confirmedAt | ${record.confirmedAt || '*(none)*'} |`);
  lines.push(`| grounding | ${(record.grounding || []).length} citation(s) |`);
  lines.push(`| groundingGaps | ${(record.groundingGaps || []).length} gap(s) |`);
  const deps = (storeGate.dependsOn || []).map(d => `${d.gate} (${d.dependencyClass})`).join(', ') || '*(none)*';
  lines.push(`| dependsOn | ${deps} |`);
  lines.push(`| record | seq ${record.seq} of ${records.length} |`);
  lines.push('');

  notReady.push({ gate: manifestGateId, reasons: notReadyReasons(record, shape) });

  return { markdown: lines.join('\n'), notReady, emptyKind };
}

/** Core render. Throws (spec section 7 test 6) when courseDesign
 * carries no gates at all: "a check that reaches no subjects has not
 * passed." */
function renderCourseSpec(courseDesign, gatesStore, options) {
  options = options || {};
  if (!Array.isArray(courseDesign.gates) || courseDesign.gates.length === 0) {
    throw new Error('render-course-spec: this course design carries no gates: nothing to render');
  }
  const fieldLists = options.fieldLists || loadFieldLists(options.fieldsPath);
  const order = gateOrder.getOrder(gatesStore).filter(g => RENDERED_PHASES.includes(g.phase));

  const mapEntry = courseDesign.gates.find(g => g.gateId === 'crs-04_lesson-map');
  const mapRecord = mapEntry && mapEntry.records.length > 0 ? mapEntry.records[mapEntry.records.length - 1] : null;
  const lessons = (mapRecord && mapRecord.decidedValue && Array.isArray(mapRecord.decidedValue.lessons))
    ? mapRecord.decidedValue.lessons
    : [];
  const slug = courseDesign.slug;

  const bodyLines = [];
  const notReadyAll = [];
  const emptyKinds = [];

  for (const storeGate of order) {
    if (storeGate.repeatsPer === 'lesson') {
      if (lessons.length === 0) {
        bodyLines.push(`### ${storeGate.name} (\`${storeGate.id}\`)`, '', '*(pending: crs-04_lesson-map names no lessons yet)*', '');
        continue;
      }
      for (const lesson of lessons) {
        const bareKey = lessonBareKey(lesson, slug);
        // Per-lesson manifest id form `<slug>-<bareKey>-les-01` (settled
        // 7 Oct 2026): the store id's phase-and-number prefix, e.g.
        // les-01_lesson-proposal -> les-01.
        const shortId = storeGate.id.split('_')[0];
        const manifestGateId = bareKey ? `${slug}-${bareKey}-${shortId}` : null;
        const entry = manifestGateId ? courseDesign.gates.find(g => g.gateId === manifestGateId) : null;
        const result = renderGateSection(storeGate, manifestGateId || `${slug}-?-${shortId}`, entry, `Lesson ${lesson.key}`);
        bodyLines.push(result.markdown);
        notReadyAll.push(...result.notReady);
        emptyKinds.push({ gate: manifestGateId, kind: result.emptyKind });
      }
    } else {
      const entry = courseDesign.gates.find(g => g.gateId === storeGate.id);
      const result = renderGateSection(storeGate, storeGate.id, entry, null);
      bodyLines.push(result.markdown);
      notReadyAll.push(...result.notReady);
      emptyKinds.push({ gate: storeGate.id, kind: result.emptyKind });
    }
  }

  const section5 = renderSection5(courseDesign, fieldLists);
  for (const m of section5.missing) {
    notReadyAll.push({ gate: m.gate, reasons: [`field "${m.field}" for ${m.step}: ${m.reason}`] });
  }

  const notReadyFlat = [];
  if (options.validatorResult && options.validatorResult.pass === false) {
    notReadyFlat.push(`failing validator (${options.validatorResult.errorCount != null ? options.validatorResult.errorCount : '?'} error(s))`);
  }
  for (const nr of notReadyAll) {
    for (const reason of nr.reasons) {
      notReadyFlat.push(`${nr.gate}: ${reason}`);
    }
  }

  const header = [
    `# Course design specification: ${slug}`,
    '',
    `Rendered: ${options.now || new Date().toISOString()}`,
    `Renderer: ${RENDERER_NAME} ${RENDERER_VERSION}`,
    `Course slug: ${slug}`,
    `Commit: ${options.commit || '*(not supplied)*'}`,
    `design-kb (gates) kbVersion: ${gatesStore.kbVersion || '*(none)*'}`,
    `course design's own kbVersions: ${JSON.stringify(courseDesign.kbVersions || {})}`,
    ''
  ];

  const notReadySection = ['## Not ready', ''];
  if (notReadyFlat.length === 0) {
    notReadySection.push('None. Every gate rendered here is closed, confirmed and shaped.', '');
  } else {
    notReadySection.push(...notReadyFlat.map(r => `- ${r}`), '');
  }

  const gapsSection = ['## Gaps (empty values ADAPT\'s record cannot further distinguish)', ''];
  const notRecordable = emptyKinds.filter(e => e.kind === 'not-recordable');
  if (notRecordable.length === 0) {
    gapsSection.push('None found this render.', '');
  } else {
    gapsSection.push(
      ...notRecordable.map(e => `- ${e.gate}: empty for a reason ADAPT\'s record has no field to say (none stated / unknown / not applicable by design are not distinguished here).`),
      ''
    );
  }

  const markdown = [
    header.join('\n'),
    notReadySection.join('\n'),
    '## Gates', '',
    bodyLines.join('\n'),
    section5.markdown,
    gapsSection.join('\n')
  ].join('\n');

  return { markdown, notReady: notReadyFlat, section5Missing: section5.missing, emptyKinds };
}

function runValidator(courseDesignPath) {
  try {
    const out = execFileSync('python3', [
      path.join(ROOT, 'tools', 'validate-design-schemas.py'),
      '--course-design', courseDesignPath
    ], { encoding: 'utf8' });
    const m = out.match(/FAIL - (\d+) error/);
    if (m) return { pass: false, errorCount: Number(m[1]) };
    return { pass: /PASS/.test(out) };
  } catch (err) {
    const out = (err.stdout || '') + (err.stderr || '');
    const m = out.match(/FAIL - (\d+) error/);
    return { pass: false, errorCount: m ? Number(m[1]) : null };
  }
}

function parseArgs(argv) {
  const args = { course: null, store: null, out: null, skipValidator: false };
  argv.forEach(param => {
    if (param === '--skip-validator') { args.skipValidator = true; return; }
    const eq = param.indexOf('=');
    if (eq === -1) return;
    const key = param.slice(2, eq);
    const value = param.slice(eq + 1);
    if (key === 'course') args.course = value;
    if (key === 'store') args.store = value;
    if (key === 'out') args.out = value;
  });
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.course) {
    console.error('render-course-spec: usage: --course=<slug> [--store=<path>] [--out=<path>] [--skip-validator]');
    process.exit(1);
  }
  try {
    const store = gateOrder.loadStore(args.store);
    const courseDesignPath = path.join(ROOT, 'courses', args.course, `course-design_${args.course}.json`);
    const courseDesign = JSON.parse(fs.readFileSync(courseDesignPath, 'utf8'));
    let commit = '*(not supplied)*';
    try {
      commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8', cwd: ROOT }).trim();
    } catch (e) { /* leave placeholder */ }
    const validatorResult = args.skipValidator ? null : runValidator(courseDesignPath);
    const result = renderCourseSpec(courseDesign, store, { commit, validatorResult });

    const outPath = args.out
      ? path.resolve(args.out)
      : path.join(ROOT, 'courses', args.course, `adp-course-design-specification_${args.course}.md`);
    fs.writeFileSync(outPath, result.markdown);
    console.log(JSON.stringify({ wrote: outPath, notReadyCount: result.notReady.length }, null, 2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  loadFieldLists,
  fieldStatus,
  renderSection5,
  provenanceWord,
  renderFieldValue,
  classifyEmpty,
  notReadyReasons,
  renderGateSection,
  renderCourseSpec,
  runValidator,
  lessonBareKey,
  PROVENANCE_WORDS,
  STOOD_PROVENANCES,
  OVERRIDE_GATES
};
