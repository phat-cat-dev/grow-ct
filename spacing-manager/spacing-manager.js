import { notifications } from '../notifications/notification-service.js';
import { mountNotificationBar } from '../notifications/notification-bar.js';
import { validateSettings, settingsCss, fontUrl, SPACING_PROFILES, TYPOGRAPHY_RATIOS, TYPOGRAPHY_BULLETS, ACADEMIC_BULLETS, HEADING_HARMONIES, headingSizes, FONT_FAMILIES } from './manager-engine.js';

let instances = 0;
const text = ['Depth from a single hue', 'The grey equivalent of that blue', 'Shading gives the sense of layers', 'Quiet enough to recede', 'A supporting detail line', 'Faint section label'];
const label = value => value.replaceAll('-', ' ').replace(/^\w/, letter => letter.toUpperCase());
const options = entries => entries.map(([value, name]) => `<option value="${value}">${name}</option>`).join('');
const range = (group, key, title, min, max, step, unit = '') => `<label>${title}<output data-value="${group}.${key}"></output><input type="range" data-group="${group}" data-key="${key}" min="${min}" max="${max}" step="${step}" data-unit="${unit}"></label>`;
const select = (group, key, title, entries) => `<label>${title}<select data-group="${group}" data-key="${key}">${options(entries)}</select></label>`;
const symbol = name => `<span class="sm-symbol" aria-hidden="true">${name}</span>`;

