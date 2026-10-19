// Deterministic scaffold generator for the builder: turns a topic + qualifiers
// into a VALID starter scenario in the chosen branch structure, with each node
// pre-tagged by pedagogical layer and pre-filled with that layer's purpose and
// topic-seeded placeholder text — ready to refine in the editor. Also builds a
// filled authoring brief an agent can expand into finished prose.
// UMD: window.ScenarioScaffold (browser) / require (Node). Pass layer-prompts in.
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.ScenarioScaffold = value;
}(typeof self !== 'undefined' ? self : this, function () {
  const kebab = t => String(t || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const snake = t => String(t || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n | 0));

  function generate(cfg, prompts) {
    const topic = (cfg.topic || '').trim();
    const decisions = clamp(cfg.decisions || 3, 1, 6);
    const style = ['spine', 'tree', 'mixed'].includes(cfg.branchStyle) ? cfg.branchStyle : 'mixed';
    const reflections = cfg.reflections !== false;
    const consType = cfg.consequenceType === 'continue' ? 'continue' : 'auto';
    const purpose = layer => (prompts && prompts.layers && prompts.layers[layer] && prompts.layers[layer].purpose) || '';
    const topicPhrase = topic || '[the topic]';
    let varId = cfg.trackVariable ? snake(cfg.trackVariable) : '';
    if (style === 'mixed' && !varId) varId = 'score';

    const variables = varId ? [{ id: varId, label: cfg.trackVariable || 'Score', type: 'number', default: 0, description: 'Rises with stronger judgement; carried forward to shape the ending.' }] : [];
    const nodes = [];
    const add = n => { nodes.push(n); return n.id; };

    const consequence = (id, title, body, next, delayMs) => consType === 'auto'
      ? { id, type: 'auto', layer: 'consequence', title, purpose: purpose('consequence'), body, delayMs: delayMs == null ? 1500 : delayMs, button: 'What happens next?', next }
      : { id, type: 'continue', layer: 'consequence', title, purpose: purpose('consequence'), body, button: 'What happens next?', next };
    const reflection = (id, next) => ({ id, type: 'continue', layer: 'reflection', title: 'A moment to reflect', purpose: purpose('reflection'), body: '[A short pause.]', prompt: `[One open question about ${topicPhrase}, tied to a learning outcome.]`, button: 'Decide what to do next', next });
    const ending = (id, title, outcome) => ({ id, type: 'ending', layer: 'ending', title, outcome, body: `[Resolve this path through ${topicPhrase} in-world.]`, prompt: '[What would a different route have changed?]', debrief: '[Tie the outcome back to the learning outcomes.]' });
    const strongEffect = () => varId ? [{ var: varId, op: 'add', value: 1 }] : undefined;
    const weakEffect = () => varId ? [{ var: varId, op: 'subtract', value: 1 }] : undefined;

    add({ id: 'opening', type: 'continue', layer: 'opening', title: 'Opening', purpose: purpose('opening'),
      body: `You are [the learner's role], facing ${topicPhrase}. [Establish the role, the context and what is at stake, then point straight at the first decision.]`,
      button: 'Step into the scenario', next: 'decision-1' });

    if (style === 'spine') {
      for (let i = 1; i <= decisions; i++) {
        const last = i === decisions;
        const afterCons = reflections ? `reflection-${i}` : (last ? 'outcome' : `decision-${i + 1}`);
        add({ id: `decision-${i}`, type: 'choice', layer: 'decision', title: `Decision ${i}`, purpose: purpose('decision'),
          body: `[Decision ${i} about ${topicPhrase}. Make the trade-off real.]`,
          choices: [
            { label: '[Option 1 — a mental model]', mentalModel: '[The reasoning behind this]', quality: 'strong', next: `consequence-${i}-a`, effects: strongEffect() },
            { label: '[Option 2 — a different mental model]', mentalModel: '[The reasoning behind this]', quality: 'weak', next: `consequence-${i}-b`, effects: weakEffect() },
          ].map(clean) });
        add(consequence(`consequence-${i}-a`, `Result of option 1`, `[Realistic result of option 1 at decision ${i}.]`, afterCons));
        add(consequence(`consequence-${i}-b`, `Result of option 2`, `[Realistic result of option 2 at decision ${i}.]`, afterCons));
        if (reflections) add(reflection(`reflection-${i}`, last ? 'outcome' : `decision-${i + 1}`));
      }
      add(ending('outcome', 'Outcome', 'positive'));
    }

    if (style === 'tree') {
      for (let i = 1; i <= decisions; i++) {
        const last = i === decisions;
        const strongNext = last ? 'ending-success' : `decision-${i + 1}`;
        add({ id: `decision-${i}`, type: 'choice', layer: 'decision', title: `Decision ${i}`, purpose: purpose('decision'),
          body: `[Decision ${i} about ${topicPhrase}. Each option is a believable way to think about it.]`,
          choices: [
            { label: '[Stronger option — a mental model]', mentalModel: '[Reasoning]', quality: 'strong', next: `consequence-${i}-strong` },
            { label: '[Weaker option — a different mental model]', mentalModel: '[Reasoning]', quality: 'weak', next: `consequence-${i}-weak` },
          ] });
        const afterStrong = reflections ? `reflection-${i}` : strongNext;
        add(consequence(`consequence-${i}-strong`, 'That worked', `[Good things follow from the stronger choice at decision ${i}.]`, afterStrong));
        if (reflections) add(reflection(`reflection-${i}`, strongNext));
        add(consequence(`consequence-${i}-weak`, 'That backfired', `[The weaker choice at decision ${i} leads here.]`, `ending-${i}`));
        add(ending(`ending-${i}`, `Early ending ${i}`, i % 2 ? 'negative' : 'mixed'));
      }
      add(ending('ending-success', 'Best outcome', 'positive'));
    }

    if (style === 'mixed') {
      for (let i = 1; i <= decisions; i++) {
        const last = i === decisions;
        const rejoin = last ? 'resolve' : `decision-${i + 1}`;
        const afterStrong = reflections ? `reflection-${i}` : rejoin;
        add({ id: `decision-${i}`, type: 'choice', layer: 'decision', title: `Decision ${i}`, purpose: purpose('decision'),
          body: `[Decision ${i} about ${topicPhrase}. The trade-off compounds as state is carried forward.]`,
          choices: [
            { label: '[Stronger option — a mental model]', mentalModel: '[Reasoning]', quality: 'strong', next: `consequence-${i}-strong`, effects: strongEffect() },
            { label: '[Weaker option — a different mental model]', mentalModel: '[Reasoning]', quality: 'weak', next: `consequence-${i}-weak`, effects: weakEffect() },
          ].map(clean) });
        add(consequence(`consequence-${i}-strong`, 'That built trust', `[The stronger choice at decision ${i} pays off.]`, afterStrong));
        add(consequence(`consequence-${i}-weak`, 'That cost you', `[The weaker choice at decision ${i} complicates things, then rejoins the path.]`, rejoin));
        if (reflections) add(reflection(`reflection-${i}`, rejoin));
      }
      const high = Math.ceil(decisions / 2);
      add({ id: 'resolve', type: 'continue', layer: 'consequence', title: 'It all comes together', purpose: 'Carry the variable forward: the ending is chosen by accumulated state, not just the last click.',
        body: `[How ${topicPhrase} resolves depends on everything carried so far.]`, button: 'See how it lands',
        branches: [
          { if: { var: varId, op: 'gte', value: high }, next: 'ending-positive' },
          { if: { var: varId, op: 'lte', value: -1 }, next: 'ending-negative' },
        ], next: 'ending-mixed' });
      add(ending('ending-positive', 'Strong outcome', 'positive'));
      add(ending('ending-mixed', 'Mixed outcome', 'mixed'));
      add(ending('ending-negative', 'Poor outcome', 'negative'));
    }

    return {
      version: 2,
      id: kebab(cfg.id || topic || 'new-scenario') || 'new-scenario',
      title: cfg.title || (topic ? topic.charAt(0).toUpperCase() + topic.slice(1) : 'New scenario'),
      intro: cfg.intro || `${cfg.audience ? cfg.audience + '. ' : ''}A branching scenario on ${topicPhrase}.`,
      audience: cfg.audience || '',
      learningOutcomes: (cfg.learningOutcomes || []).filter(Boolean),
      branchStyle: style,
      variables,
      meta: cleanMeta({ tone: cfg.tone, readingLevel: cfg.readingLevel, generatedBy: 'scenario-creator/builder' }),
      start: 'opening',
      nodes,
    };
  }

  // Remove undefined effect arrays so the JSON stays clean.
  function clean(choice) { if (!choice.effects) delete choice.effects; return choice; }
  function cleanMeta(meta) { const out = {}; for (const k in meta) if (meta[k]) out[k] = meta[k]; return out; }

  // A filled authoring brief an agent expands into finished prose.
  function brief(cfg) {
    const topic = (cfg.topic || '[topic]').trim();
    const lines = [];
    lines.push(`Topic: ${topic}`);
    if (cfg.audience) lines.push(`Audience: ${cfg.audience}`);
    lines.push(`Learning outcomes (judgements to improve):`);
    (cfg.learningOutcomes && cfg.learningOutcomes.length ? cfg.learningOutcomes : ['[name 1–4 observable judgements]']).forEach(o => lines.push(`  - ${o}`));
    lines.push(`Decision points: ${clamp(cfg.decisions || 3, 1, 6)}`);
    lines.push(`Branch structure: ${cfg.branchStyle || 'mixed'} (spine = reconverge · tree = multiple endings · mixed = reconverge + carry a variable forward)`);
    if (cfg.trackVariable || cfg.branchStyle === 'mixed') lines.push(`Carry a variable forward: ${cfg.trackVariable || 'score'}`);
    if (cfg.tone) lines.push(`Tone: ${cfg.tone}`);
    if (cfg.readingLevel) lines.push(`Reading level: ${cfg.readingLevel}`);
    return lines.join('\n');
  }

  return { generate, brief };
}));
