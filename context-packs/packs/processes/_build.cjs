#!/usr/bin/env node
/* Build the 20 Universal Academic Process activities as context packs, plus a
   SKOS JSON-LD graph and a manifest. Each process is a `process`-stage pack:
   a goal (statement) + ordered moves (steps) revealed one at a time — the
   interactive form of a skos:definition / ProcessSteps.

   Run:  node tools/context-packs/packs/processes/_build.cjs
   Writes: <id>.json here · ../../../../.dev/docs/academic-processes.skos.jsonld · manifest.json */

const fs = require('fs');
const path = require('path');

const GROUPS = {
  'intellectual-depth': 'Intellectual Depth (Thinking)',
  'research-retrieval': 'Research & Retrieval (Doing)',
  'communication-reflection': 'Communication & Reflection (Applying)',
};
const BASE = 'https://grow.local/process/';

// [id, title, group, altLabel|null, related[], statement, steps[[title,text]...], feedForward]
const P = [
  ['critical-analysis', 'Critical Analysis', 'intellectual-depth', 'Evaluation of Arguments', ['argument-mapping', 'source-evaluation'],
    'Move past summarising to judging a source: test its central claim, its hidden assumptions, and whether the evidence actually holds.',
    [
      ['Identify the core claim', 'Find the single main point you are being asked to accept. Everything else is scaffolding around it.'],
      ['Surface the assumptions', 'Name the beliefs that must be true for the claim to stand — especially the ones left unstated.'],
      ['Weigh the evidence', 'Is the support sufficient, relevant and unbiased? Ask what data would contradict the claim.'],
      ['Judge the reasoning', 'Check the step from evidence to claim. A true premise can still carry a broken inference.'],
      ['Form your verdict', 'Decide how far the claim earns your acceptance, and say exactly where it is strong and where it is weak.'],
    ],
    'Now do it on your own reading: quote the claim, list two assumptions, and name the single weakest link in the argument.'],

  ['argument-mapping', 'Argument Mapping', 'intellectual-depth', null, ['critical-analysis', 'counter-argumentation'],
    'Make the shape of an argument visible: separate the thesis, the support beneath it, and the objections that push back.',
    [
      ['Find the thesis (the root)', 'Pin down the one conclusion the whole argument exists to establish.'],
      ['Map the supporting premises', 'Branch each reason and piece of evidence beneath the thesis it serves.'],
      ['Add the counter-arguments', 'Place the strongest objections as conflict nodes against the lines they attack.'],
      ['Trace the dependencies', 'Draw which premises must hold for the next step to follow — expose the load-bearing links.'],
      ['Spot the gaps', 'Look for a conclusion with no support, or support with no link. Gaps are where arguments fail.'],
    ],
    'Map a paragraph from your own draft: one root, its branches, one counter-node. If a branch has no evidence, that is your next job.'],

  ['problem-decomposition', 'Problem Decomposition', 'intellectual-depth', null, ['research-design', 'time-management'],
    'Take a huge, ill-defined problem and break it into manageable, testable sub-components you can actually work on.',
    [
      ['Name the whole problem', 'State the big problem plainly, in one sentence, before you cut it up.'],
      ['Split into sub-problems', 'Break it into parts that are smaller, clearer and separable from each other.'],
      ['Make each piece testable', 'Rewrite each part so progress on it can be checked — vague parts hide the real work.'],
      ['Order by dependency', 'Find which pieces must be solved before others, and sequence them accordingly.'],
      ['Pick the first tractable piece', 'Choose the smallest part that moves the whole forward, and start there.'],
    ],
    'Take your assignment topic and write three sub-questions, each narrow enough to answer in a paragraph.'],

  ['hypothesis-generation', 'Hypothesis Generation', 'intellectual-depth', null, ['research-design', 'critical-analysis'],
    'Turn an observation or theory into a specific, testable prediction — one that could be shown to be wrong.',
    [
      ['Observe closely', 'Start from a concrete observation or a pattern in existing theory, not a hunch.'],
      ['State the pattern', 'Put the relationship into words: when X happens, Y seems to follow.'],
      ['Make it a prediction', 'Turn the pattern into an if–then statement you could actually test.'],
      ['Make it falsifiable', 'Ensure some possible result would prove it false — unfalsifiable claims are not hypotheses.'],
      ['Define the disproof', 'Say in advance what observation would make you abandon it. That is what makes it science.'],
    ],
    'Write one hypothesis for your topic as an if–then sentence, and state the result that would disprove it.'],

  ['counter-argumentation', 'Counter-argumentation', 'intellectual-depth', null, ['argument-mapping', 'critical-analysis'],
    'Strengthen your own position by seeking out and answering the best case against it — not the weakest.',
    [
      ['State your thesis', 'Write the claim you are defending clearly enough to attack.'],
      ['Build the strongest opposing case', 'Steel-man it: make the objection as convincing as its best advocate would.'],
      ['Find its best evidence', 'Give the counter-case real support, not a straw version you can knock down.'],
      ['Answer it honestly', 'Concede what is right in it, then show why your thesis still holds — or adjust it.'],
      ['Strengthen or revise', 'A thesis that survives its best objection is stronger; one that does not should change.'],
    ],
    'Write the single best objection to your argument, then a two-sentence reply that concedes something real.'],

  ['literature-reviewing', 'Literature Reviewing', 'research-retrieval', null, ['literature-search', 'synthesis', 'source-evaluation'],
    'Go beyond listing sources: synthesise them, map what is known, and find the gap your work will fill.',
    [
      ['Gather the key works', 'Collect the sources that actually shape the conversation, not everything you can find.'],
      ['Group by theme or position', 'Cluster sources by what they argue or find, so the field has a shape.'],
      ['Synthesise across them', 'Write about the debate, not source-by-source — where they agree, clash and build.'],
      ['Find the gap', 'Name the question the literature has not yet answered. That gap is your opening.'],
      ['Place your work in the lineage', 'Show how your study follows from, and adds to, what came before.'],
    ],
    'For five sources on your topic, write one sentence that groups three of them and names the gap the other two leave.'],

  ['source-evaluation', 'Source Evaluation', 'research-retrieval', 'Source Criticism', ['craap', 'radar', 'robot', 'critical-analysis'],
    'Apply a framework to decide whether a source is trustworthy enough to cite — before you rely on it.',
    [
      ['Identify the source', 'See what you are dealing with: who, where, when, and what kind of thing it is.'],
      ['Check currency and authority', 'Is it recent enough for the topic, and does the author have credible standing?'],
      ['Test accuracy and evidence', 'Can the claims be checked? Look for citations, data and corroboration.'],
      ['Read the purpose and bias', 'Ask why it was made — to inform, or to persuade and sell. Motive shapes content.'],
      ['Reach a verdict', 'Weigh the lenses together: relevant is not the same as reliable.'],
    ],
    'Pick one source and run it through a full framework — try the worked CRAAP, RADAR and ROBOT activities to see the same source three ways.'],

  ['research-design', 'Research Design', 'research-retrieval', null, ['hypothesis-generation', 'problem-decomposition'],
    'Move from a vague question to an actionable, testable plan — structured before any data is collected.',
    [
      ['Define the gap and question', 'Turn the gap in the literature into one precise, answerable research question.'],
      ['Set the scope', 'Decide what can be studied and what must be deliberately left out.'],
      ['Choose the methodology', 'Pick qualitative, quantitative or mixed methods — justified by the question, not habit.'],
      ['Define variables and hypotheses', 'Name what you will measure and state your null and alternative hypotheses.'],
      ['Design the instruments', 'Build the surveys, interviews or experiments that will actually collect the data.'],
    ],
    'Draft your study in five lines: question, scope, method, variables, instrument. If any line is vague, the design is not ready.'],

  ['data-interpretation', 'Data Interpretation & Visualisation', 'research-retrieval', null, ['research-design', 'presentation-storytelling'],
    'Convert raw numbers or qualitative material into a meaningful, honest narrative — with the right picture.',
    [
      ['Clean and check the data', 'Fix errors, note what is missing, and understand how the data was produced.'],
      ['Choose the right summary or visual', 'Match the chart to the question — the picture should reveal the pattern, not decorate it.'],
      ['Read the pattern', 'Say what the data shows plainly, distinguishing the signal from the noise.'],
      ['State the uncertainty', 'Report the limits — variation, sample size, what the data cannot tell you.'],
      ['Turn it into a narrative', 'Explain what it means for the question, not just what the numbers are.'],
    ],
    'For one result, write the single sentence it supports — and one sentence on what it does NOT prove.'],

  ['literature-search', 'Literature Search Strategy', 'research-retrieval', 'Boolean search mastery', ['literature-reviewing', 'source-evaluation'],
    'Find the right sources efficiently and ethically — by searching deliberately, not by scrolling.',
    [
      ['Break the question into concepts', 'Pull out the two or three core ideas your search must combine.'],
      ['Build search strings', 'Combine synonyms with OR, concepts with AND, and exclude noise with NOT.'],
      ['Search the right databases', 'Choose subject databases and scholarly indexes, not just a general web search.'],
      ['Screen and refine', 'Scan titles and abstracts, then tighten keywords and filters based on what you find.'],
      ['Track and cite what you keep', 'Record the searches and save references as you go, so the work is reproducible.'],
    ],
    'Write one Boolean string for your topic using AND, OR and NOT, then name the database you would run it in.'],

  ['academic-writing', 'Academic Writing', 'communication-reflection', 'Structuring an Argument', ['argument-mapping', 'critical-analysis'],
    'Build a persuasive paper as a whole — from a clear thesis through a structured argument to a defensible conclusion.',
    [
      ['Frame the question', 'Open with the problem and why it matters, so the reader knows the stakes.'],
      ['State your thesis', 'Put your central claim up front — the one line the whole paper defends.'],
      ['Structure the argument', 'Order your points so each paragraph earns the next; one idea per paragraph.'],
      ['Draft with evidence', 'Support every claim, and make the link between evidence and point explicit.'],
      ['Revise for the reader', 'Cut what does not serve the thesis; fix the joins so the argument flows.'],
    ],
    'Write your thesis in one sentence, then list the paragraph topics in the order that best builds to it.'],

  ['peer-reviewing', 'Peer Reviewing', 'communication-reflection', null, ['critical-analysis', 'marking-feedback'],
    'Apply your critical thinking to someone else’s work and return feedback that is honest, specific and usable.',
    [
      ['Read for the writer’s intent', 'Understand what the piece is trying to do before you judge how well it does it.'],
      ['Name genuine strengths', 'Say what works and why — precise praise tells the writer what to keep.'],
      ['Locate the key weakness', 'Find the one change that would most improve the work, not a list of small ones.'],
      ['Give actionable feed-forward', 'Offer a next step the writer can act on, not just a verdict on this draft.'],
      ['Keep it constructive', 'Comment on the work, not the person, and a question often beats a correction.'],
    ],
    'Review a peer’s paragraph: one specific strength, one key weakness, one concrete next step. See the Marking & feedback activity for how an expert does it.'],

  ['oral-presentation', 'Oral Presentation & Communication', 'communication-reflection', null, ['presentation-storytelling', 'academic-writing'],
    'Structure complex information so a specific audience can follow it — live, in the time you have.',
    [
      ['Know your audience', 'Decide what they already know, so you can pitch the detail and the jargon right.'],
      ['Pick one core message', 'Choose the single thing they must remember; shape everything around it.'],
      ['Structure with signposts', 'Give a clear path — tell them where you are going, and mark each turn.'],
      ['Pitch the jargon level', 'Translate specialist terms for a mixed audience without dumbing down the ideas.'],
      ['Rehearse for time', 'Practise aloud and cut to fit — overrunning is a design failure, not bad luck.'],
    ],
    'State your talk’s one core message in a sentence, and the three signposts that get the audience there.'],

  ['synthesis', 'Synthesis of Diverse Fields', 'communication-reflection', 'Interdisciplinary synthesis', ['literature-reviewing', 'critical-analysis'],
    'Connect concepts from different fields to build a novel understanding or solution neither field reaches alone.',
    [
      ['Identify two domains', 'Name the two distinct fields you are bringing together (Domain A and Domain B).'],
      ['Find the bridge variable', 'Locate the common factor they share — optimisation, feedback, selection, scarcity.'],
      ['Map A onto B', 'Carry the core concepts of one domain into the framework of the other through that bridge.'],
      ['Generate novel hypotheses', 'Ask what the cross-over predicts that neither field alone would suggest.'],
      ['Test the fit', 'Check where the analogy holds and where it breaks — the break is often the insight.'],
    ],
    'Name two fields relevant to your topic and the one bridge variable between them, then one question the pairing raises.'],

  ['self-directed-learning', 'Self-Directed Learning', 'communication-reflection', null, ['reflective-practice', 'time-management'],
    'Diagnose your own knowledge gaps, find resources independently, and structure your own plan to close them.',
    [
      ['Map what you know', 'Lay out your current understanding honestly, including the fuzzy edges.'],
      ['Name the gap', 'Pinpoint what you need to learn and why it matters for the task ahead.'],
      ['Find the right resources', 'Choose credible, suitable sources — and judge them (see Source Evaluation).'],
      ['Make a learning plan', 'Set concrete goals and a realistic sequence, not just an intention to study.'],
      ['Check your progress', 'Test yourself against the goal and adjust the plan as you learn.'],
    ],
    'Write one gap you need to close this week, the resource you will use, and how you will know you have closed it.'],

  ['ethical-reasoning', 'Ethical Reasoning & Integrity', 'communication-reflection', 'Academic integrity', ['source-evaluation', 'reflective-practice'],
    'Recognise the moral stakes in how knowledge is produced and used — plagiarism, bias, authorship, consent.',
    [
      ['Spot the ethical stake', 'Notice where a choice has a moral dimension, not just a technical one.'],
      ['Name who is affected', 'Identify the people and groups your decision touches, including the unseen ones.'],
      ['Weigh the principles', 'Balance honesty, fairness, harm and respect — say which pull against each other here.'],
      ['Check your integrity', 'Attribute every source, declare bias and funding, and never present others’ work as your own.'],
      ['Decide and justify', 'Make the call and be able to defend it openly — transparency is the test.'],
    ],
    'Take one decision in your work (a source, a method, an authorship) and write the one-line justification you could defend in public.'],

  ['time-management', 'Time Management & Project Sequencing', 'communication-reflection', null, ['problem-decomposition', 'self-directed-learning'],
    'Turn a large module into timed, sequential milestones — with slack for when things go wrong.',
    [
      ['Break into milestones', 'Split the work into deliverable chunks with clear done conditions.'],
      ['Estimate each honestly', 'Guess the time each will really take, then be honest about your optimism.'],
      ['Sequence by dependency', 'Order milestones so nothing waits on work that has not started.'],
      ['Add contingency', 'Build in slack for the step that will slip — because one always does.'],
      ['Review and adjust', 'Check progress against the plan regularly and re-sequence as reality bites.'],
    ],
    'List your next three milestones with a date each, and mark which one everything else depends on.'],

  ['reflective-practice', 'Reflective Practice', 'communication-reflection', null, ['self-directed-learning', 'peer-reviewing'],
    'Pause after a task to turn raw experience into formalised, reusable learning — what worked, what failed, and why.',
    [
      ['Describe what happened', 'Set down the events plainly, without judging them yet.'],
      ['Examine what worked and failed', 'Separate the parts that went well from the parts that did not.'],
      ['Ask why', 'Dig past the symptom to the cause — reflection is diagnosis, not a diary.'],
      ['Extract the lesson', 'State the general principle you will carry to the next, different task.'],
      ['Plan the change', 'Commit to one concrete thing you will do differently, and when.'],
    ],
    'Write one thing that worked, one that did not, the reason behind the second, and the single change you will make next time.'],

  ['active-listening', 'Active Listening (in lectures)', 'communication-reflection', null, ['critical-analysis', 'self-directed-learning'],
    'Stop transcribing and start listening for structure: catch the lecturer’s shape, emphasis and open questions.',
    [
      ['Catch the structure', 'Listen for how the talk is organised — the argument, not the sentences.'],
      ['Mark the emphasis', 'Note what the lecturer stresses, repeats or signposts as important.'],
      ['Note the open questions', 'Write down what is left unresolved — those are your prompts to follow up.'],
      ['Capture meaning, not words', 'Record ideas and links in your own words; verbatim notes crowd out thinking.'],
      ['Review and fill gaps', 'Soon after, revisit the notes and close the gaps while the talk is fresh.'],
    ],
    'In your next lecture, write only the structure and three emphasis points — then one question the lecturer left open.'],

  ['presentation-storytelling', 'Presentation Storytelling', 'communication-reflection', null, ['oral-presentation', 'data-interpretation'],
    'Structure data as an unfolding narrative — beginning, tension, and resolution — not a list of facts.',
    [
      ['Set the scene', 'Open with the situation and why the audience should care about it.'],
      ['Introduce the tension', 'Name the problem or surprise — the gap that creates the need to know.'],
      ['Build through the data', 'Reveal the evidence as a rising path toward the answer, one step at a time.'],
      ['Reach the resolution', 'Deliver the finding as the pay-off the tension has been building to.'],
      ['Land the so-what', 'Close on what it means and what should change — the reason it mattered.'],
    ],
    'Reshape one result as a three-beat story: situation, problem, finding. If there is no tension, there is no story.'],
];