export function mountSpacingManager(host, {
  target,
  initialSettings = {},
  storageKey = `grow-spacing-manager:${location.pathname}`,
  notificationService = notifications,
  onChange = () => {},
} = {}) {
  if (!(target instanceof HTMLElement) || target.contains(host) || host.contains(target)) {
    throw new Error('Spacing manager needs a separate page target; mount the overlay outside it.');
  }
  if (host.dataset.smMounted !== undefined || target.hasAttribute('data-sm-page')) {
    throw new Error('This spacing manager host or page target is already mounted.');
  }
  const id = `sm-${++instances}`;
  const abort = new AbortController();
  let state = validateSettings(initialSettings);
  let active = null, destroyed = false, storageError = null;
  let deckAnimation = null;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const notify = (message, level = 'info') => notificationService.publish({ source: 'Spacing manager', message, level });
  if (storageKey) {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) state = validateSettings(JSON.parse(saved));
    } catch (error) {
      storageError = `Saved settings could not be restored: ${error.message}`;
    }
  }
  host.dataset.smMounted = '';
  host.classList.add('sm-manager');
  target.setAttribute('data-sm-page', id);
  const previousLive = target.getAttribute('data-sm-live');
  const style = document.createElement('style');
  const fonts = document.createElement('link');
  fonts.rel = 'stylesheet';
  document.head.append(style, fonts);
  host.innerHTML = `
    <div class="sm-rail" role="group" aria-label="Spacing and typography controls">
      <div class="sm-buttons">
        <button type="button" class="sm-icon" data-action="notifications" aria-label="Notifications" title="Notifications" aria-pressed="true">${symbol('notifications')}</button>
        <button type="button" class="sm-icon" data-panel="colour" aria-label="Colour" title="Colour" aria-controls="${id}-colour" aria-expanded="false">${symbol('palette')}</button>
        <button type="button" class="sm-icon" data-panel="spacing" aria-label="Spacing" title="Spacing" aria-controls="${id}-spacing" aria-expanded="false">${symbol('space_dashboard')}</button>
      </div>
      <output class="sm-meter" data-meter aria-label="Live specimen measurements"></output>
      <div class="sm-buttons">
        <button type="button" class="sm-icon" data-panel="fonts" aria-label="Fonts" title="Fonts" aria-controls="${id}-fonts" aria-expanded="false">${symbol('font_download')}</button>
        <button type="button" class="sm-icon" data-panel="typography" aria-label="Typography" title="Typography" aria-controls="${id}-typography" aria-expanded="false">${symbol('format_size')}</button>
      </div>
    </div>
    <div data-notifications></div>
    <div class="sm-deck" hidden>
      <div class="sm-deck-top">
        <label class="sm-check"><input type="checkbox" data-group="manager" data-key="downstream"> Apply to page</label>
        <div class="sm-buttons"><button type="button" class="sm-icon" data-action="export" aria-label="Export JSON" title="Export JSON">${symbol('data_object')}</button><button type="button" class="sm-icon" data-action="css" aria-label="Export CSS" title="Export CSS">${symbol('css')}</button><button type="button" class="sm-icon" data-action="reset" aria-label="Reset" title="Reset">${symbol('restart_alt')}</button><button type="button" class="sm-icon" data-action="close" aria-label="Close settings" title="Close settings">${symbol('close')}</button></div>
      </div>
      <p class="sm-status" role="status" data-status></p>
      <div class="sm-card-layout">
        <div class="sm-controls">
          <section id="${id}-typography" data-card="typography" aria-label="Typography reading preview" hidden>
            <h2>Typography in context</h2>
            <p>Compare the heading ramp with body copy in a real reading context. The preview uses your current font pairing, heading scheme and fluid settings.</p>
            <div class="sm-buttons">
              <button type="button" data-panel="fonts" aria-controls="${id}-fonts" aria-expanded="false">Font pairing</button>
              <button type="button" data-panel="headings" aria-controls="${id}-headings" aria-expanded="false">Heading schemes</button>
            </div>
            <p>Enable Apply to page to push these settings downstream. Turn it off to keep experimenting in this panel without changing the page.</p>
          </section>
          <section id="${id}-spacing" data-card="spacing" aria-label="Fluid spacing" hidden>
            <h2>Fluid spacing</h2>
            <p>Each range changes its own live sample. Values interpolate between the viewport limits; beyond those limits they stop growing.</p>
            <label>Profile<select data-profile><option value="custom">Custom</option>${options(Object.keys(SPACING_PROFILES).map(key => [key, label(key)]))}</select></label>
            <div class="sm-grid">
              <fieldset><legend>Viewport range (rem)</legend>${range('spacing', 'viewportMin', 'Minimum', 10, 119, 1, 'rem')}${range('spacing', 'viewportMax', 'Maximum', 11, 120, 1, 'rem')}</fieldset>
              ${[['text', 'Text base', .5, 3], ['space', 'Space base', .5, 3], ['layout', 'Layout base', .5, 3], ['icon', 'Icon size', .5, 6]].map(([key, name, min, max]) => `<fieldset><legend>${name} (rem)</legend>${range('spacing', key + 'Min', 'Minimum', min, max, .05, 'rem')}${range('spacing', key + 'Max', 'Maximum', min, max, .05, 'rem')}</fieldset>`).join('')}
              <fieldset><legend>Page dials</legend>${range('manager', 'typeScale', 'Type scale', .5, 2, .01, 'x')}${range('manager', 'spaceScale', 'Space density', .5, 2, .01, 'x')}</fieldset>
            </div>
          </section>
          <section id="${id}-fonts" data-card="fonts" aria-label="Font pairing" hidden>
            <h2>Font pairing</h2>
            <p>Heading and body faces update the specimen immediately. Google Fonts needs a connection; fallback fonts remain readable.</p>
            <div class="sm-font-controls"><div class="sm-grid">${select('connectors', 'headingFont', 'Heading font', FONT_FAMILIES.map(name => [name, name]))}${select('connectors', 'bodyFont', 'Body font', FONT_FAMILIES.map(name => [name, name]))}</div>
            <div class="sm-font-metrics">${range('typography', 'bodySize', 'Body size', 12, 24, 1, 'px')}${range('typography', 'lineHeight', 'Line height', 1.2, 2.2, .05)}${range('typography', 'readingWidth', 'Reading width', 40, 100, 1, 'ch')}</div>
            </div>
            <p data-font-status role="status"></p>
            <a href="https://fonts.google.com/" target="_blank" rel="noreferrer">Explore Google Fonts</a>
          </section>
          <section id="${id}-headings" data-card="headings" aria-label="Heading schemes" hidden>
            <h2>Heading schemes <code>.scheme</code></h2>
            <fieldset><legend>CAPS by heading level</legend><div class="sm-caps">${text.map((_, i) => `<label><input type="checkbox" data-caps="${i}">H${i + 1} CAPS</label>`).join('')}</div><button type="button" data-action="caps-default">Suggested defaults</button><p>Off preserves original casing. Caps are independent of colour, size and reverse.</p></fieldset>
            <div class="sm-grid">
              ${select('typography', 'scheme', 'Heading colours', [['diagonal', 'Diagonal'], ['grey', 'Colour-grey'], ['gray', 'Pure grey'], ['mono', 'Mono'], ['twotone', 'Two-tone'], ['accent', 'Accent-top'], ['muted', 'Muted'], ...Object.keys(HEADING_HARMONIES).map(key => [key, label(key)])])}
              ${select('typography', 'decoration', 'Line decoration', [['none', 'No line'], ['underline', 'Underline'], ['dashed', 'Dashed'], ['dotted', 'Dotted'], ['leftborder', 'Left border']])}
              ${range('typography', 'underlineWidth', 'Underline thickness', .01, .3, .01, 'em')}
              ${range('typography', 'borderWidth', 'Left-border width', .01, .5, .01, 'rem')}
              ${select('typography', 'bullet', 'Heading bullet / academic icon', [...Object.entries(TYPOGRAPHY_BULLETS).map(([key, symbol]) => [key, key === 'none' ? 'No bullet' : `${symbol} ${label(key)}`]), ...Object.entries(ACADEMIC_BULLETS).map(([key, value]) => [key, `Academic: ${value.label}`])])}
              ${range('typography', 'iconSize', 'Academic icon size', .3, 2, .01, 'em')}
              ${select('typography', 'size', 'Heading size formula', [['graded', 'Graded sizes'], ['uniform', 'Uniform size'], ...Object.entries(TYPOGRAPHY_RATIOS).map(([key, ratio]) => [key, `${label(key)} / ${ratio.toFixed(3)}`])])}
              ${range('typography', 'scale', 'Heading scale', .8, 1.8, .01, 'x')}
            </div>
            <label class="sm-check"><input type="checkbox" data-group="typography" data-key="reverse">Reverse colour order (not sizes)</label>
            <p data-formula></p>
            <p>Muted uses 45% saturation. Analogous offsets 0 / 15 / 30 / -15 / -30 / 45 degrees; Complementary splits base/opposite; Triadic cycles 120 degrees, Split 150/210, Square 90, Spectrum 60, Golden angle 137.508. Reverse reverses hue and brightness, not sizes or caps. The colour harmony palette is unchanged.</p>
            <p>Modular scales start at H6 = 0.875rem and grow by the chosen ratio, fluid from 85% to 100% between 20rem and 80rem. Heading size formulas are independent of fluid spacing.</p>
          </section>
          <section id="${id}-colour" data-card="colour" aria-label="Main hue" hidden>
            <h2>Main hue</h2><p>These foundation dials feed the samples and heading formulas. They do not change the separate harmony palette.</p>
            ${range('manager', 'hue', 'Hue', 0, 360, 1, 'deg')}${range('manager', 'saturation', 'Saturation', 0, 100, 1, '%')}
          </section>
        </div>
        <aside class="sm-preview-column" aria-label="Live specimen">
          <p class="sm-caption">Live specimen / actual rendered sizes</p>
          <div class="sm-preview scheme" data-heading-preview data-sm-live="${id}">
            <div class="sm-specimen">
              ${text.map((line, i) => `<h${i + 1}>${line}</h${i + 1}>`).join('')}
              <p class="sm-copy">Good typography gives ideas room to breathe. Aa Bb 0123. Compare the shapes, spacing and the way each line carries you into the next.</p>
              <div class="sm-type-ramp" data-type-ramp hidden>
                ${[['2xs', 'An annotation'], ['xs', 'A short supporting sentence'], ['sm', 'A readable introduction'], ['md', 'A clear subheading'], ['lg', 'An expressive title'], ['xl', 'Make room'], ['2xl', 'Ideas grow']].map(([step, copy]) => `<p style="font-size:var(--ab-text-${step})">${step} / ${copy}</p>`).join('')}
              </div>
              <div class="sm-space-demo"><svg class="sm-demo-icon" viewBox="0 0 24 24" aria-label="Icon size specimen" role="img"><path fill="currentColor" d="M12 2 22 12 12 22 2 12Z"/></svg><span>Layout space above and below; item gap between icon and text.</span></div>
            </div>
          </div>
          <div class="sm-preview scheme" data-reading-preview data-sm-live="${id}" hidden>
            <div class="sm-specimen">
              <h2>Downstream heading</h2>
              <p class="sm-copy">Body copy under the applied scheme. Tune your font pairing and heading controls, then enable Apply to page to push the same treatment downstream.</p>
              <h3>A subsection</h3>
              <p class="sm-copy">The ramp in a real reading context rather than a label list. Compare character, line length and the space around each idea.</p>
              <h4>A minor point</h4>
            </div>
          </div>
          <output data-detail class="sm-detail"></output>
        </aside>
      </div>
    </div>
    <div class="sm-probe" data-sm-live="${id}" aria-hidden="true"><div class="sm-specimen"><span class="sm-copy">Aa</span><svg class="sm-demo-icon"></svg><div class="sm-space-demo"></div></div></div>
  `;
  const find = selector => host.querySelector(selector);
  const all = selector => host.querySelectorAll(selector);
  all('input[data-group]').forEach(input => {
    input.id = `${id}-${input.dataset.group}-${input.dataset.key}`;
    input.closest('label').htmlFor = input.id;
  });
  const bar = mountNotificationBar(find('[data-notifications]'), {
    service: notificationService, matchHeight: find('.sm-rail'), enabled: state.notificationsEnabled,
  });
  const scope = `[data-sm-live="${id}"]`;
  let fontRequest = 0, lastFontUrl = '';
  function status(message, error = false) {
    find('[data-status]').textContent = message;
    find('[data-status]').dataset.error = String(error);
  }
  function measure() {
    if (destroyed) return;
    host.style.setProperty('--sm-deck-height', `${Math.max(0, innerHeight - host.getBoundingClientRect().bottom - 24)}px`);
    const probe = find('.sm-probe');
    const copy = getComputedStyle(probe.querySelector('.sm-copy'));
    const padding = getComputedStyle(probe.querySelector('.sm-specimen')).paddingTop;
    const icon = getComputedStyle(probe.querySelector('.sm-demo-icon')).width;
    const layout = getComputedStyle(probe.querySelector('.sm-space-demo')).paddingTop;
    const gap = getComputedStyle(probe.querySelector('.sm-space-demo')).gap;
    const px = value => `${Number.parseFloat(value).toFixed(1)}px`;
    find('[data-meter]').textContent = `Text ${px(copy.fontSize)} / Space ${px(padding)} / ${innerWidth}px`;
    find('[data-detail]').textContent = `Text ${px(copy.fontSize)} / padding ${px(padding)} / gap ${px(gap)} / layout ${px(layout)} / icon ${px(icon)} / viewport ${innerWidth}px. ${state.downstream ? 'Page + specimen' : 'Specimen only'}.`;
  }
  function render() {
    if (state.downstream) target.setAttribute('data-sm-live', id);
    else if (previousLive === null) target.removeAttribute('data-sm-live');
    else target.setAttribute('data-sm-live', previousLive);
    style.textContent = settingsCss(state, scope);
    all('[data-group]').forEach(input => {
      const { group, key } = input.dataset;
      const value = group === 'manager' ? state[key] : state[group][key];
      if (group === 'spacing') {
        const base = key.slice(0, -3);
        if (key.endsWith('Min')) input.max = state.spacing[`${base}Max`] - (base === 'viewport' ? 1 : 0);
        else input.min = state.spacing[`${base}Min`] + (base === 'viewport' ? 1 : 0);
      }
      if (input.type === 'checkbox') input.checked = value;
      else input.value = value;
      if (input.type === 'range') {
        const formatted = `${Number(value.toFixed(2))} ${input.dataset.unit}`;
        input.setAttribute('aria-valuetext', formatted);
        find(`[data-value="${group}.${key}"]`).textContent = formatted;
      }
    });
    all('[data-caps]').forEach(input => { input.checked = state.typography.caps[Number(input.dataset.caps)]; });
    find('[data-profile]').value = Object.keys(SPACING_PROFILES).find(name => Object.entries(state.spacing).every(([key, value]) => value === SPACING_PROFILES[name][key])) ?? 'custom';
    find('[data-formula]').textContent = `H1-H6 maxima: ${headingSizes(state.typography.size).map(size => `${(size * state.typography.scale).toFixed(3)}rem`).join(' / ')}.`;
    find('[data-action="notifications"]').setAttribute('aria-pressed', String(state.notificationsEnabled));
    find('[data-action="notifications"] .sm-symbol').textContent = state.notificationsEnabled ? 'notifications' : 'notifications_off';
    bar.setEnabled(state.notificationsEnabled);
    const url = fontUrl(state);
    if (url !== lastFontUrl) {
      lastFontUrl = url;
      fontRequest++;
      fonts.href = url;
      find('[data-font-status]').textContent = 'Loading selected Google Fonts; system fallback remains available.';
    }
    measure();
  }
  function commit(next, message = 'Settings updated.') {
    state = validateSettings(next);
    render();
    status(`${message} ${state.downstream ? 'Applied to page and specimen.' : 'Specimen only; enable Apply to page for downstream styling.'}`);
    if (storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify(state)); }
      catch (error) { status(`Settings are live but could not be saved: ${error.message}`, true); notify(`Settings could not be saved: ${error.message}`, 'error'); }
    }
    onChange(structuredClone(state));
    host.dispatchEvent(new CustomEvent('spacing-manager:change', { bubbles: true, detail: structuredClone(state) }));
  }
  function panel(name, focus = true) {
    active = active === name ? null : name;
    if (active) {
      find('[data-reading-preview]').hidden = active !== 'typography';
      find('[data-heading-preview]').hidden = active === 'typography';
      find('[data-type-ramp]').hidden = active !== 'spacing';
      all('[data-card]').forEach(card => { card.hidden = card.dataset.card !== active; });
    }
    all('[data-panel]').forEach(button => { button.setAttribute('aria-expanded', String(button.dataset.panel === active)); });
    showDeck();
    if (active && focus) find(`[data-card="${active}"]`).querySelector('input,select,button')?.focus();
    measure();
  }
  function reducedMotion() {
    return motion.matches || document.documentElement.classList.contains('no-motion') ||
      !!target.closest('[data-tm-no-motion="true"]');
  }
  function showDeck() {
    const deck = find('.sm-deck');
    const visible = !!active;
    const opacity = deck.hidden ? 0 : Number(getComputedStyle(deck).opacity);
    deckAnimation?.cancel();
    deckAnimation = null;
    if (!visible && deck.contains(document.activeElement)) find('.sm-rail button').focus();
    deck.inert = !visible;
    deck.setAttribute('aria-hidden', String(!visible));
    if (reducedMotion() || (!visible && deck.hidden)) {
      deck.hidden = !visible;
      return;
    }
    deck.hidden = false;
    const animation = deck.animate([{ opacity: visible ? 0 : opacity }, { opacity: visible ? 1 : 0 }], {
      duration: 200, easing: 'ease', fill: 'forwards',
    });
    deckAnimation = animation;
    animation.finished.then(() => {
      if (destroyed || deckAnimation !== animation) return;
      deck.hidden = !visible;
      animation.cancel();
      deckAnimation = null;
    }, error => {
      if (error.name !== 'AbortError') { status(error.message, true); notify(error.message, 'error'); }
    });
  }
  function syncMotion() {
    host.dataset.smNoMotion = String(reducedMotion());
    if (reducedMotion()) showDeck();
  }
  function download(content, type, name) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    notify(`${name} exported.`, 'success');
  }
  host.addEventListener('input', event => {
    const input = event.target;
    if (!input.matches('input[type="range"][data-key]')) return;
    update(input);
  }, { signal: abort.signal });
  function update(input) {
    try {
      const next = structuredClone(state);
      if (input.dataset.caps !== undefined) next.typography.caps[Number(input.dataset.caps)] = input.checked;
      else {
        const { group, key } = input.dataset;
        const value = input.type === 'checkbox' ? input.checked : input.type === 'range' ? input.valueAsNumber : input.value;
        (group === 'manager' ? next : next[group])[key] = value;
      }
      commit(next);
    } catch (error) { render(); status(error.message, true); notify(error.message, 'error'); }
  }
  host.addEventListener('change', event => {
    const input = event.target;
    if (input.matches('[data-group]:not([type="range"]),[data-caps]')) update(input);
    if (input.matches('[data-profile]') && input.value !== 'custom') commit({ ...state, spacing: SPACING_PROFILES[input.value] }, 'Spacing profile updated.');
  }, { signal: abort.signal });
  host.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.panel) return panel(button.dataset.panel);
    switch (button.dataset.action) {
      case 'close': {
        const previous = active;
        panel(active, false);
        find(`[data-panel="${previous === 'headings' ? 'typography' : previous}"]`)?.focus();
        break;
      }
      case 'notifications':
        commit({ ...state, notificationsEnabled: !state.notificationsEnabled });
        if (state.notificationsEnabled) notify('Notifications enabled.');
        break;
      case 'reset': commit(validateSettings(initialSettings), 'Settings reset.'); notify('Settings reset.'); break;
      case 'caps-default': commit({ ...state, typography: { ...state.typography, caps: [false, false, false, false, false, true] } }); break;
      case 'export': download(JSON.stringify(state, null, 2), 'application/json', 'spacing-typography.json'); break;
      case 'css': download(`@import url("${fontUrl(state)}");\n${settingsCss(state)}`, 'text/css', 'spacing-typography.css'); break;
    }
  }, { signal: abort.signal });
  host.addEventListener('keydown', event => {
    if (event.key === 'Escape' && active) {
      const previous = active;
      panel(active, false);
      find(`[data-panel="${previous === 'headings' ? 'typography' : previous}"]`).focus();
    }
  }, { signal: abort.signal });
  fonts.addEventListener('load', async () => {
    const request = fontRequest;
    try {
      const faces = await Promise.all([state.connectors.headingFont, state.connectors.bodyFont].map(name => document.fonts.load(`16px "${name}"`)));
      if (destroyed || request !== fontRequest) return;
      if (faces.some(loaded => loaded.length === 0)) throw new Error('The selected font did not load.');
      find('[data-font-status]').textContent = 'Selected Google Fonts loaded.';
      measure();
    } catch (error) {
      if (destroyed || request !== fontRequest) return;
      find('[data-font-status]').textContent = `Font loading failed; using fallbacks: ${error.message}`;
      notify(`Font loading failed: ${error.message}`, 'error');
    }
  }, { signal: abort.signal });
  fonts.addEventListener('error', () => {
    find('[data-font-status]').textContent = 'Google Fonts could not be reached. System fallback fonts are active.';
    notify('Google Fonts could not be reached. System fallback fonts are active.', 'error');
  }, { signal: abort.signal });
  window.addEventListener('resize', measure, { signal: abort.signal });
  document.addEventListener('pointerdown', event => {
    if (active && !host.contains(event.target)) panel(active, false);
  }, { signal: abort.signal });
  motion.addEventListener('change', syncMotion, { signal: abort.signal });
  const motionObserver = new MutationObserver(syncMotion);
  motionObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-tm-no-motion'] });
  motionObserver.observe(target, { attributes: true, attributeFilter: ['class', 'data-tm-no-motion'] });
  const resize = new ResizeObserver(measure);
  resize.observe(find('.sm-preview'));
  resize.observe(host);
  syncMotion();
  render();
  status(state.downstream
    ? 'Saved settings restored on the page and specimen.'
    : 'Specimen ready. Open a card to compare settings; enable Apply to page for downstream styling.');
  if (storageError) { status(storageError, true); notify(storageError, 'error'); }
  return {
    validate: validateSettings,
    get: () => structuredClone(state),
    load(value) { commit(value, 'Settings loaded.'); },
    css: () => settingsCss(state),
    open(name = 'spacing') {
      if (!['spacing', 'fonts', 'headings', 'colour', 'typography'].includes(name)) throw new Error('Unknown manager panel.');
      if (active !== name) panel(name);
    },
    destroy() {
      destroyed = true;
      abort.abort();
      deckAnimation?.cancel();
      motionObserver.disconnect();
      resize.disconnect();
      bar.destroy();
      style.remove();
      fonts.remove();
      if (previousLive === null) target.removeAttribute('data-sm-live');
      else target.setAttribute('data-sm-live', previousLive);
      target.removeAttribute('data-sm-page');
      host.replaceChildren();
      host.classList.remove('sm-manager');
      host.style.removeProperty('--sm-deck-height');
      delete host.dataset.smNoMotion;
      delete host.dataset.smMounted;
    },
  };
}
