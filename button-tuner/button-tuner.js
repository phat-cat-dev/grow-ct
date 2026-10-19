(function () {
  'use strict';
  const shades = { 200: 84, 300: 73, 400: 60, 500: 48, 600: 40, 700: 32, 800: 24, 900: 17 };
  const families = { brand: 'Brand', grey: 'Blue-grey', gray: 'Pure grey' };
  const defaults = { hue: 202, saturation: 72, greySaturation: 12, family: 'brand', shade: '600', mode: 'flip', size: 16, radius: 8, border: 1, paddingX: 20, paddingY: 10, weight: '600', tracking: 0, duration: 200, shadow: false, full: false, disabled: false, label: 'Continue learning', preview: 'normal' };
  let state = { ...defaults };
  const fields = [
    ['hue', 'Hue', 0, 360, 1, 'degrees'], ['saturation', 'Brand saturation', 0, 100, 1, '%'],
    ['greySaturation', 'Blue-grey saturation', 0, 40, 1, '%'],
    ['family', 'Selected family', families], ['shade', 'Selected shade', Object.fromEntries(Object.keys(shades).map(key => [key, key]))],
    ['mode', 'Hover modifier', { flip: 'Inverse flip', shade: 'Shaded', outline: 'Outline', ghost: 'Ghost' }],
    ['size', 'Font size', 12, 32, 1, 'px'], ['radius', 'Corner radius', 0, 48, 1, 'px'],
    ['border', 'Border width', 0, 4, 1, 'px'], ['paddingX', 'Horizontal padding', 4, 48, 1, 'px'],
    ['paddingY', 'Vertical padding', 4, 28, 1, 'px'], ['weight', 'Font weight', { 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold' }],
    ['tracking', 'Letter spacing', 0, 3, .1, 'px'], ['duration', 'Transition duration', 0, 600, 25, 'ms'],
    ['preview', 'Forced preview state', { normal: 'Normal', hover: 'Hover / focus', pressed: 'Pressed' }],
    ['shadow', 'Soft shadow', 'checkbox'], ['full', 'Full-width button', 'checkbox'], ['disabled', 'Disabled button', 'checkbox'], ['label', 'Button label', 'text'],
  ];
  const controls = document.getElementById('controls');
  const inputs = new Map();
  fields.forEach(([key, title, type, max, step, unit]) => {
    const label = document.createElement('label');
    label.append(document.createTextNode(title));
    const input = document.createElement(typeof type === 'object' ? 'select' : 'input');
    input.id = `modifier-${key}`;
    input.name = key;
    if (typeof type === 'object') Object.entries(type).forEach(([value, name]) => input.add(new Option(name, value)));
    else {
      input.type = typeof type === 'number' ? 'range' : type;
      if (typeof type === 'number') { input.min = type; input.max = max; input.step = step; }
      if (type === 'text') input.maxLength = 100;
    }
    const output = document.createElement('output');
    output.htmlFor = input.id;
    label.append(input);
    if (typeof type === 'number') label.append(output);
    document.getElementById('modifier-fields').append(label);
    inputs.set(key, { input, output, unit });
    input.addEventListener('input', () => {
      state[key] = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
      render();
    });
  });
  const matrix = document.getElementById('matrix');
  Object.entries(families).forEach(([family, name]) => {
    const heading = document.createElement('h3');
    heading.className = 'family-heading';
    heading.textContent = `${name}${family === 'gray' ? ' / 0% saturation' : ''}`;
    const row = document.createElement('div');
    row.className = 'swatches';
    Object.keys(shades).forEach(shade => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `bt-button fam-${family} sh-${shade}`;
      button.textContent = shade;
      button.dataset.family = family;
      button.dataset.shade = shade;
      button.setAttribute('aria-label', `Select ${name} shade ${shade}`);
      button.addEventListener('click', () => { state.family = family; state.shade = shade; render(); });
      row.append(button);
    });
    matrix.append(heading, row);
  });
  function rgb(h, s, l) {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    return [0, 8, 4].map(n => {
      const k = (n + h / 30) % 12;
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    });
  }
  function luminance(channels) { return channels.map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, index) => sum + c * [.2126, .7152, .0722][index], 0); }
  function foreground(saturation, lightness) {
    return luminance(rgb(state.hue, saturation, lightness)) > .179 ? '#000' : '#fff';
  }
  function css() {
    const s = state;
    return `.bt-scope{--bt-h:${s.hue};--bt-s:${s.saturation}%;--bt-gs:${s.greySaturation}%;--bt-size:${s.size}px;--bt-radius:${s.radius}px;--bt-border:${s.border}px;--bt-px:${s.paddingX}px;--bt-py:${s.paddingY}px;--bt-duration:${s.duration}ms}
.bt-scope .bt-button{box-sizing:border-box;max-width:100%;min-width:0;overflow-wrap:anywhere;white-space:normal;--bt-sat:var(--bt-s);--bt-light:40%;--bt-fg:#fff;--bt-color:hsl(var(--bt-h) var(--bt-sat) var(--bt-light));font:${s.weight} var(--bt-size)/1.5 system-ui,sans-serif;letter-spacing:${s.tracking}px;padding:var(--bt-py) var(--bt-px);border:var(--bt-border) solid var(--bt-color);border-radius:var(--bt-radius);background:var(--bt-color);color:var(--bt-fg);cursor:pointer;transition:background-color var(--bt-duration),color var(--bt-duration),border-color var(--bt-duration);${s.shadow ? 'box-shadow:0 4px 12px #0003;' : ''}}
.bt-scope .fam-grey{--bt-sat:var(--bt-gs)}.bt-scope .fam-gray{--bt-sat:0%}
${Object.entries(shades).map(([shade, light]) => `.bt-scope .sh-${shade}{--bt-light:${light}%}`).join('\n')}
${Object.keys(families).map(family => Object.entries(shades).map(([shade, light]) => `.bt-scope .fam-${family}.sh-${shade}{--bt-fg:${foreground(family === 'brand' ? s.saturation : family === 'grey' ? s.greySaturation : 0, light)}}`).join('\n')).join('\n')}
.bt-scope .bt-button:focus-visible{outline:3px solid currentColor;outline-offset:3px}
.bt-scope .bt-button:disabled{opacity:.5;cursor:not-allowed}
${s.mode === 'outline' || s.mode === 'ghost' ? `.bt-scope .bt-button{background:transparent;color:var(--bt-color);${s.mode === 'ghost' ? 'border-color:transparent;' : ''}}` : ''}
.bt-scope .bt-button:is(:hover,:focus-visible,[data-preview="hover"]):not(:disabled){${s.mode === 'flip' ? 'background:var(--bt-fg);color:var(--bt-color)' : s.mode === 'shade' ? 'background:color-mix(in srgb,var(--bt-color),#000 14%);border-color:color-mix(in srgb,var(--bt-color),#000 14%);color:var(--bt-fg)' : s.mode === 'outline' ? 'background:var(--bt-color);color:var(--bt-fg)' : 'background:color-mix(in srgb,var(--bt-color) 14%,transparent);color:var(--bt-color)'}}
.bt-scope .bt-button:is(:active,[data-preview="pressed"]):not(:disabled){filter:brightness(.85)}
@media(prefers-reduced-motion:reduce){.bt-scope .bt-button{transition:none}}
${s.full ? '.bt-scope .bt-button.bt-selected{width:100%}' : ''}`;
  }
  function buttonMarkup() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `bt-button bt-selected fam-${state.family} sh-${state.shade}`;
    button.textContent = state.label.trim() || 'Continue learning';
    button.disabled = state.disabled;
    return `<div class="bt-scope">${button.outerHTML}</div>`;
  }
  function render() {
    inputs.forEach(({ input, output, unit }, key) => {
      if (input.type === 'checkbox') input.checked = state[key];
      else input.value = state[key];
      if (input.type === 'range') { output.value = `${state[key]} ${unit}`; input.setAttribute('aria-valuetext', output.value); }
    });
    document.getElementById('button-styles').textContent = css();
    const selected = document.getElementById('selected-button');
    selected.className = `bt-button bt-selected fam-${state.family} sh-${state.shade}`;
    selected.textContent = state.label.trim() || 'Continue learning';
    selected.disabled = state.disabled;
    selected.dataset.preview = state.preview;
    matrix.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.family === state.family && button.dataset.shade === state.shade)));
    document.getElementById('selection-status').textContent = `${families[state.family]}, shade ${state.shade}, ${state.mode} modifier.${state.disabled ? ' Selected button disabled; swatches remain selectable.' : ''}`;
    const saturation = state.family === 'brand' ? state.saturation : state.family === 'grey' ? state.greySaturation : 0;
    const lum = luminance(rgb(state.hue, saturation, shades[state.shade]));
    const ratio = Math.max((lum + .05) / .05, 1.05 / (lum + .05));
    document.getElementById('contrast').textContent = `Solid-state text contrast: ${ratio.toFixed(2)}:1 (${ratio >= 4.5 ? 'meets' : 'below'} WCAG AA normal-text 4.5:1). Outline, ghost, shaded, pressed and disabled states depend on their actual backgrounds; check them in your destination theme.`;
    document.getElementById('markup').value = buttonMarkup();
    document.getElementById('css-output').value = css();
  }
  controls.addEventListener('submit', event => event.preventDefault());
  controls.addEventListener('reset', event => {
    event.preventDefault(); state = { ...defaults }; render();
    document.getElementById('export-status').textContent = 'Modifiers reset to defaults.';
  });
  function download(content, type, name) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    document.getElementById('export-status').textContent = `${name} exported.`;
  }
  document.getElementById('copy').addEventListener('click', async () => {
    const code = `<style>${css()}</style>\n${buttonMarkup()}`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable.');
      await navigator.clipboard.writeText(code);
      document.getElementById('export-status').textContent = 'Scoped CSS and HTML copied.';
    } catch (error) {
      document.getElementById('export-status').textContent = `Could not copy: ${error.message} Use the HTML download or copy the two output fields manually.`;
    }
  });
  document.getElementById('download-html').addEventListener('click', () => download(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Button specimen</title><style>${css()}</style></head><body>${buttonMarkup()}</body></html>`, 'text/html', 'button-specimen.html'));
  document.getElementById('download-json').addEventListener('click', () => {
    const { preview, ...settings } = state;
    download(JSON.stringify({ version: 1, settings }, null, 2), 'application/json', 'button-settings.json');
  });
  render();
})();
