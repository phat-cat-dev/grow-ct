/**
 * growMeta — the universal frontmatter / metadata stamp (the DATA layer).
 *
 * BEM (.frontmatter + __elements + --role modifier) is the PRESENTATION layer
 * and lives in templates/LESS. The DATA layer lives here: every object element
 * carries its identity + metadata as data-* attributes ALWAYS, whether or not
 * the frontmatter is shown. _display only decides whether it ALSO renders.
 *
 *   data-grow-role    lesson | phase | section | learning-step | item
 *   data-grow-level   dNN depth, always 2-digit (lesson=01, phase=02, section=03, step=04)
 *   data-grow-type    the semantic function (e.g. learning-outcomes)
 *   data-fm-<key>     each frontmatter field (metadata, inspectable/styleable)
 */
export function stampMeta(el, fm, opts = {}) {
  const node = el && el.jquery ? el[0] : el;
  if (!node) return;
  const { role, depth, type } = opts;
  if (role != null) node.setAttribute('data-grow-role', String(role));
  // data layer levels are always 2-digit (dNN)
  if (depth != null) node.setAttribute('data-grow-level', String(depth).padStart(2, '0'));
  // _role / _type on the frontmatter object override the level defaults
  const r = (fm && fm._role) || role;
  const t = (fm && fm._type) || type;
  if (r != null) node.setAttribute('data-grow-role', String(r));
  if (t != null) node.setAttribute('data-grow-type', String(t));
  if (!fm) return;
  node.setAttribute('data-fm', fm._isEnabled ? 'on' : 'off');
  if (fm._display === false) node.setAttribute('data-fm-display', 'off');
  (fm._fields || []).forEach(f => {
    if (!f || f._key == null) return;
    node.setAttribute('data-fm-' + String(f._key), f.value == null ? '' : String(f.value));
  });
}

export default stampMeta;
