// Context packs: render a data-defined, step-animated annotated walkthrough.
// A pack = a statement + a stage (annotated-prose | checklist | assembly) whose
// marks reveal one step at a time, click-advanced. Marks reuse the
// animation-manager draw-on engine and semantic colour roles, so they take any
// theme colour. UMD: window.ContextPack (browser) / require (Node, for validate).
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.ContextPack = value;
}(typeof self !== 'undefined' ? self : this, function () {

  // Marker-pen marks. Over-text marks sit on a word; glyph marks stamp beside it.
  // ? and ! carry a filled .am-dot that pops in after the stroke draws.
  const MARKS = {
    underline: { over: true, pos: 'u', vb: '0 0 200 12', inner: '<path class="am-ink" pathLength="1" d="M4 7 C 60 1,120 11,196 6"/>' },
    wavy: { over: true, pos: 'wav', vb: '0 0 200 16', inner: '<path class="am-ink" pathLength="1" d="M4 9 q 14 -8 28 0 t 28 0 t 28 0 t 28 0 t 28 0 t 28 0"/>' },
    oval: { over: true, pos: 'ov', vb: '0 0 200 70', inner: '<path class="am-ink" pathLength="1" style="stroke-width:3" d="M152 14 C 60 2,10 20,18 44 C 26 68,140 70,182 52 C 214 40,204 15,150 11"/>' },
    box: { over: true, pos: 'box', vb: '0 0 200 64', inner: '<path class="am-ink" pathLength="1" style="stroke-width:3" d="M9 9 L192 6 L195 55 L6 58 Z"/>' },
    strike: { over: true, pos: 'str', vb: '0 0 200 14', inner: '<path class="am-ink" pathLength="1" d="M4 8 C 60 3,120 12,196 7"/>' },
    scribble: { over: true, pos: 'scr', vb: '0 0 200 40', inner: '<path class="am-ink" pathLength="1" style="stroke-width:5" d="M6 24 L36 10 L66 26 L96 10 L126 26 L156 11 L192 22 M186 13 L150 29 L116 14 L84 28 L52 14 L12 27"/>' },
    tick: { glyph: true, vb: '0 0 52 52', inner: '<path class="am-ink" pathLength="1" style="stroke-width:7" d="M9 27 C 14 32,18 37,21 40 C 29 28,37 17,45 10"/>' },
    cross: { glyph: true, vb: '0 0 52 52', inner: '<path class="am-ink" pathLength="1" style="--am-d:0s;stroke-width:7" d="M12 12 C 22 22,32 32,40 40"/><path class="am-ink" pathLength="1" style="--am-d:.2s;stroke-width:7" d="M40 12 C 30 22,20 32,12 40"/>' },
    question: { glyph: true, vb: '0 0 52 62', inner: '<path class="am-ink" pathLength="1" style="stroke-width:7" d="M14 20 C 12 7,42 6,41 20 C 40 30,27 29,26 39"/><circle class="am-dot" cx="26" cy="52" r="4.2"/>' },
    // stem leans ~2 units so its bbox has width — a perfectly vertical path has a
    // zero-width bbox, which collapses the objectBoundingBox ink-filter region and
    // renders nothing. The lean also reads as hand-drawn.
    exclaim: { glyph: true, vb: '0 0 52 62', inner: '<path class="am-ink" pathLength="1" style="stroke-width:7" d="M27 9 C 26 20,26 31,25 41"/><circle class="am-dot" cx="25" cy="52" r="4.2"/>' },
    star: { glyph: true, vb: '0 0 54 54', inner: '<path class="am-ink" pathLength="1" style="stroke-width:4" d="M27 5 L34 22 L52 22 L37 33 L43 50 L27 39 L11 50 L17 33 L2 22 L20 22 Z"/>' },
    caret: { glyph: true, vb: '0 0 48 34', inner: '<path class="am-ink" pathLength="1" style="stroke-width:6" d="M6 28 L24 6 L42 28"/>' },
  };
  const ROLES = ['accent', 'positive', 'negative', 'neutral', 'comment', 'pen', 'ink'];

  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const role = r => (ROLES.includes(r) ? r : 'accent');

  function ensureFilter(doc) {
    doc = doc || document;
    if (doc.querySelector('#am-ink')) return;
    const holder = doc.createElement('div');
    holder.innerHTML = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="am-ink" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2"/></filter></svg>';
    doc.body.append(holder.firstChild);
  }

  const glyphSvg = m => `<svg viewBox="${m.vb}">${m.inner}</svg>`;

  // ---- stage builders -----------------------------------------------------
  function proseStage(stage) {
    const notes = [];
    let auto = 0;
    const body = (stage.segments || []).map(seg => {
      if (seg.mark == null && seg.note == null && seg.correction == null && seg.id == null && seg.step == null) return esc(seg.text);
      const id = seg.id || (seg.note ? `cp-anchor-${++auto}` : '');
      const idAttr = id ? ` id="${esc(id)}"` : '';
      const step = seg.step != null ? seg.step : 0;
      const col = role(seg.mark && seg.mark.color || seg.color);
      const m = seg.mark && MARKS[seg.mark.kind];
      if (seg.note) notes.push({ text: seg.note, anchor: id, step, color: seg.noteColor });
      if (m && m.over) {
        let html = `<span${idAttr} class="am-item am-mk pos-${m.pos} cp-ovl" data-step="${step}" style="color:var(--am-c-${col})">${esc(seg.text)}<svg viewBox="${m.vb}" preserveAspectRatio="none">${m.inner}</svg></span>`;
        if (seg.correction) html = `<span class="cp-corrw">${html}<span class="cp-corr-over am-item cp-fade" data-step="${step}">${esc(seg.correction)}</span></span>`;
        return html;
      }
      if (m && m.glyph) {
        return `<span${idAttr}>${esc(seg.text)}</span> <span class="am-item am-glyph cp-ovl" data-step="${step}" style="color:var(--am-c-${col});display:inline-block;width:1.2em;height:1.2em;vertical-align:-.22em">${glyphSvg(m)}</span>`;
      }
      return `<span${idAttr}>${esc(seg.text)}</span>`;
    }).join('');
    const noteEls = notes.map(n =>
      `<div class="cp-note" data-step="${n.step}"${n.anchor ? ` data-anchor="#${esc(n.anchor)}"` : ''}${n.color ? ` style="color:var(--am-c-${role(n.color)})"` : ''}>${esc(n.text)}</div>`).join('');
    return `<div class="cp-grid"><div class="cp-paper"><p class="cp-prose">${body}</p>{{FF}}</div>${noteEls}<svg class="cp-conn" aria-hidden="true"></svg></div>`;
  }

  function checklistStage(stage) {
    const src = stage.source
      ? `<div class="cp-src cp-fade" data-step="0"><div class="cp-src-k">${esc(stage.source.kicker || 'Under review')}</div><div class="cp-src-t">${esc(stage.source.title || '')}</div>${stage.source.meta ? `<div class="cp-src-m">${esc(stage.source.meta)}</div>` : ''}</div>` : '';
    const rows = (stage.items || []).map(it => {
      const m = MARKS[it.mark && it.mark.kind] || MARKS.tick;
      const col = role(it.mark && it.mark.color);
      return `<li class="cp-crow cp-fade" data-step="${it.step != null ? it.step : 0}"><span class="cp-letter">${esc(it.letter || '')}</span>` +
        `<div><b>${esc(it.label || '')}</b>${it.question ? ` — ${esc(it.question)}` : ''}${it.verdict ? `<div class="cp-q">${esc(it.verdict)}</div>` : ''}</div>` +
        `<span class="cp-stamp am-item" style="color:var(--am-c-${col})">${glyphSvg(m)}</span></li>`;
    }).join('');
    return `${src}<ul class="cp-checklist">${rows}</ul>{{FF}}`;
  }

  function assemblyStage(stage) {
    const intro = stage.intro ? `<div class="cp-rulebox cp-fade" data-step="0">${stage.intro}</div>` : '';
    const parts = (stage.parts || []).map(p => {
      const step = p.step != null ? p.step : 0;
      const m = p.mark && MARKS[p.mark.kind];
      const text = p.html != null ? p.html : esc(p.text || '');
      if (m && m.glyph) return `<span class="am-item am-glyph cp-ovl" data-step="${step}" style="color:var(--am-c-${role(p.mark.color)});display:inline-block;width:1.3em;height:1.3em;vertical-align:-.26em;margin-left:.3em">${glyphSvg(m)}</span>`;
      return `<span class="cp-part cp-fade" data-step="${step}">${text}</span>`;
    }).join('');
    return `${intro}<div class="cp-assembly">${parts}</div>{{FF}}`;
  }

  // A process is an ordered list of moves (the SKOS ProcessSteps model): each
  // pack step becomes a numbered card, revealed one at a time; the caption bar
  // carries the "why" for the current move.
  function processStage(pack) {
    const cards = (pack.steps || []).map((s, i) =>
      `<li class="cp-pstep" data-step="${i}"><span class="cp-pnum">${i + 1}</span><span class="cp-ptext"><b>${esc(s.title || '')}</b></span></li>`).join('');
    return `<ol class="cp-process">${cards}</ol>{{FF}}`;
  }

  function stageHtml(pack) {
    const s = pack.stage || {};
    const inner = s.type === 'checklist' ? checklistStage(s)
      : s.type === 'assembly' ? assemblyStage(s)
        : s.type === 'process' ? processStage(pack)
          : proseStage(s);
    const step = pack.feedForward && pack.feedForward.step != null ? pack.feedForward.step : Math.max(0, stepCount(pack) - 1);
    const ff = pack.feedForward
      ? `<div class="cp-ff cp-fade" data-step="${step}"><span class="cp-ff-badge">${esc(pack.feedForward.badge || 'Feed-forward')}</span>${esc(pack.feedForward.text)}</div>`
      : '';
    // proseStage carries {{FF}} inside the paper; others carry it at the end.
    return inner.replace('{{FF}}', ff);
  }

  function stepCount(pack) { return (pack.steps || []).length; }

  // ---- render -------------------------------------------------------------
  function render(container, pack, opts = {}) {
    const doc = container.ownerDocument || document;
    ensureFilter(doc);
    container.classList.add('cp-root');
    const steps = pack.steps || [];
    const controls = opts.controls !== false;
    container.innerHTML =
      (pack.statement ? `<p class="cp-statement">${esc(pack.statement)}</p>` : '') +
      (pack.intent ? `<p class="cp-intent">${pack.intent}</p>` : '') +
      `<div class="cp-stage">${stageHtml(pack)}</div>` +
      `<div class="cp-caption"><h3 data-cap-title></h3><p data-cap-text></p></div>` +
      (controls ? `<div class="cp-controls">
        <button class="cp-btn" data-act="back">‹ Back</button>
        <button class="cp-btn cp-primary" data-act="next">Next ›</button>
        <button class="cp-btn" data-act="replay">↻ Replay</button>
        <div class="cp-dots" role="group" aria-label="Steps">${steps.map((_, k) => `<button class="cp-dot" data-dot="${k}" aria-label="Step ${k + 1}"></button>`).join('')}</div>
      </div>` : '');

    const els = [...container.querySelectorAll('[data-step]')];
    const q = s => container.querySelector(s);
    let i = 0, timer = null;
    const abort = new AbortController();
    const max = Math.max(0, steps.length - 1);

    function goTo(n) {
      i = Math.max(0, Math.min(max, n));
      els.forEach(el => {
        const d = Number(el.dataset.step);
        el.classList.toggle('cp-vis', d <= i);
        el.classList.toggle('cp-draw', d === i);
        if (el.classList.contains('cp-part')) el.classList.toggle('cp-cur', d === i);
      });
      const step = steps[i] || {};
      if (q('[data-cap-title]')) q('[data-cap-title]').textContent = step.title || '';
      if (q('[data-cap-text]')) q('[data-cap-text]').textContent = step.text || '';
      container.querySelectorAll('.cp-dot').forEach((d, k) => d.setAttribute('aria-current', String(k === i)));
      if (q('[data-act="back"]')) q('[data-act="back"]').disabled = i === 0;
      if (q('[data-act="next"]')) q('[data-act="next"]').disabled = i === max;
      layoutConn();
      if (opts.onStep) opts.onStep(i, max);   // lets a host (e.g. the custom element) emit step/complete
    }
    function layoutConn() {
      const grid = container.querySelector('.cp-grid'); if (!grid) return;
      const conn = grid.querySelector('.cp-conn'); if (!conn) return;
      const paper = grid.querySelector('.cp-paper');
      const view = doc.defaultView || window;
      const notes = [...grid.querySelectorAll('.cp-note')];
      const gb = grid.getBoundingClientRect();
      // small screens: notes flow under the paper (CSS); no absolute placement
      if (view.innerWidth <= 640 || !paper) {
        notes.forEach(n => { n.style.left = ''; n.style.top = ''; });
        conn.innerHTML = '';
        return;
      }
      const pr = paper.getBoundingClientRect();
      const left = (pr.right - gb.left) - 36;          // overlap the paper edge, then sit off it
      const vis = notes.filter(n => n.classList.contains('cp-vis')).map(note => {
        const a = note.dataset.anchor && grid.querySelector(note.dataset.anchor);
        const ar = a ? a.getBoundingClientRect() : null;
        return { note, ar, ay: ar ? ar.top + ar.height / 2 - gb.top : 0 };
      }).sort((p, q) => p.ay - q.ay);
      let cursor = 0;                                   // stack top-down so notes never overlap
      vis.forEach(item => {
        item.note.style.left = left + 'px';
        const h = item.note.offsetHeight || 40;
        const top = Math.max(item.ay - h / 2, cursor);
        item.note.style.top = top + 'px';
        cursor = top + h + 10;
      });
      const fullH = Math.max(gb.height, cursor);         // grow the area if notes stack past the paper
      grid.style.minHeight = fullH + 'px';
      let paths = '';
      vis.forEach(item => {
        if (!item.ar) return;
        const x1 = item.ar.right - gb.left, y1 = item.ar.top + item.ar.height / 2 - gb.top;
        const x2 = item.note.offsetLeft, y2 = item.note.offsetTop + item.note.offsetHeight / 2;
        const mx = (x1 + x2) / 2;
        paths += `<path d="M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}" fill="none" stroke="var(--am-c-pen,#b23b3b)" stroke-opacity=".55" stroke-width="1.5" stroke-dasharray="2 5"/>`;
      });
      conn.setAttribute('viewBox', `0 0 ${gb.width} ${fullH}`);
      conn.setAttribute('width', gb.width); conn.setAttribute('height', fullH);
      conn.innerHTML = paths;
    }
    function stopPlay() { if (timer) { clearInterval(timer); timer = null; const b = q('[data-act="play"]'); if (b) b.textContent = '▶ Auto-play'; } }
    function play() { stopPlay(); if (i === max) goTo(0); timer = setInterval(() => { if (i >= max) return stopPlay(); goTo(i + 1); }, opts.autoMs || 2800); }

    if (controls) container.querySelector('.cp-controls').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.dot != null) return goTo(Number(b.dataset.dot));
      if (b.dataset.act === 'back') goTo(i - 1);
      else if (b.dataset.act === 'next') goTo(i + 1);
      else if (b.dataset.act === 'replay') goTo(0);
    }, { signal: abort.signal });
    container.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') goTo(i + 1); else if (e.key === 'ArrowLeft') goTo(i - 1);
    }, { signal: abort.signal });
    const onResize = () => layoutConn();
    (doc.defaultView || window).addEventListener('resize', onResize, { signal: abort.signal });

    goTo(0);
    if ((pack.advance === 'auto') || opts.advance === 'auto') play();

    return {
      goTo, next: () => goTo(i + 1), back: () => goTo(i - 1), replay: () => goTo(0), play, stop: stopPlay,
      step: () => i, stepCount: steps.length,
      destroy() { stopPlay(); abort.abort(); container.replaceChildren(); container.classList.remove('cp-root'); },
    };
  }

  function launchModal(pack, opts = {}) {
    const doc = document;
    ensureFilter(doc);
    const dlg = doc.createElement('dialog');
    dlg.className = 'cp-modal cp-root';
    dlg.innerHTML = `<div class="cp-modal-head"><h2>${esc(pack.title || 'Walkthrough')}</h2><button class="cp-close" data-close>Close ✕</button></div><div class="cp-modal-body"></div>`;
    doc.body.append(dlg);
    const api = render(dlg.querySelector('.cp-modal-body'), pack, opts);
    dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
    dlg.addEventListener('close', () => { api.destroy(); dlg.remove(); });
    dlg.showModal();
    return { dialog: dlg, api };
  }

  function renderAccordion(container, pack, opts = {}) {
    const details = (container.ownerDocument || document).createElement('details');
    details.className = 'cp-acc';
    details.innerHTML = `<summary>${esc(pack.title || 'Walkthrough')}</summary><div class="cp-acc-body"></div>`;
    container.append(details);
    let api = null;
    details.addEventListener('toggle', () => {
      if (details.open && !api) api = render(details.querySelector('.cp-acc-body'), pack, opts);
    });
    return details;
  }

  function validate(pack) {
    const errors = [], warnings = [];
    if (!pack || typeof pack !== 'object') return { valid: false, errors: ['Pack must be an object.'], warnings };
    if (pack.version !== 1) warnings.push('version should be 1.');
    if (!pack.id) errors.push('Missing id.');
    if (!pack.title) errors.push('Missing title.');
    if (!pack.stage || typeof pack.stage !== 'object') errors.push('Missing stage.');
    const type = pack.stage && pack.stage.type;
    if (type && !['annotated-prose', 'checklist', 'assembly', 'process'].includes(type)) errors.push(`Unknown stage type "${type}".`);
    if (!Array.isArray(pack.steps) || pack.steps.length < 1) errors.push('steps must be a non-empty array.');
    const maxStep = (pack.steps || []).length - 1;
    const checkStep = (s, where) => { if (s != null && (s < 0 || s > maxStep)) errors.push(`${where}: step ${s} is out of range 0..${maxStep}.`); };
    const checkMark = (m, where) => {
      if (!m) return;
      if (!MARKS[m.kind]) errors.push(`${where}: unknown mark kind "${m.kind}".`);
      if (m.color && !ROLES.includes(m.color)) warnings.push(`${where}: unknown colour "${m.color}".`);
    };
    const s = pack.stage || {};
    (s.segments || []).forEach((seg, k) => { checkStep(seg.step, `segment ${k}`); checkMark(seg.mark, `segment ${k}`); if (seg.note && !seg.id) warnings.push(`segment ${k}: a note needs an id to anchor to.`); });
    (s.items || []).forEach((it, k) => { checkStep(it.step, `item ${k}`); checkMark(it.mark, `item ${k}`); });
    (s.parts || []).forEach((p, k) => { checkStep(p.step, `part ${k}`); checkMark(p.mark, `part ${k}`); });
    if (pack.feedForward) checkStep(pack.feedForward.step, 'feedForward');
    return { valid: errors.length === 0, errors, warnings };
  }

  return { render, launchModal, renderAccordion, validate, MARKS, ROLES, ensureFilter };
}));

