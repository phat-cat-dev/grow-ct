import { notifications } from '../notifications/notification-service.js';
import { mountNotificationBar } from '../notifications/notification-bar.js';

let instanceCount = 0;

export const INITIAL_SCHEME = {
  name: 'workshop-theme', brandH: 334, brandS: 33, greyS: 12,
  harmony: 'complementary', semanticS: 55, overrides: {}, themeMode: 'system',
};

export function colourText({ h, s, l }) {
  return `hsl(${Number(h.toFixed(1))} ${Number(s.toFixed(1))}% ${Number(l.toFixed(1))}%)`;
}

export function rgbToColour([red, green, blue]) {
  const [r, g, b] = [red, green, blue].map(channel => channel / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (delta) h = (max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60;
  const s = delta ? delta / (1 - Math.abs(2 * l - 1)) * 100 : 0;
  return { h: (h + 360) % 360, s, l: l * 100, gs: Math.max(6, Math.min(40, Math.round(s / 6))) };
}

export function parseColour(text) {
  let value = text.trim();
  if (/^#?(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)) value = '#' + value.replace(/^#/, '');
  if (!value || /(?:currentcolor|inherit|initial|unset|revert|var\(|env\(|light-dark\()/i.test(value) || !CSS.supports('color', value)) {
    throw new Error('Enter an opaque hex, RGB, HSL or named CSS colour.');
  }
  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Colour parsing requires canvas support.');
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const rgba = context.getImageData(0, 0, 1, 1).data;
  if (rgba[3] !== 255) throw new Error('Use an opaque colour, without transparency.');
  return rgbToColour(rgba);
}

export function sourceForeground(colour) {
  const l = colour.l / 100, a = colour.s / 100 * Math.min(l, 1 - l);
  const luminance = [0, 8, 4].reduce((sum, n, index) => {
    const k = (n + colour.h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return sum + (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][index];
  }, 0);
  return (luminance + .05) / .05 >= 1.05 / (luminance + .05) ? '#000' : '#fff';
}

const shuffleIcon = '<span class="tm-symbol" aria-hidden="true">shuffle</span>';
const lockIcon = '<span class="tm-symbol" data-lock-symbol aria-hidden="true">lock</span>';

export function mountThemeManager(host, { adapter, preview = host, initialScheme = INITIAL_SCHEME, onChange = () => {}, notificationService = notifications, serverTools = true } = {}) {
  if (!adapter) throw new Error('ThemeManager requires a studio adapter.');
  if (host.hasAttribute('data-tm-mounted')) throw new Error('ThemeManager is already mounted here.');
  const id = `tm-${++instanceCount}`;
  let config = adapter.validate(initialScheme);
  let locked = config.themeManager?.locked ?? true;
  let activePanel = null, busy = false, destroyed = false;
  const panelAnimations = new Map();
  let built = null;
  const media = matchMedia('(prefers-color-scheme: dark)');
  const motionMedia = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const previousClass = preview.classList.contains('tm-scope');
  const previousTargets = [...new Set([host, preview])].map(element => ({
    element,
    theme: element.getAttribute('data-tm-theme'),
    motion: element.getAttribute('data-tm-no-motion'),
    styles: ['--tm-h', '--tm-s', '--tm-source', '--tm-on-source'].map(key => [
      key, element.style.getPropertyValue(key), element.style.getPropertyPriority(key),
    ]),
  }));
  const previousHostClass = host.classList.contains('tm-manager');
  host.classList.add('tm-manager');
  preview.classList.add('tm-scope');
  host.setAttribute('data-tm-mounted', '');
  host.innerHTML = `
    <div class="tm-rail tm-control-bar" role="group" aria-label="Theme control-bar">
      <div class="tm-theme">
        <button type="button" class="tm-icon" data-action="theme" aria-label="Mode" title="Mode" aria-expanded="false" aria-controls="${id}-theme"><span class="tm-symbol" aria-hidden="true">contrast</span></button>
      </div>
      <div class="tm-source" role="group" aria-label="Active source colour">
        <button type="button" class="tm-icon" data-action="notifications" aria-label="Notifications" title="Notifications" aria-pressed="true"><span class="tm-symbol" data-notifications-symbol aria-hidden="true">notifications</span></button>
        <button type="button" class="tm-icon" data-action="harmony-lock" aria-label="Lock harmony scheme" title="Lock harmony scheme" aria-pressed="false"><span class="tm-symbol" data-harmony-lock-symbol aria-hidden="true">lock_open</span></button>
        <button type="button" class="tm-icon" data-action="harmony" aria-label="Colour harmony" title="Colour harmony" aria-expanded="false" aria-controls="${id}-theory"><span class="tm-symbol" aria-hidden="true">palette</span></button>
        <label class="tm-sr" for="${id}-colour">Active colour: Enter to apply, Escape to restore</label>
        <input id="${id}-colour" data-field="colour" type="text" autocomplete="off" spellcheck="false" aria-describedby="${id}-status">
        <button type="button" class="tm-icon" data-action="shuffle" aria-label="Randomise source colour">${shuffleIcon}</button>
        <button type="button" class="tm-icon" data-action="lock">${lockIcon}</button>
      </div>
      <button type="button" class="tm-icon" data-action="toggle" aria-label="Schemes" title="Schemes" aria-controls="${id}-tools" aria-expanded="false"><span class="tm-symbol" aria-hidden="true">code</span></button>
    </div>
    <section class="tm-tools tm-mode-panel" id="${id}-theme" aria-label="Mode" hidden>
      <fieldset class="tm-theme-menu">
        <div class="tm-mode-options" role="group" aria-label="Preview mode">
          ${Object.entries({ light: 'light_mode', dark: 'dark_mode', contrast: 'contrast', system: 'devices' }).map(([mode, icon]) => `
            <button type="button" class="tm-mode-option" data-appearance="${mode}" aria-pressed="false"><span class="tm-symbol" aria-hidden="true">${icon}</span><span>${mode[0].toUpperCase() + mode.slice(1)}</span></button>
          `).join('')}
        </div>
        <div class="tm-mode-footer">
          <p class="tm-note" id="${id}-motion-note">No-motion also respects your system's reduced-motion preference.</p>
          <button type="button" class="tm-icon" data-action="no-motion" aria-label="No-motion" title="No-motion" aria-describedby="${id}-motion-note" aria-pressed="false"><span class="tm-symbol" aria-hidden="true">motion_photos_off</span></button>
        </div>
      </fieldset>
    </section>
    <section class="tm-tools tm-theory" id="${id}-theory" aria-label="Colour harmony" hidden>
      <div class="tm-theory-bar harm-swatches" role="group" aria-label="Harmony swatches"></div>
      <div class="tm-fields tm-theory-settings">
        <label>Harmony preset<select data-field="harmony-preset"></select></label>
        <label>Number of colours<select data-field="harmony-count">${[3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option value="${n}">${n}</option>`).join('')}</select></label>
        <label>Button appearance<select data-field="button-appearance"><option value="inverse">Inverse</option><option value="shaded">Shaded</option><option value="outline">Outline</option><option value="ghost">Ghost</option><option value="soft">Soft</option></select></label>
      </div>
      <div class="tm-fields tm-theory-sliders">
        <label>Base hue<input type="range" min="0" max="360" step="1" data-field="harmony-h"><output data-harmony-value="h"></output></label>
        <label>Base saturation<input type="range" min="0" max="100" step="1" data-field="harmony-s"><output data-harmony-value="s"></output></label>
        <label>Base lightness<input type="range" min="20" max="80" step="1" data-field="harmony-l"><output data-harmony-value="l"></output></label>
      </div>
      <h2>Colour harmony</h2>
      <p class="tm-note" data-harmony-note>Choose a harmony and select a swatch to use as the main accent.</p>
    </section>
    <section class="tm-tools" id="${id}-tools" aria-label="Schemes" hidden>
      <h2>Schemes</h2>
      <p class="tm-note">${serverTools ? 'Edit and save a scheme here, then build it into a theme. Modes control how the preview is displayed.' : 'Local design preview. Import/export JSON is available; server save, load and build are not connected.'}</p>
      <div class="tm-fields">
        <label>Scheme name<input data-field="name" value="workshop-theme" autocomplete="off" pattern="(?:[a-zA-Z0-9_]|-)+"></label>
        <label>Saved schemes<select data-field="schemes"><option value="">Choose a scheme</option></select></label>
      </div>
      <div class="tm-actions">
        <button type="button" data-action="refresh">Refresh list</button>
        <button type="button" data-action="load">Load</button>
        <button type="button" data-action="save">Save scheme</button>
        <button type="button" data-action="build">Save &amp; build</button>
      </div>
      <label>Custom scheme CSS<textarea data-field="css" rows="4" spellcheck="false"></textarea></label>
      <p class="tm-note">Save updates the named scheme on the server. Build saves first, then generates the full studio theme. Custom CSS is included in builds, not injected here. Copy and download refer to the latest build, not unsaved edits.</p>
      <div class="tm-actions">
        <button type="button" data-action="copy">Copy built CSS</button>
        <button type="button" data-action="json">Export scheme JSON</button>
        <label>Import scheme JSON<input data-field="import" type="file" accept=".json,application/json"></label>
      </div>
      <div class="tm-downloads" aria-label="Build downloads"></div>
    </section>
    <div id="${id}-status" data-notification-bar></div>`;

  const find = selector => host.querySelector(selector);
  const field = name => find(`[data-field="${name}"]`);
  const action = name => find(`[data-action="${name}"]`);
  const panels = [
    { name: 'theme', element: find(`#${id}-theme`) },
    { name: 'harmony', element: find(`#${id}-theory`) },
    { name: 'toggle', element: find(`#${id}-tools`) },
  ];
  function renderPanels(noMotion) {
    for (const { name, element } of panels) {
      const visible = activePanel === name;
      action(name).setAttribute('aria-expanded', String(visible));
      const changed = element.dataset.open !== String(visible);
      if (!changed && !noMotion) continue;
      const opacity = element.hidden ? 0 : Number(getComputedStyle(element).opacity);
      panelAnimations.get(element)?.cancel();
      panelAnimations.delete(element);
      element.dataset.open = String(visible);
      element.inert = !visible;
      element.setAttribute('aria-hidden', String(!visible));
      if (!visible && element.contains(document.activeElement)) action(name).focus();
      if (noMotion || (!visible && element.hidden)) {
        element.hidden = !visible;
        continue;
      }
      element.hidden = false;
      const animation = element.animate([{ opacity }, { opacity: visible ? 1 : 0 }], {
        duration: 200, easing: 'ease', fill: 'forwards',
      });
      panelAnimations.set(element, animation);
      animation.finished.then(() => {
        if (panelAnimations.get(element) !== animation) return;
        element.hidden = !visible;
        animation.cancel();
        panelAnimations.delete(element);
      }, error => {
        // Rapid toggles and cleanup intentionally cancel superseded animations.
        if (error.name !== 'AbortError') report(error.message, true);
      });
    }
  }
  function togglePanel(name) {
    activePanel = activePanel === name ? null : name;
    render();
  }
  const notificationBar = mountNotificationBar(find('[data-notification-bar]'), {
    service: notificationService, matchHeight: find('.tm-control-bar'),
    enabled: config.themeManager?.notificationsEnabled ?? true,
  });
  const report = (message, error = false) => {
    if (destroyed) return;
    notificationService.publish({ message, source: 'Theme manager', level: error ? 'error' : 'info' });
  };
  function snapshot() {
    return adapter.validate({ ...config, name: field('name').value.trim(), customCss: field('css').value, themeManager: { ...config.themeManager, locked } });
  }
  function updateHarmony(changes) {
    if (busy) return;
    const effective = host.dataset.tmTheme;
    config = adapter.withHarmony({ ...config, themeManager: { ...config.themeManager, locked } }, changes, effective);
    field('colour').removeAttribute('aria-invalid');
    render();
    report(changes.select !== undefined ? `Harmony colour ${changes.select + 1} selected as the main accent.` : 'Colour harmony updated.');
  }
  function renderHarmony(effective) {
    const harmony = adapter.harmony(config, effective);
    if (!field('harmony-preset').options.length) {
      field('harmony-preset').replaceChildren(...harmony.presets.map(value => new Option(value.replaceAll('-', ' '), value)));
    }
    field('harmony-preset').value = harmony.preset;
    field('harmony-count').value = harmony.count;
    for (const key of ['h', 's', 'l']) {
      field(`harmony-${key}`).value = harmony.base[key];
      find(`[data-harmony-value="${key}"]`).textContent = `${Number(harmony.base[key].toFixed(1))}${key === 'h' ? ' degrees' : '%'}`;
    }
    const harmonyLocked = !!config.themeManager?.harmonyLocked;
    find('[data-harmony-note]').textContent = locked && harmonyLocked ? 'Both locked. Unlock a padlock to edit its settings.' : locked ? 'Base colour locked. Harmony preset and colour count can change; source controls and accent selection are fixed.' : harmonyLocked ? 'Harmony locked. Change the source colour while keeping the preset and colour count.' : 'Both unlocked. Edit either setting or randomise both.';
    host.querySelectorAll('.tm-theory input, .tm-theory select').forEach(control => { control.disabled = locked || busy; });
    field('button-appearance').disabled = busy;
    for (const name of ['harmony-preset', 'harmony-count']) field(name).disabled = busy || harmonyLocked;
    const container = find('.tm-theory-bar');
    const symbols = ['filter_vintage', 'local_florist', 'ac_unit', 'diamond'];
    while (container.children.length > harmony.count) container.lastElementChild.remove();
    harmony.swatches.forEach((colour, index) => {
      let button = container.children[index];
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'hsw';
        button.dataset.harmonySwatch = index;
        const icon = document.createElement('span');
        icon.className = 'tm-symbol';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = symbols[index % symbols.length];
        button.append(icon);
        container.append(button);
      }
      button.disabled = locked || busy;
      button.style.setProperty('--swatch-color', colourText(colour));
      button.style.setProperty('--swatch-foreground', sourceForeground(colour));
      const label = `${index ? 'Colour ' + (index + 1) : 'Base'}: ${Number(colour.h.toFixed(1))} degrees. Use as main accent`;
      button.setAttribute('aria-label', label);
      button.title = label;
      button.setAttribute('aria-pressed', String(harmony.selected === index));
    });
  }
  function render() {
    const mode = config.themeMode ?? 'system';
    const appearance = config.themeManager?.appearance ?? mode;
    const effective = appearance === 'system' ? (media.matches ? 'dark' : 'light') : appearance;
    const noMotion = !!config.themeManager?.noMotion || motionMedia.matches;
    const colour = adapter.colour({ ...config, themeMode: effective });
    for (const target of new Set([host, preview])) {
      target.dataset.tmTheme = effective;
      target.dataset.tmNoMotion = String(noMotion);
      target.style.setProperty('--tm-h', colour.h);
      // A minimum saturation keeps interactive text readable even for grey sources.
      target.style.setProperty('--tm-s', Math.max(25, colour.s) + '%');
    }
    host.style.setProperty('--tm-source', colourText(colour));
    host.style.setProperty('--tm-on-source', sourceForeground(colour));
    host.querySelectorAll('input, select, textarea, [data-action]').forEach(control => { control.disabled = busy; });
    host.querySelectorAll('[data-appearance]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.appearance === appearance));
      button.disabled = busy;
    });
    action('no-motion').setAttribute('aria-pressed', String(!!config.themeManager?.noMotion));
    const buttonAppearance = config.themeManager?.buttonAppearance ?? 'inverse';
    host.dataset.tmButtonAppearance = buttonAppearance;
    field('button-appearance').value = buttonAppearance;
    const notificationsEnabled = config.themeManager?.notificationsEnabled ?? true;
    notificationBar.setEnabled(notificationsEnabled);
    action('notifications').setAttribute('aria-pressed', String(notificationsEnabled));
    action('notifications').title = notificationsEnabled ? 'Turn notifications off' : 'Turn notifications on';
    find('[data-notifications-symbol]').textContent = notificationsEnabled ? 'notifications' : 'notifications_off';
    field('colour').disabled = busy || locked;
    action('shuffle').disabled = busy || (locked && !!config.themeManager?.harmonyLocked);
    action('copy').disabled = busy || !built;
    action('load').disabled = !serverTools || busy || !field('schemes').value;
    for (const name of ['refresh', 'save', 'build']) action(name).disabled = !serverTools || busy;
    field('schemes').disabled = !serverTools || busy;
    field('colour').value = colourText(colour);
    const lockLabel = locked ? 'Unlock base colour' : 'Lock base colour';
    action('lock').setAttribute('aria-label', lockLabel);
    action('lock').title = lockLabel;
    action('lock').setAttribute('aria-pressed', String(locked));
    find('[data-lock-symbol]').textContent = locked ? 'lock' : 'lock_open';
    const harmonyLocked = !!config.themeManager?.harmonyLocked;
    const harmonyLockLabel = harmonyLocked ? 'Unlock harmony scheme' : 'Lock harmony scheme';
    action('harmony-lock').setAttribute('aria-label', harmonyLockLabel);
    action('harmony-lock').title = harmonyLockLabel;
    action('harmony-lock').setAttribute('aria-pressed', String(harmonyLocked));
    find('[data-harmony-lock-symbol]').textContent = harmonyLocked ? 'lock' : 'lock_open';
    action('shuffle').title = locked && harmonyLocked ? 'Unlock harmony or base colour to randomise' : locked ? 'Randomise harmony; keep base colour' : harmonyLocked ? 'Randomise base colour; keep harmony' : 'Randomise harmony and base colour';
    renderPanels(noMotion);
    renderHarmony(effective);
    host.setAttribute('aria-busy', String(busy));
    onChange({ config: structuredClone(config), colour, mode, appearance, effectiveMode: effective, noMotion, locked });
  }
  function setConfig(next) {
    config = adapter.validate(next);
    locked = config.themeManager?.locked ?? true;
    field('name').value = config.name;
    field('css').value = config.customCss ?? '';
    field('colour').removeAttribute('aria-invalid');
    built = null;
    find('.tm-downloads').replaceChildren();
    render();
  }
  async function refresh() {
    const names = await adapter.list();
    if (destroyed) return;
    const selected = field('schemes').value;
    field('schemes').replaceChildren(new Option('Choose a scheme', ''), ...names.map(name => new Option(name, name)));
    if (names.includes(selected)) field('schemes').value = selected;
  }
  async function run(task) {
    if (busy || destroyed) return;
    busy = true;
    render();
    try { await task(); }
    catch (error) { report(error.message, true); }
    finally { if (!destroyed) { busy = false; render(); } }
  }
  function download(text, name, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const handlers = {
    'harmony-lock'() {
      const harmonyLocked = !config.themeManager?.harmonyLocked;
      config = { ...config, themeManager: { ...config.themeManager, locked, harmonyLocked } };
      render();
      report(harmonyLocked ? 'Harmony preset and colour count locked.' : 'Harmony scheme unlocked.');
    },
    harmony() { togglePanel('harmony'); },
    notifications() {
      const enabled = !(config.themeManager?.notificationsEnabled ?? true);
      config = { ...config, themeManager: { ...config.themeManager, locked, notificationsEnabled: enabled } };
      render();
      if (enabled) report('Notifications enabled.');
    },
    theme() { togglePanel('theme'); },
    toggle() { togglePanel('toggle'); },
    lock() { locked = !locked; field('colour').removeAttribute('aria-invalid'); render(); report(locked ? 'Colour locked.' : 'Colour unlocked. Enter a colour and press Enter.'); },
    shuffle() {
      config = adapter.randomize({ ...config, themeManager: { ...config.themeManager, locked } }, host.dataset.tmTheme);
      field('colour').removeAttribute('aria-invalid');
      render();
      report(locked ? 'Harmony randomised. Base colour unchanged.' : config.themeManager?.harmonyLocked ? 'Base colour randomised. Harmony unchanged.' : 'Harmony and base colour randomised.');
    },
    refresh: () => run(async () => { await refresh(); report('Saved scheme list refreshed.'); }),
    load: () => run(async () => {
      const next = await adapter.load(field('schemes').value);
      if (destroyed) return;
      setConfig(next);
      report(`Loaded ${config.name}.`);
    }),
    save: () => run(async () => {
      const next = snapshot();
      await adapter.save(next);
      if (destroyed) return;
      config = next;
      report(`Saved ${next.name}.`);
      await refresh();
    }),
    build: () => run(async () => {
      const next = snapshot();
      report(`Saving and building ${next.name}...`);
      const result = await adapter.build(next);
      if (destroyed) return;
      config = next;
      built = result;
      find('.tm-downloads').replaceChildren();
      for (const [key, name] of [['css', 'theme.css'], ['tokens', 'tokens.json']]) {
        const link = document.createElement('a');
        link.href = result[key];
        link.download = name;
        link.textContent = `Download ${name}`;
        find('.tm-downloads').append(link);
      }
      report(`Built ${next.name}. Download the files below.`);
      await refresh();
    }),
    copy: () => run(async () => {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable. Download the built CSS instead.');
      await navigator.clipboard.writeText(await adapter.readCss(built.css));
      report('Built CSS copied.');
    }),
    json() {
      const next = snapshot();
      download(JSON.stringify(next, null, 2) + '\n', next.name + '.json', 'application/json');
      report('Scheme JSON exported.');
    },
  };
  host.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || busy || button.disabled) return;
    try {
      if (button.hasAttribute('data-appearance')) {
        const appearance = button.dataset.appearance;
        config = { ...config, themeMode: appearance === 'contrast' ? 'light' : appearance, themeManager: { ...config.themeManager, locked, appearance } };
        render();
        report(`Mode set to ${appearance}.`);
      } else if (button.dataset.action === 'no-motion') {
        config = { ...config, themeManager: { ...config.themeManager, locked, noMotion: !config.themeManager?.noMotion } };
        render();
        report(config.themeManager.noMotion ? 'No-motion enabled.' : 'Motion follows your system preference.');
      } else if (button.hasAttribute('data-harmony-swatch')) updateHarmony({ select: Number(button.dataset.harmonySwatch) });
      else handlers[button.dataset.action]?.();
    } catch (error) { report(error.message, true); }
  }, { signal: controller.signal });
  field('colour').addEventListener('keydown', event => {
    if (event.key === 'Escape') { field('colour').removeAttribute('aria-invalid'); render(); report('Colour edit cancelled.'); }
    if (event.key !== 'Enter' || locked || busy) return;
    event.preventDefault();
    try {
      config = adapter.withColour(config, parseColour(field('colour').value));
      field('colour').removeAttribute('aria-invalid');
      render();
      report('Source colour applied.');
    } catch (error) {
      field('colour').setAttribute('aria-invalid', 'true');
      report(error.message, true);
    }
  }, { signal: controller.signal });
  host.addEventListener('keydown', event => {
    if (event.key === 'Escape' && activePanel && event.target !== field('colour')) {
      const trigger = activePanel;
      activePanel = null;
      render();
      action(trigger).focus();
    }
  }, { signal: controller.signal });
  host.addEventListener('change', event => {
    if (event.target === field('button-appearance')) {
      config = { ...config, themeManager: { ...config.themeManager, locked, buttonAppearance: event.target.value } };
      render();
      report(`Button appearance set to ${event.target.value}.`);
      return;
    }
    const harmonyField = event.target.dataset.field;
    if (harmonyField?.startsWith('harmony-')) {
      try {
        const key = harmonyField.slice('harmony-'.length);
        updateHarmony({ [key === 'preset' ? 'preset' : key === 'count' ? 'count' : key]: key === 'preset' ? event.target.value : Number(event.target.value) });
      } catch (error) { report(error.message, true); }
      return;
    }
  }, { signal: controller.signal });
  document.addEventListener('click', event => {
    if (activePanel && !host.contains(event.target)) {
      activePanel = null;
      render();
    }
  }, { signal: controller.signal });
  field('schemes').addEventListener('change', render, { signal: controller.signal });
  field('import').addEventListener('change', () => {
    const file = field('import').files[0];
    if (!file) return;
    run(async () => {
      try {
        const record = JSON.parse(await file.text());
        if (destroyed) return;
        setConfig(record.config ?? record);
        report(`Imported ${config.name}. Save to persist it on the server.`);
      } finally { if (!destroyed) field('import').value = ''; }
    });
  }, { signal: controller.signal });
  media.addEventListener('change', render, { signal: controller.signal });
  motionMedia.addEventListener('change', render, { signal: controller.signal });
  setConfig(config);
  if (serverTools) run(async () => {
    if (!/^https?:$/.test(location.protocol)) throw new Error('Studio APIs require HTTP. Run npm start in ab-theme-studio and open http://localhost:5173/site/components/tools/theme-manager/.');
    await refresh();
    report('Connected to the studio. Colour is locked; unlock it to edit.');
  });
  return {
    getState: snapshot,
    destroy() {
      destroyed = true;
      controller.abort();
      for (const animation of panelAnimations.values()) animation.cancel();
      panelAnimations.clear();
      notificationBar.destroy();
      host.replaceChildren();
      host.removeAttribute('data-tm-mounted');
      host.removeAttribute('aria-busy');
      delete host.dataset.tmButtonAppearance;
      if (!previousHostClass) host.classList.remove('tm-manager');
      if (!previousClass) preview.classList.remove('tm-scope');
      for (const { element, theme, motion, styles } of previousTargets) {
        if (motion === null) element.removeAttribute('data-tm-no-motion');
        else element.setAttribute('data-tm-no-motion', motion);
        if (theme === null) element.removeAttribute('data-tm-theme');
        else element.setAttribute('data-tm-theme', theme);
        for (const [key, value, priority] of styles) {
          if (value) element.style.setProperty(key, value, priority);
          else element.style.removeProperty(key);
        }
      }
    },
  };
}
