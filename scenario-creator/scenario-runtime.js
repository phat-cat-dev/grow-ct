// Shared runtime for walking a scenario: state init, effects, conditional
// routing and {{var}} interpolation. Pure and dependency-free; runs in the
// browser (window.ScenarioRuntime) and Node (require). The player drives it.
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.ScenarioRuntime = value;
}(typeof self !== 'undefined' ? self : this, function () {
  function initState(scenario) {
    const state = {};
    for (const variable of (scenario.variables || [])) {
      state[variable.id] = variable.default != null ? variable.default
        : variable.type === 'number' ? 0 : variable.type === 'boolean' ? false : '';
    }
    return state;
  }

  function applyEffects(state, effects) {
    for (const effect of (effects || [])) {
      if (!effect || !effect.var) continue;
      const current = state[effect.var];
      switch (effect.op) {
        case 'set': state[effect.var] = effect.value; break;
        case 'add': state[effect.var] = (Number(current) || 0) + Number(effect.value || 0); break;
        case 'subtract': state[effect.var] = (Number(current) || 0) - Number(effect.value || 0); break;
        case 'toggle': state[effect.var] = !current; break;
      }
    }
    return state;
  }

  function evalCondition(state, condition) {
    if (!condition || !condition.var) return false;
    const actual = state[condition.var];
    const value = condition.value;
    switch (condition.op) {
      case 'eq': return actual === value;
      case 'ne': return actual !== value;
      case 'gt': return Number(actual) > Number(value);
      case 'gte': return Number(actual) >= Number(value);
      case 'lt': return Number(actual) < Number(value);
      case 'lte': return Number(actual) <= Number(value);
      case 'truthy': return !!actual;
      case 'falsy': return !actual;
      default: return false;
    }
  }

  // The next node id for a continue/auto node, honouring conditional branches.
  function resolveNext(node, state) {
    for (const branch of (node.branches || [])) {
      if (evalCondition(state, branch.if)) return branch.next;
    }
    return node.next || null;
  }

  function interpolate(text, state) {
    if (typeof text !== 'string') return text;
    return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (whole, name) =>
      Object.prototype.hasOwnProperty.call(state, name) ? String(state[name]) : whole);
  }

  return { initState, applyEffects, evalCondition, resolveNext, interpolate };
}));
