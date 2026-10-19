import { notifications } from '../notifications/notification-service.js';
import { mountNotificationBar } from '../notifications/notification-bar.js';
import {
  CATALOG, COLOR_ROLES, findAnimation,
  validateSettings, defaultSettings, defaultOptions,
  instanceMarkup, exportSnippet, baseCss, INK_FILTER_SVG, FONTS_HREF,
} from './animation-manager-engine.js';

let instances = 0;
const roleLabel = id => (COLOR_ROLES.find(([value]) => value === id) ?? [id, id])[1];
const catLabel = id => ({
  emphasis: 'Emphasis on words', highlighter: 'Highlighters', standalone: 'Ticks, arrows, stars',
  shapes: 'Arrows, shapes & lines', ovals: 'Ovals & rectangles', notes: 'Handwritten notes',
}[id] ?? id);
const symbol = name => `<span class="am-symbol" aria-hidden="true">${name}</span>`;
const options = entries => entries.map(([value, name]) => `<option value="${value}">${name}</option>`).join('');
const range = (key, title, min, max, step, unit = '') =>
  `<label>${title}<output data-value="${key}"></output><input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" data-unit="${unit}"></label>`;

export function mountAnimationManager(host, {
  target,
  initialSettings = {},
  storageKey = `grow-animation-manager:${location.pathname}`,
  notificationService = notifications,
  onChange = () => {},
} = {}) {
  if (!(target instanceof HTMLElement) || target.contains(host) || host.contains(target)) {
    throw new Error('Animation manager needs a separate page target; mount the overlay outside it.');
  }
  if (host.dataset.amMounted !== undefined) throw new Error('This animation manager host is already mounted.');

  const id = `am-${++instances}`;
  const abort = new AbortController();
  let state = validateSettings({ ...defaultSettings(), ...initialSettings });
  let active = null, destroyed = false, storageError = null, deckAnimation = null;
  const injected = [];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const notify = (message, level = 'info') => notificationService.publish({ source: 'Animation manager', message, level });

  if (storageKey) {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) state = validateSettings(JSON.parse(saved));
    } catch (error) { storageError = `Saved settings could not be restored: ${error.message}`; }
  }

  host.dataset.amMounted = '';
  host.classList.add('am-manager');

  // Page-level assets: the ink filter, the handwriting fonts, and the base
  // stylesheet every injected mark (and the preview) relies on.
  const style = document.createElement('style');
  style.textContent = baseCss();
  const fonts = document.createElement('link');
  fonts.rel = 'stylesheet';
  fonts.href = FONTS_HREF;
  const filter = document.createElement('div');
  filter.innerHTML = INK_FILTER_SVG;
  const filterNode = filter.firstElementChild;
  document.head.append(style, fonts);
  if (!document.querySelector('[data-am-filter]')) document.body.append(filterNode);

  const galleryCells = CATALOG.map(entry =>
    `<button type="button" class="am-cell" data-select="${entry.id}" title="${entry.name} — ${entry.keywords.join(', ')}" data-cat="${entry.category}" data-terms="${(entry.name + ' ' + entry.keywords.join(' ')).toLowerCase()}">
      <span class="am-cell-stage">${instanceMarkup(entry, { ...defaultOptions(entry), play: false })}</span>
      <span class="am-cell-name">${entry.name}</span>
    </button>`).join('');

  host.innerHTML = `
    <div class="am-rail" role="group" aria-label="Animation manager controls">
      <div class="am-buttons">
        <button type="button" class="am-icon" data-action="notifications" aria-label="Notifications" title="Notifications" aria-pressed="true">${symbol('notifications')}</button>
        <button type="button" class="am-icon" data-panel="gallery" aria-label="Animation gallery" title="Gallery" aria-controls="${id}-gallery" aria-expanded="false">${symbol('grid_view')}</button>
      </div>
      <output class="am-meter" data-meter aria-label="Selected animation"></output>
      <div class="am-buttons">
        <button type="button" class="am-icon" data-panel="adjust" aria-label="Adjust" title="Speed, size, rotation, colour" aria-controls="${id}-adjust" aria-expanded="false">${symbol('tune')}</button>
        <button type="button" class="am-icon" data-panel="inject" aria-label="Insert into page" title="Insert into page" aria-controls="${id}-inject" aria-expanded="false">${symbol('ads_click')}</button>
      </div>
    </div>
    <div data-notifications></div>
    <div class="am-deck" hidden>
      <div class="am-deck-top">
        <label class="am-check"><input type="checkbox" data-key="applied"> Draw-on animation</label>
        <div class="am-buttons">
          <button type="button" class="am-icon" data-action="replay" aria-label="Replay preview" title="Replay preview">${symbol('replay')}</button>
          <button type="button" class="am-icon" data-action="copy" aria-label="Copy mark HTML" title="Copy mark HTML">${symbol('content_copy')}</button>
          <button type="button" class="am-icon" data-action="export" aria-label="Export JSON" title="Export JSON">${symbol('data_object')}</button>
          <button type="button" class="am-icon" data-action="css" aria-label="Export CSS snippet" title="Export CSS snippet">${symbol('css')}</button>
          <button type="button" class="am-icon" data-action="reset" aria-label="Reset" title="Reset">${symbol('restart_alt')}</button>
          <button type="button" class="am-icon" data-action="close" aria-label="Close" title="Close">${symbol('close')}</button>
        </div>
      </div>
      <p class="am-status" role="status" data-status></p>
      <div class="am-card-layout">
        <div class="am-controls">
          <section id="${id}-gallery" data-card="gallery" aria-label="Animation gallery" hidden>
            <h2>Pick an animation</h2>
            <p>Every note-taking mark extracted from the gallery, each a self-contained, re-colourable unit. Click one to tune and insert it.</p>
            <div class="am-gallery-filter">
              <label class="am-search">${symbol('search')}<input type="search" data-search placeholder="Search marks or keywords" aria-label="Search animations"></label>
              <label>Category<select data-cat-filter><option value="">All categories</option>${options([...new Set(CATALOG.map(e => e.category))].map(c => [c, catLabel(c)]))}</select></label>
            </div>
            <div class="am-gallery" data-gallery>${galleryCells}</div>
          </section>
          <section id="${id}-adjust" data-card="adjust" aria-label="Adjust animation" hidden>
            <h2>Adjust <span data-sel-name></span></h2>
            <p>Speed, size and rotation apply as inline custom properties; colour is a semantic theme role, so the mark follows the page theme.</p>
            <div class="am-grid">
              ${range('speed', 'Speed', 0.4, 2.5, 0.1, '×')}
              ${range('scale', 'Size', 0.3, 3, 0.05, '×')}
              ${range('rotation', 'Rotation', -45, 45, 1, '°')}
              ${range('repeats', 'Draw passes', 1, 10, 1)}
              ${range('jitter', 'Random rotation ±', 0, 10, 0.5, '°')}
              <label>Colour role<select data-key="color">${options(COLOR_ROLES)}</select></label>
            </div>
            <p>Draw passes replay the whole mark, with a short hold between passes. Random rotation adds a small, non-cumulative tilt around your chosen rotation. Set it to 0° for identical passes. Replay generates fresh tilts.</p>
            <fieldset data-band hidden><legend>Highlighter band</legend><div class="am-grid">
              ${range('band.top', 'Top', 20, 70, 1, '%')}
              ${range('band.height', 'Height', 12, 64, 1, '%')}
              ${range('band.pad', 'Length pad', 0.02, 0.6, 0.01, 'em')}
            </div></fieldset>
            <label data-text-field>Preview text<input type="text" data-text placeholder="Type the word to mark"></label>
            <label data-over-field hidden>Replacement word<input type="text" data-over placeholder="Correction"></label>
          </section>
          <section id="${id}-inject" data-card="inject" aria-label="Insert into page" hidden>
            <h2>Insert into the page</h2>
            <p>Marks are placed into your page target with the current settings. For word marks, select text first; for ticks and arrows, place one at the caret.</p>
            <div class="am-inject-actions">
              <button type="button" data-action="wrap">${symbol('format_ink_highlighter')} Wrap selection</button>
              <button type="button" data-action="insert">${symbol('add')} Insert at caret</button>
            </div>
            <fieldset><legend>By keyword (for agents too)</legend>
              <div class="am-grid">
                <label>Keyword<input type="text" data-keyword placeholder="e.g. horizon"></label>
                <label>Scope<select data-keyword-all><option value="true">All occurrences</option><option value="false">First occurrence</option></select></label>
              </div>
              <label>Target selector<input type="text" data-root placeholder="defaults to the page target"></label>
              <button type="button" data-action="keyword">${symbol('search')} Mark keyword</button>
            </fieldset>
            <div class="am-injected">
              <div class="am-deck-top"><strong data-injected-count>No marks inserted</strong>
                <div class="am-buttons"><button type="button" data-action="undo">${symbol('undo')} Undo last</button><button type="button" data-action="clear">${symbol('delete')} Clear all</button></div>
              </div>
            </div>
            <p class="am-agent-note">Agents: call <code>window.ABAnimationManager.wrapKeyword('horizon', { id: 'underline', color: 'accent' })</code> or <code>.select(id)</code> then <code>.wrapSelection()</code>. Keyword → animation map is in <code>animations.json</code>.</p>
          </section>
        </div>
        <aside class="am-preview-column" aria-label="Live preview">
          <p class="am-caption">Live preview</p>
          <div class="am-stage" data-stage></div>
          <p class="am-caption">Mark HTML <button type="button" class="am-inline-copy" data-action="copy">${symbol('content_copy')} Copy</button></p>
          <pre class="am-code"><code data-code></code></pre>
          <output data-detail class="am-detail"></output>
        </aside>
      </div>
    </div>
  `;

  const find = selector => host.querySelector(selector);
  const all = selector => host.querySelectorAll(selector);
  host.querySelectorAll('input[data-key],select[data-key]').forEach(input => {
    input.id = `${id}-${input.dataset.key.replace('.', '-')}`;
    input.closest('label')?.setAttribute('for', input.id);
  });
  const bar = mountNotificationBar(find('[data-notifications]'), {
    service: notificationService, matchHeight: find('.am-rail'), enabled: state.notificationsEnabled,
  });

  const entry = () => findAnimation(state.selected);
  const currentOpts = extra => ({
    speed: state.speed, scale: state.scale, rotation: state.rotation, color: state.color,
    repeats: state.repeats, jitter: state.jitter,
    band: { ...state.band }, play: state.applied, ...extra,
  });
  const resolveEntry = ref => (ref ? findAnimation(ref) : entry()) ?? entry();
  const resolveRoot = ref => {
    if (ref instanceof HTMLElement) return ref;
    if (typeof ref === 'string' && ref.trim()) return document.querySelector(ref) ?? target;
    return target;
  };

  function status(message, error = false) {
    find('[data-status]').textContent = message;
    find('[data-status]').dataset.error = String(error);
  }

  function makeNode(ref, opts, text) {
    const mark = resolveEntry(ref);
    const template = document.createElement('template');
    template.innerHTML = instanceMarkup(mark, { ...currentOpts(), ...opts, text }).trim();
    const node = template.content.firstElementChild;
    node.setAttribute('data-am-injected', mark.id);
    return node;
  }

  function track(node, text, mode) {
    injected.push({ node, text, mode });
    renderInjectedCount();
  }
  function renderInjectedCount() {
    const label = injected.length ? `${injected.length} mark${injected.length === 1 ? '' : 's'} inserted` : 'No marks inserted';
    find('[data-injected-count]').textContent = label;
    find('[data-action="undo"]').disabled = !injected.length;
    find('[data-action="clear"]').disabled = !injected.length;
  }

  function render() {
    const mark = entry();
    // preview stage
    const stage = find('[data-stage]');
    const markup = instanceMarkup(mark, { ...currentOpts(), text: textValue(), over: overValue() });
    stage.innerHTML = markup;
    // code block = just the mark element markup
    find('[data-code]').textContent = markup;
    // controls
    all('input[data-key],select[data-key]').forEach(input => {
      const value = readState(input.dataset.key);
      if (input.type === 'checkbox') input.checked = value;
      else input.value = value;
      if (input.type === 'range') {
        const formatted = `${Number(Number(value).toFixed(2))}${input.dataset.unit}`;
        input.setAttribute('aria-valuetext', formatted);
        find(`[data-value="${input.dataset.key}"]`).textContent = formatted;
      }
    });
    find('[data-band]').hidden = mark.kind !== 'hl';
    find('[data-text-field]').hidden = !mark.needsText;
    find('[data-over-field]').hidden = mark.id !== 'correction';
    find('[data-sel-name]').textContent = mark.name;
    all('[data-select]').forEach(cell => cell.setAttribute('aria-pressed', String(cell.dataset.select === state.selected)));
    find('[data-action="notifications"]').setAttribute('aria-pressed', String(state.notificationsEnabled));
    find('[data-action="notifications"] .am-symbol').textContent = state.notificationsEnabled ? 'notifications' : 'notifications_off';
    bar.setEnabled(state.notificationsEnabled);
    style.textContent = baseCss();
    find('[data-meter]').textContent = `${mark.name} · ${Number(state.speed.toFixed(1))}× · ${Math.round(state.scale * 100)}% · ${state.rotation}° · ${roleLabel(state.color)}`;
    find('[data-detail]').textContent = `${mark.name} (${mark.id}) · ${mark.kind} · colour ${roleLabel(state.color)} · ${state.applied ? `${state.repeats} draw passes · random tilt ±${state.jitter}°` : 'static'} · ${injected.length} inserted.`;
  }

  function textValue() { return find('[data-text]')?.value || undefined; }
  function overValue() { return find('[data-over]')?.value || undefined; }

  function readState(key) {
    if (key.startsWith('band.')) return state.band[key.slice(5)];
    return state[key];
  }
  function writeState(next, key, value) {
    if (key.startsWith('band.')) next.band = { ...next.band, [key.slice(5)]: value };
    else next[key] = value;
  }

  function commit(next, message = 'Updated.') {
    state = validateSettings(next);
    render();
    status(message);
    if (storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify(state)); }
      catch (error) { status(`Live but not saved: ${error.message}`, true); notify(`Could not save: ${error.message}`, 'error'); }
    }
    onChange(structuredClone(state));
    host.dispatchEvent(new CustomEvent('animation-manager:change', { bubbles: true, detail: structuredClone(state) }));
  }

  function select(markId, open = true) {
    const mark = findAnimation(markId);
    if (!mark) throw new Error(`Unknown animation "${markId}".`);
    commit({ ...state, selected: markId, color: mark.color }, `Selected ${mark.name}.`);
    const textInput = find('[data-text]');
    if (textInput) textInput.value = '';
    const overInput = find('[data-over]');
    if (overInput) overInput.value = '';
    render();
    if (open) panel('adjust');
  }

  // ---- live injection -----------------------------------------------------
  function wrapSelection(options = {}) {
    const mark = resolveEntry(options.id);
    const selection = getSelection();
    if (mark.needsText) {
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        notify('Select some text on the page first.', 'error');
        status('Select some text on the page, then Wrap selection.', true);
        return null;
      }
      const sourceRange = selection.getRangeAt(0);
      if (host.contains(sourceRange.commonAncestorContainer)) { notify('Select text on the page, not inside the manager.', 'error'); return null; }
      const text = selection.toString();
      const node = makeNode(options.id, options, text);
      sourceRange.deleteContents();
      sourceRange.insertNode(node);
      selection.removeAllRanges();
      track(node, text, 'replace');
      notify(`Wrapped "${truncate(text)}" with ${mark.name}.`, 'success');
      return node;
    }
    return insertHere(options);
  }

  function insertHere(options = {}) {
    const mark = resolveEntry(options.id);
    const node = makeNode(options.id, options, options.text);
    const selection = getSelection();
    if (selection && selection.rangeCount && !host.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      const insertRange = selection.getRangeAt(0);
      insertRange.collapse(false);
      insertRange.insertNode(node);
      selection.removeAllRanges();
    } else {
      resolveRoot(options.root).append(node);
    }
    track(node, node.textContent, 'append');
    notify(`Inserted ${mark.name}.`, 'success');
    return node;
  }

  function wrapKeyword(keyword, options = {}) {
    const mark = resolveEntry(options.id);
    const needle = String(keyword ?? '').trim();
    if (!needle) { notify('Enter a keyword to mark.', 'error'); return []; }
    const root = resolveRoot(options.root);
    const all = options.all !== false && String(options.all) !== 'false';
    const made = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (host.contains(node)) return NodeFilter.FILTER_REJECT;
        if (node.parentElement?.closest('.am-item, script, style, [data-am-skip]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const lower = needle.toLowerCase();
    outer: for (const textNode of nodes) {
      let current = textNode;
      while (current && current.nodeValue) {
        const index = current.nodeValue.toLowerCase().indexOf(lower);
        if (index < 0) break;
        const matched = current.nodeValue.slice(index, index + needle.length);
        const matchNode = current.splitText(index);
        const afterNode = matchNode.splitText(needle.length);
        if (mark.needsText) {
          const node = makeNode(options.id, options, matched);
          matchNode.replaceWith(node);
          track(node, matched, 'replace');
          made.push(node);
        } else {
          const node = makeNode(options.id, options, options.text);
          afterNode.parentNode.insertBefore(node, afterNode);
          track(node, node.textContent, 'append');
          made.push(node);
        }
        if (!all) break outer;
        current = afterNode;
      }
    }
    if (made.length) notify(`Marked ${made.length} × "${truncate(needle)}" with ${mark.name}.`, 'success');
    else { notify(`No "${truncate(needle)}" found in the target.`, 'error'); status(`No "${needle}" found to mark.`, true); }
    return made;
  }

  function undo() {
    const record = injected.pop();
    if (!record) return;
    if (record.mode === 'replace') {
      const parent = record.node.parentNode;
      record.node.replaceWith(document.createTextNode(record.text));
      parent?.normalize();
    } else {
      record.node.remove();
    }
    renderInjectedCount();
    status('Removed the last inserted mark.');
  }
  function clearInjected() {
    while (injected.length) undo();
    status('Cleared inserted marks.');
  }
  const truncate = text => (text.length > 24 ? `${text.slice(0, 23)}…` : text);

  // ---- panels / deck ------------------------------------------------------
  function panel(name, focus = true) {
    active = active === name ? null : name;
    if (active) all('[data-card]').forEach(card => { card.hidden = card.dataset.card !== active; });
    all('[data-panel]').forEach(button => button.setAttribute('aria-expanded', String(button.dataset.panel === active)));
    showDeck();
    if (active && focus) find(`[data-card="${active}"]`).querySelector('input,select,button')?.focus();
  }
  function reducedMotion() {
    return motion.matches || document.documentElement.classList.contains('no-motion') || !!target.closest('[data-tm-no-motion="true"]');
  }
  function showDeck() {
    const deck = find('.am-deck');
    const visible = !!active;
    const opacity = deck.hidden ? 0 : Number(getComputedStyle(deck).opacity);
    deckAnimation?.cancel();
    deckAnimation = null;
    if (!visible && deck.contains(document.activeElement)) find('.am-rail button').focus();
    deck.inert = !visible;
    deck.setAttribute('aria-hidden', String(!visible));
    if (reducedMotion() || (!visible && deck.hidden)) { deck.hidden = !visible; return; }
    deck.hidden = false;
    const animation = deck.animate([{ opacity: visible ? 0 : opacity }, { opacity: visible ? 1 : 0 }], { duration: 200, easing: 'ease', fill: 'forwards' });
    deckAnimation = animation;
    animation.finished.then(() => {
      if (destroyed || deckAnimation !== animation) return;
      deck.hidden = !visible; animation.cancel(); deckAnimation = null;
    }, error => { if (error.name !== 'AbortError') status(error.message, true); });
  }
  function syncMotion() {
    host.dataset.amNoMotion = String(reducedMotion());
    if (reducedMotion()) showDeck();
  }
  function download(content, type, name) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    notify(`${name} exported.`, 'success');
  }
  async function copyMarkup() {
    const markup = find('[data-code]').textContent;
    try { await navigator.clipboard.writeText(markup); notify('Mark HTML copied.', 'success'); status('Mark HTML copied to the clipboard.'); }
    catch { download(markup, 'text/html', `${state.selected}.html`); }
  }

  // ---- events -------------------------------------------------------------
  function updateFromInput(input) {
    try {
      if (input.dataset.key === 'applied') return commit({ ...state, applied: input.checked });
      if (input.dataset.key === 'color') return commit({ ...state, color: input.value });
      const next = structuredClone(state);
      writeState(next, input.dataset.key, input.valueAsNumber);
      commit(next);
    } catch (error) { render(); status(error.message, true); notify(error.message, 'error'); }
  }
  host.addEventListener('input', event => {
    const input = event.target;
    if (input.matches('input[type="range"][data-key]')) updateFromInput(input);
    else if (input.matches('[data-text],[data-over]')) render();
    else if (input.matches('[data-search]')) filterGallery();
  }, { signal: abort.signal });
  host.addEventListener('change', event => {
    const input = event.target;
    if (input.matches('select[data-key],input[type="checkbox"][data-key]')) updateFromInput(input);
    else if (input.matches('[data-cat-filter]')) filterGallery();
  }, { signal: abort.signal });
  host.addEventListener('click', event => {
    const cell = event.target.closest('[data-select]');
    if (cell) return select(cell.dataset.select);
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.panel) return panel(button.dataset.panel);
    switch (button.dataset.action) {
      case 'close': { const previous = active; panel(active, false); find(`[data-panel="${previous}"]`)?.focus(); break; }
      case 'notifications': commit({ ...state, notificationsEnabled: !state.notificationsEnabled }); if (state.notificationsEnabled) notify('Notifications enabled.'); break;
      case 'reset': commit(validateSettings({ ...defaultSettings(), ...initialSettings }), 'Settings reset.'); notify('Settings reset.'); break;
      case 'replay': render(); break;
      case 'copy': copyMarkup(); break;
      case 'export': download(JSON.stringify(state, null, 2), 'application/json', 'animation-settings.json'); break;
      case 'css': download(exportSnippet(entry(), { ...currentOpts(), text: textValue(), over: overValue() }), 'text/html', `${state.selected}.html`); break;
      case 'wrap': wrapSelection(); break;
      case 'insert': insertHere(); break;
      case 'keyword': wrapKeyword(find('[data-keyword]').value, { all: find('[data-keyword-all]').value !== 'false', root: find('[data-root]').value }); break;
      case 'undo': undo(); break;
      case 'clear': clearInjected(); break;
    }
  }, { signal: abort.signal });
  host.addEventListener('keydown', event => {
    if (event.key === 'Escape' && active) { const previous = active; panel(active, false); find(`[data-panel="${previous}"]`).focus(); }
  }, { signal: abort.signal });

  function filterGallery() {
    const term = (find('[data-search]').value || '').trim().toLowerCase();
    const cat = find('[data-cat-filter]').value;
    let shown = 0;
    all('[data-select]').forEach(cell => {
      const match = (!term || cell.dataset.terms.includes(term)) && (!cat || cell.dataset.cat === cat);
      cell.hidden = !match;
      if (match) shown++;
    });
    status(`${shown} animation${shown === 1 ? '' : 's'} shown.`);
  }

  document.addEventListener('pointerdown', event => {
    if (active && !host.contains(event.target)) {
      // Keep the deck open while the user selects page text for injection.
      if (active === 'inject') return;
      panel(active, false);
    }
  }, { signal: abort.signal });
  motion.addEventListener('change', syncMotion, { signal: abort.signal });
  const motionObserver = new MutationObserver(syncMotion);
  motionObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-tm-no-motion'] });

  syncMotion();
  renderInjectedCount();
  render();
  status('Pick a mark in the gallery, tune it, then insert it into the page.');
  if (storageError) { status(storageError, true); notify(storageError, 'error'); }

  const api = {
    validate: validateSettings,
    get: () => structuredClone(state),
    load(value) { commit(value, 'Settings loaded.'); },
    css: () => baseCss(),
    snippet: (options = {}) => exportSnippet(entry(), { ...currentOpts(), text: textValue(), over: overValue(), ...options }),
    catalog: () => CATALOG.map(mark => ({ ...mark })),
    select,
    set(options = {}) { commit({ ...state, ...options }); },
    element: (ref, options = {}) => makeNode(ref, options, options.text),
    replay: render,
    wrapSelection, insertHere, wrapKeyword, undo, clearInjected,
    open(name = 'gallery') {
      if (!['gallery', 'adjust', 'inject'].includes(name)) throw new Error('Unknown manager panel.');
      if (active !== name) panel(name);
    },
    destroy() {
      destroyed = true;
      abort.abort();
      deckAnimation?.cancel();
      motionObserver.disconnect();
      bar.destroy();
      style.remove();
      fonts.remove();
      filterNode?.remove();
      host.replaceChildren();
      host.classList.remove('am-manager');
      delete host.dataset.amNoMotion;
      delete host.dataset.amMounted;
    },
  };
  return api;
}
