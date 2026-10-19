// Structural + pedagogical validator for GROW branching scenarios. Runs in the
// browser (<script src> → window.ScenarioValidator) and in Node (require).
// It checks the rules a JSON Schema can (shape, references) AND the graph rules
// a schema cannot (reachability, dead ends, ending spread, cosmetic branches).
// No dependencies.
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.ScenarioValidator = value;
}(typeof self !== 'undefined' ? self : this, function () {
  const TYPES = ['continue', 'choice', 'auto', 'ending'];
  const LAYERS = ['opening', 'decision', 'consequence', 'reflection', 'ending', 'info'];
  const EFFECT_OPS = ['set', 'add', 'subtract', 'toggle'];
  const COND_OPS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'truthy', 'falsy'];
  const isKebab = id => typeof id === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(id);
  const isVarId = id => typeof id === 'string' && /^[a-z0-9][a-z0-9_]*$/.test(id);

  // Outward targets of a node (ids it can lead to), including conditional branches.
  function targetsOf(node) {
    if (!node || typeof node !== 'object') return [];
    if (node.type === 'choice') return (node.choices || []).map(c => c && c.next).filter(Boolean);
    if (node.type === 'continue' || node.type === 'auto') {
      const branched = (node.branches || []).map(b => b && b.next).filter(Boolean);
      return node.next ? [...branched, node.next] : branched;
    }
    return [];
  }

  function validate(scenario) {
    const errors = [];
    const warnings = [];
    const err = (message, where) => errors.push(where ? `${where}: ${message}` : message);
    const warn = (message, where) => warnings.push(where ? `${where}: ${message}` : message);

    if (!scenario || typeof scenario !== 'object' || Array.isArray(scenario)) {
      return { valid: false, errors: ['Scenario must be a JSON object.'], warnings: [], stats: null };
    }
    if (![1, 2].includes(scenario.version)) err(`version must be 1 or 2 (got ${JSON.stringify(scenario.version)}).`);
    if (!scenario.id) err('Missing "id".'); else if (!isKebab(scenario.id)) warn('"id" should be kebab-case (a-z, 0-9, -).');
    if (!scenario.title) err('Missing "title".');
    if (!Array.isArray(scenario.nodes)) { err('"nodes" must be an array.'); return done(); }
    if (scenario.nodes.length < 2) err('A scenario needs at least 2 nodes.');
    if (scenario.branchStyle && !['spine', 'tree', 'mixed'].includes(scenario.branchStyle)) warn(`Unknown branchStyle "${scenario.branchStyle}".`);
    if (!Array.isArray(scenario.learningOutcomes) || scenario.learningOutcomes.length === 0) {
      warn('No learningOutcomes — a scenario should name the judgements it teaches.');
    }

    // Variables (state carried forward into later scenes).
    const declaredVars = new Map();
    const usedVars = new Set();
    if (scenario.variables != null) {
      if (!Array.isArray(scenario.variables)) err('"variables" must be an array.');
      else scenario.variables.forEach((variable, i) => {
        const vw = `variable ${i + 1}`;
        if (!variable || typeof variable !== 'object') { err('Variable is not an object.', vw); return; }
        if (!variable.id) err('Variable is missing "id".', vw);
        else if (!isVarId(variable.id)) warn('Variable id should be snake_case (a-z, 0-9, _).', vw);
        if (declaredVars.has(variable.id)) err(`Duplicate variable id "${variable.id}".`, vw);
        else declaredVars.set(variable.id, variable);
        if (!['number', 'boolean', 'string'].includes(variable.type)) err(`Variable "${variable.id}" has unknown type "${variable.type}".`, vw);
        if (variable.default != null && variable.type && typeof variable.default !== variable.type) {
          warn(`Variable "${variable.id}" default is not a ${variable.type}.`, vw);
        }
      });
    }
    const checkEffect = (effect, where) => {
      if (!effect || typeof effect !== 'object') { err('Effect is not an object.', where); return; }
      if (!effect.var) err('Effect is missing "var".', where);
      else if (!declaredVars.has(effect.var)) err(`Effect references undeclared variable "${effect.var}".`, where);
      else usedVars.add(effect.var);
      if (!EFFECT_OPS.includes(effect.op)) err(`Effect has unknown op "${effect.op}" (${EFFECT_OPS.join(', ')}).`, where);
      if ((effect.op === 'add' || effect.op === 'subtract') && typeof effect.value !== 'number') err('add / subtract need a numeric "value".', where);
      if (effect.op === 'set' && effect.value == null) err('set needs a "value".', where);
    };
    const checkCondition = (condition, where) => {
      if (!condition || typeof condition !== 'object') { err('Condition is not an object.', where); return; }
      if (!condition.var) err('Condition is missing "var".', where);
      else if (!declaredVars.has(condition.var)) err(`Condition references undeclared variable "${condition.var}".`, where);
      else usedVars.add(condition.var);
      if (!COND_OPS.includes(condition.op)) err(`Condition has unknown op "${condition.op}" (${COND_OPS.join(', ')}).`, where);
      if (['eq', 'ne', 'gt', 'gte', 'lt', 'lte'].includes(condition.op) && condition.value == null) err(`Condition op "${condition.op}" needs a "value".`, where);
    };

    // Index nodes, catch duplicates and shape errors.
    const byId = new Map();
    for (const node of scenario.nodes) {
      const where = `node "${node && node.id ? node.id : '?'}"`;
      if (!node || typeof node !== 'object') { err('Node is not an object.'); continue; }
      if (!node.id) { err('Node is missing "id".'); continue; }
      if (!isKebab(node.id)) warn('id should be kebab-case.', where);
      if (byId.has(node.id)) err(`Duplicate node id "${node.id}".`); else byId.set(node.id, node);
      if (!TYPES.includes(node.type)) err(`Unknown type "${node.type}" (expected ${TYPES.join(', ')}).`, where);
      if (!node.title) warn('Missing "title".', where);
      if (!node.body) warn('Missing "body".', where);
      if (node.layer && !LAYERS.includes(node.layer)) warn(`Unknown layer "${node.layer}".`, where);

      if (node.type === 'choice') {
        if (!Array.isArray(node.choices) || node.choices.length < 2) err('A choice needs at least 2 choices.', where);
        else {
          if (node.choices.length > 4) warn('More than 4 choices becomes a menu, not a judgement.', where);
          const signatures = new Set();
          node.choices.forEach((choice, i) => {
            const cw = `${where} choice ${i + 1}`;
            if (!choice || typeof choice !== 'object') { err('Choice is not an object.', cw); return; }
            if (!choice.label) err('Choice is missing "label".', cw);
            if (!choice.next) err('Choice is missing "next".', cw);
            if (choice.quality && !['strong', 'workable', 'weak'].includes(choice.quality)) warn(`Unknown quality "${choice.quality}".`, cw);
            // A branch is only cosmetic if choices share BOTH the same next and
            // the same effects — differing state still carries a path forward.
            if (choice.next) signatures.add(`${choice.next}|${JSON.stringify(choice.effects || [])}`);
          });
          if (signatures.size === 1) warn('All choices lead to the same node with the same effects — the branch is cosmetic.', where);
        }
        if (node.next) warn('A choice node should not have "next".', where);
      } else if (node.type === 'continue' || node.type === 'auto') {
        if (!node.next) err('Needs "next".', where);
        if (node.choices) warn('Only choice nodes use "choices".', where);
        if (node.type === 'auto' && (node.delayMs == null)) warn('auto node has no delayMs; a default will be used.', where);
        if (node.delayMs != null && (typeof node.delayMs !== 'number' || node.delayMs < 0)) err('delayMs must be a number ≥ 0.', where);
      } else if (node.type === 'ending') {
        if (node.next) err('An ending must not have "next".', where);
        if (node.choices) err('An ending must not have "choices".', where);
        if (node.outcome && !['positive', 'mixed', 'negative'].includes(node.outcome)) warn(`Unknown outcome "${node.outcome}".`, where);
        if (!node.outcome) warn('Ending has no "outcome" (positive / mixed / negative).', where);
      }

      // State: effects (any node) and conditional branches (continue / auto).
      if (node.effects != null) {
        if (!Array.isArray(node.effects)) err('"effects" must be an array.', where);
        else node.effects.forEach((effect, i) => checkEffect(effect, `${where} effect ${i + 1}`));
      }
      if (node.branches != null) {
        if (!Array.isArray(node.branches)) err('"branches" must be an array.', where);
        else if (node.type !== 'continue' && node.type !== 'auto') warn('Only continue / auto nodes use "branches".', where);
        else node.branches.forEach((branch, i) => {
          const bw = `${where} branch ${i + 1}`;
          if (!branch || typeof branch !== 'object') { err('Branch is not an object.', bw); return; }
          checkCondition(branch.if, bw);
          if (!branch.next) err('Branch is missing "next".', bw);
        });
      }
      if (Array.isArray(node.choices)) {
        node.choices.forEach((choice, i) => {
          if (choice && Array.isArray(choice.effects)) choice.effects.forEach((effect, j) => checkEffect(effect, `${where} choice ${i + 1} effect ${j + 1}`));
        });
      }
    }

    // Variables used in {{interpolation}} count as used; flag undeclared ones.
    const interpolated = new Set();
    for (const node of scenario.nodes) {
      for (const field of ['title', 'body', 'prompt', 'debrief']) {
        const text = node && node[field];
        if (typeof text !== 'string') continue;
        for (const match of text.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)) interpolated.add(match[1]);
      }
    }
    for (const name of interpolated) {
      if (declaredVars.has(name)) usedVars.add(name);
      else warn(`Text interpolates undeclared variable "{{${name}}}".`);
    }
    for (const [varId] of declaredVars) {
      if (!usedVars.has(varId)) warn(`Variable "${varId}" is declared but never used.`);
    }

    // Reference integrity.
    for (const node of scenario.nodes) {
      if (!node || !node.id) continue;
      for (const target of targetsOf(node)) {
        if (!byId.has(target)) err(`points to missing node "${target}".`, `node "${node.id}"`);
      }
    }
    if (!scenario.start) err('Missing "start".');
    else if (!byId.has(scenario.start)) err(`start "${scenario.start}" is not a node.`);

    // Reachability from start.
    const reachable = new Set();
    if (scenario.start && byId.has(scenario.start)) {
      const queue = [scenario.start];
      while (queue.length) {
        const id = queue.shift();
        if (reachable.has(id)) continue;
        reachable.add(id);
        for (const target of targetsOf(byId.get(id))) if (byId.has(target) && !reachable.has(target)) queue.push(target);
      }
    }
    for (const node of scenario.nodes) {
      if (node && node.id && !reachable.has(node.id)) warn('is unreachable from start.', `node "${node.id}"`);
    }

    // Dead ends: a non-ending with no outward edge.
    for (const node of scenario.nodes) {
      if (!node || !node.id || node.type === 'ending') continue;
      if (targetsOf(node).length === 0) err('is a dead end (no reachable next).', `node "${node.id}"`);
    }

    // Endings reachable + spread.
    const endings = scenario.nodes.filter(n => n && n.type === 'ending');
    const reachableEndings = endings.filter(n => reachable.has(n.id));
    if (endings.length === 0) err('No ending node — a scenario needs at least one outcome.');
    else if (reachableEndings.length === 0) err('No ending is reachable from start.');
    if ((scenario.branchStyle === 'tree' || scenario.branchStyle === 'mixed') && reachableEndings.length < 2) {
      warn('A tree / mixed scenario reaches fewer than 2 endings — the branching may be cosmetic.');
    }
    const outcomes = new Set(reachableEndings.map(n => n.outcome).filter(Boolean));
    if (reachableEndings.length >= 2 && outcomes.size < 2) warn('All reachable endings share one outcome — consider differentiating positive / mixed / negative.');

    // Cycles (allowed, but warn: a learner could loop).
    if (hasCycle(scenario, byId)) warn('The graph contains a cycle; make sure the learner can always progress to an ending.');

    return done();

    function done() {
      const counts = {};
      for (const node of (scenario.nodes || [])) if (node && node.type) counts[node.type] = (counts[node.type] || 0) + 1;
      const stats = {
        nodes: (scenario.nodes || []).length,
        byType: counts,
        reachable: reachable.size,
        endings: endings.length,
        reachableEndings: reachableEndings.length,
        longestPath: longestPath(scenario, byId),
      };
      return { valid: errors.length === 0, errors, warnings, stats };
    }
  }

  function hasCycle(scenario, byId) {
    const state = new Map(); // 0 visiting, 1 done
    let found = false;
    const visit = id => {
      if (found) return;
      if (state.get(id) === 0) { found = true; return; }
      if (state.get(id) === 1) return;
      state.set(id, 0);
      for (const target of targetsOf(byId.get(id))) if (byId.has(target)) visit(target);
      state.set(id, 1);
    };
    if (scenario.start && byId.has(scenario.start)) visit(scenario.start);
    return found;
  }

  // Longest acyclic path length (in nodes) from start — a rough "depth".
  function longestPath(scenario, byId) {
    if (!scenario.start || !byId.has(scenario.start)) return 0;
    const memo = new Map();
    const walk = (id, seen) => {
      if (seen.has(id)) return 0; // break cycles
      if (memo.has(id)) return memo.get(id);
      const next = targetsOf(byId.get(id)).filter(t => byId.has(t));
      const nextSeen = new Set(seen); nextSeen.add(id);
      let best = 0;
      for (const target of next) best = Math.max(best, walk(target, nextSeen));
      const result = 1 + best;
      if (next.every(t => !nextSeen.has(t))) memo.set(id, result);
      return result;
    };
    return walk(scenario.start, new Set());
  }

  return { validate, targetsOf, TYPES, LAYERS };
}));