const outDir = __dirname;
const docsDir = path.resolve(__dirname, '../../../../.dev/docs');

function pack(row) {
  const [id, title, group, altLabel, related, statement, steps, ff] = row;
  const p = {
    version: 1,
    id,
    title,
    uri: BASE + id,
    broader: group,
    process: group,
    pattern: 'sequential-process',
    intent: 'formative · ' + GROUPS[group] + ' · click through the process',
    statement,
    advance: 'click',
    stage: { type: 'process' },
    steps: steps.map(([t, x]) => ({ title: t, text: x })),
    feedForward: { badge: 'Try it', text: ff },
  };
  if (altLabel) p.altLabel = altLabel;
  if (related && related.length) p.related = related;
  return p;
}

// --- write packs ---
const manifest = [];
for (const row of P) {
  const p = pack(row);
  fs.writeFileSync(path.join(outDir, p.id + '.json'), JSON.stringify(p, null, 2) + '\n');
  manifest.push({ id: p.id, title: p.title, group: p.broader, altLabel: p.altLabel || null, related: p.related || [] });
}
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({ groups: GROUPS, processes: manifest }, null, 2) + '\n');

// --- write SKOS JSON-LD ---
const skos = {
  '@context': { skos: 'http://www.w3.org/2004/02/skos/core#', grow: BASE, ProcessSteps: 'grow:ProcessSteps', step_title: 'grow:stepTitle', description: 'grow:stepDescription', steps: 'grow:steps' },
  '@graph': [],
};
skos['@graph'].push({ '@id': 'grow:scheme/academic-processes', '@type': 'skos:ConceptScheme', 'skos:prefLabel': 'Universal Undergraduate Academic Processes' });
for (const [slug, label] of Object.entries(GROUPS)) {
  skos['@graph'].push({ '@id': BASE + slug, '@type': 'skos:Concept', 'skos:prefLabel': label, 'skos:inScheme': { '@id': 'grow:scheme/academic-processes' } });
}
for (const row of P) {
  const [id, title, group, altLabel, related, statement, steps] = row;
  const node = {
    '@id': BASE + id,
    '@type': 'skos:Concept',
    'skos:prefLabel': title,
    'skos:scopeNote': statement,
    'skos:inScheme': { '@id': 'grow:scheme/academic-processes' },
    'skos:broader': { '@id': BASE + group },
    'skos:definition': { '@type': 'ProcessSteps', steps: steps.map(([t, x], i) => ({ '@id': BASE + id + '#step' + (i + 1), step_title: t, description: x })) },
  };
  if (altLabel) node['skos:altLabel'] = altLabel;
  if (related && related.length) node['skos:related'] = related.map(r => ({ '@id': (r.includes('/') ? r : BASE + r) }));
  skos['@graph'].push(node);
}
fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(path.join(docsDir, 'academic-processes.skos.jsonld'), JSON.stringify(skos, null, 2) + '\n');

console.log('Wrote ' + P.length + ' process packs + manifest.json to ' + outDir);
console.log('Wrote SKOS JSON-LD to ' + path.join(docsDir, 'academic-processes.skos.jsonld'));