// ---- custom element: <context-pack> --------------------------------------
// Self-registering wrapper around the renderer above. Takes its pack three ways:
//   1. the `.pack` property (an object)  — the route an Adapt view will use;
//   2. an inline  <script type="application/json"> child;
//   3. a `src="…json"` attribute (fetched).
// Attributes: launch="inline|modal|accordion", advance="click|auto",
//   auto-ms, controls="false", heading, trigger-label.
// Events (bubble + composed): context-pack:ready, :step, :complete.
// On reaching the last step it adds the `is-complete` class and a `data-complete`
// attribute and fires :complete — the hooks an Adapt component uses to set
// completion. Imperative API: .pack, .open(), .replay(), .goTo(n), .completed.
(function () {
  if (typeof window === 'undefined' || !window.customElements) return;
  if (customElements.get('context-pack')) return;
  // window.ContextPack in a plain <script>; module.exports when bundled (webpack/Adapt).
  const CP = window.ContextPack || (typeof module === 'object' && module.exports) || null;
  if (!CP) return;

  const escText = m => String(m).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const readInline = el => {
    const s = el.querySelector(':scope > script[type="application/json"]');
    if (!s) return null;
    try { return JSON.parse(s.textContent); } catch (e) { return null; }
  };

  class ContextPackElement extends HTMLElement {
    static get observedAttributes() { return ['src', 'launch', 'advance', 'auto-ms', 'controls', 'heading', 'trigger-label']; }
    constructor() { super(); this._api = null; this._pack = null; this._resolved = null; this._completed = false; this._mounted = false; }

    get pack() { return this._resolved; }
    set pack(v) { this._pack = (v && typeof v === 'object') ? v : null; if (this.isConnected) this._boot(); }
    get completed() { return this._completed; }

    connectedCallback() {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => this._boot(), { once: true });
      else this._boot();
    }
    disconnectedCallback() { this._teardown(); this._mounted = false; }
    attributeChangedCallback() { if (this._mounted) this._boot(); }

    async _resolvePack() {
      if (this._pack) return this._pack;
      const inline = readInline(this);
      if (inline) return inline;
      const src = this.getAttribute('src');
      if (src) {
        const res = await fetch(src);
        if (!res.ok) throw new Error('could not load ' + src + ' (' + res.status + ')');
        return res.json();
      }
      return null;
    }

    _opts(onStep) {
      return {
        advance: this.getAttribute('advance') === 'auto' ? 'auto' : 'click',
        controls: this.getAttribute('controls') !== 'false',
        autoMs: Number(this.getAttribute('auto-ms')) || undefined,
        onStep,
      };
    }
    _emit(name, detail) { this.dispatchEvent(new CustomEvent('context-pack:' + name, { bubbles: true, composed: true, detail })); }
    _onStep(pack) {
      return (i, max) => {
        this._emit('step', { step: i, stepCount: max + 1 });
        if (i >= max && !this._completed) {
          this._completed = true; this.classList.add('is-complete'); this.setAttribute('data-complete', '');
          this._emit('complete', { pack });
        }
      };
    }

    async _boot() {
      this._teardown();
      this._completed = false; this.classList.remove('is-complete'); this.removeAttribute('data-complete');
      let pack;
      try { pack = await this._resolvePack(); }
      catch (e) { return this._error(e.message); }
      if (!this.isConnected) return;
      if (!pack) return this._error('no pack — set src, the .pack property, or an inline JSON <script>.');
      const report = CP.validate(pack);
      if (!report.valid) return this._error('invalid pack — ' + report.errors.join('; '));
      this._resolved = pack; this._mounted = true;
      const launch = this.getAttribute('launch') || 'inline';
      const heading = this.getAttribute('heading') || pack.title || 'Walkthrough';
      CP.ensureFilter(document);
      this.innerHTML = '';
      if (launch === 'modal') {
        const btn = document.createElement('button');
        btn.className = 'cp-btn cp-primary'; btn.type = 'button';
        btn.textContent = this.getAttribute('trigger-label') || ('Launch — ' + heading);
        btn.addEventListener('click', () => this.open());
        this.append(btn);
        this._emit('ready', { pack, mode: 'modal' });
      } else if (launch === 'accordion') {
        CP.renderAccordion(this, Object.assign({}, pack, { title: heading }), this._opts(this._onStep(pack)));
        this._emit('ready', { pack, mode: 'accordion' });
      } else {
        const host = document.createElement('div');
        this.append(host);
        this._api = CP.render(host, pack, this._opts(this._onStep(pack)));
        this._emit('ready', { pack, mode: 'inline', stepCount: this._api.stepCount });
      }
    }

    open() {
      const pack = this._resolved; if (!pack) return null;
      const heading = this.getAttribute('heading') || pack.title;
      const launched = CP.launchModal(Object.assign({}, pack, { title: heading }), this._opts(this._onStep(pack)));
      this._api = launched.api;
      this._emit('open', { pack });
      return launched;
    }
    replay() { if (this._api) this._api.replay(); }
    goTo(n) { if (this._api) this._api.goTo(n); }

    _teardown() { if (this._api && this._api.destroy) { try { this._api.destroy(); } catch (e) {} } this._api = null; }
    _error(msg) { this.innerHTML = '<p class="cp-cmp-error">context-pack: ' + escText(msg) + '</p>'; this._emit('error', { message: msg }); }
  }

  customElements.define('context-pack', ContextPackElement);
  CP.Element = ContextPackElement;
})();
