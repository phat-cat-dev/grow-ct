(function () {
  'use strict';
  const kind = document.body.dataset.maker;
  if (!['card', 'callout'].includes(kind)) throw new Error('Unknown component maker.');
  const variants = { themed: 'Themed family', plain: 'Plain neutral border', positive: 'Positive / advice / do', neutral: 'Neutral / amber', negative: 'Negative / warning / dont', comment: 'Comment / starting', info: 'Info / action' };
  const semantics = { positive: 150, neutral: 38, negative: 5, comment: 270, info: 200 };
  const defaults = { family: 'brand', variant: 'themed', fill: 'tinted', hue: 202, saturation: 72, grey: 12, lightness: 42, semanticS: 55, semanticL: 38, theme: 'system', radius: 14, border: 1, bar: 4, pad: 20, titleSize: 22, iconSize: 32, icon: kind === 'callout' ? 'info' : 'none', header: true, footer: true, shadow: true, heading: 'h3', title: kind === 'card' ? 'A useful next step' : 'Good to know', text: 'One accent sets the tone. Use this space for a clear explanation, helpful detail or a next step.', headerText: 'Learning resource', footerText: 'Keep exploring' };
  let state = { ...defaults };
  const fields = [
    ['family', 'Colour family', { brand: 'Brand', grey: 'Colour-grey', gray: 'Pure grey' }],
    ['variant', 'Variant', variants], ['fill', 'Fill style', { plain: 'Plain surface', tinted: 'Tinted', soft: 'Soft', invert: 'Invert' }],
    ['hue', 'Main hue', 0, 360, 1, 'degrees'], ['saturation', 'Brand saturation', 0, 100, 1, '%'], ['grey', 'Colour-grey saturation', 0, 40, 1, '%'],
    ['lightness', 'Family accent lightness', 15, 80, 1, '%'], ['semanticS', 'Semantic saturation', 0, 100, 1, '%'], ['semanticL', 'Semantic lightness', 15, 80, 1, '%'],
    ['theme', 'Preview and export surface', { system: 'System light / dark', light: 'Light', dark: 'Dark' }],
    ['radius', 'Corner radius', 0, 40, 1, 'px'], ['border', 'Border width', 0, 5, 1, 'px'],
    ...(kind === 'callout' ? [['bar', 'Accent bar width', 0, 12, 1, 'px']] : []),
    ['pad', 'Content padding', 8, 48, 1, 'px'], ['titleSize', 'Title size', 16, 36, 1, 'px'],
    ['icon', 'Optional icon', { none: 'No icon', info: 'Info', check: 'Check', warning: 'Warning', note: 'Note', arrow: 'Arrow' }],
    ['iconSize', 'Icon size', 16, 64, 1, 'px'], ['heading', 'Title heading level', { h2: 'H2', h3: 'H3', h4: 'H4' }],
    ...(kind === 'card' ? [['header', 'Include header', 'checkbox'], ['footer', 'Include footer', 'checkbox']] : []),
    ['shadow', 'Soft shadow', 'checkbox'], ['title', 'Title', 'text'], ['text', 'Body text', 'textarea'],
    ...(kind === 'card' ? [['headerText', 'Header text', 'text'], ['footerText', 'Footer text', 'text']] : []),
  ];
  const inputs = new Map();
  fields.forEach(([key, name, type, max, step, unit]) => {
    const label = document.createElement('label');
    label.append(document.createTextNode(name));
    const input = document.createElement(typeof type === 'object' ? 'select' : type === 'textarea' ? 'textarea' : 'input');
    input.name = key; input.id = `maker-${key}`;
    if (typeof type === 'object') Object.entries(type).forEach(([value, text]) => input.add(new Option(text, value)));
    else if (type !== 'textarea') {
      input.type = typeof type === 'number' ? 'range' : type;
      if (typeof type === 'number') { input.min = type; input.max = max; input.step = step; }
    }
    if (type === 'textarea' || type === 'text') input.maxLength = key === 'text' ? 4000 : 150;
    const output = document.createElement('output'); output.htmlFor = input.id;
    label.append(input);
    if (typeof type === 'number') label.append(output);
    inputs.set(key, { input, output, unit });
    document.getElementById('maker-fields').append(label);
    input.addEventListener('input', () => {
      state[key] = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
      render();
    });
  });
  const paths = {
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>',
    warning: '<path d="m12 3 10 18H2Zm0 6v5m0 3v.1"/>',
    note: '<path d="M5 3h14v18H5Zm4 5h6m-6 4h6m-6 4h4"/>',
    arrow: '<path d="M3 12h18m-7-7 7 7-7 7"/>',
  };
  function icon(name) { return name === 'none' ? '' : `<svg class="cm-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`; }
  const esc = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  function component(config) {
    const title = `<${config.heading} class="cm-title">${esc(config.title)}</${config.heading}>`;
    const body = `<p class="cm-text">${esc(config.text)}</p>`;
    const content = kind === 'card'
      ? `${config.header ? `<header class="cm-header">${esc(config.headerText)}</header>` : ''}<div class="cm-body"><div class="cm-title-row">${icon(config.icon)}${title}</div>${body}</div>${config.footer ? `<footer class="cm-footer">${esc(config.footerText)}</footer>` : ''}`
      : `<div class="cm-callout-row">${icon(config.icon)}<div class="cm-content">${title}${body}</div></div>`;
    return `<${kind === 'card' ? 'article' : 'aside'} class="cm-${kind} cm-family-${config.family} cm-variant-${config.variant} cm-fill-${config.fill}">${content}</${kind === 'card' ? 'article' : 'aside'}>`;
  }
  function bestInk(hue, saturation, lightness) {
    const l = lightness / 100, a = saturation / 100 * Math.min(l, 1 - l);
    const rgb = [0, 8, 4].map(n => {
      const k = (n + hue / 30) % 12;
      const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
    });
    return rgb.reduce((sum, c, index) => sum + c * [.2126, .7152, .0722][index], 0) > .179 ? '#000' : '#fff';
  }
  function css() {
    const s = state, root = `.cm-${kind}`;
    return `${root}{--cm-h:${s.hue};--cm-s:${s.saturation}%;--cm-gs:${s.grey}%;--cm-l:${s.lightness}%;--cm-paper:var(--surface-1,light-dark(#fff,#1d2932));--cm-ink:var(--ink,light-dark(#24323c,#e9f0f5));--cm-line:var(--line,light-dark(#c7d5df,#4f6473));--cm-accent:hsl(var(--cm-h) var(--cm-s) var(--cm-l));--cm-on-accent:${bestInk(s.hue,s.saturation,s.lightness)};--cm-pad:${s.pad}px;--cm-radius:${s.radius}px;color-scheme:${s.theme === 'system' ? 'light dark' : s.theme};box-sizing:border-box;min-width:0;max-width:100%;overflow-wrap:anywhere;border:${s.border}px solid var(--cm-accent);border-radius:var(--cm-radius);background:var(--cm-paper);color:var(--cm-ink);font:1rem/1.6 var(--font-body,var(--font-ui,system-ui,sans-serif));${s.shadow ? 'box-shadow:0 4px 16px #0002;' : ''}${kind === 'callout' ? `padding:var(--cm-pad);border-inline-start:${s.bar}px solid var(--cm-accent);` : ''}}
${root} *{box-sizing:border-box;min-width:0}
${root}.cm-family-grey{--cm-accent:hsl(var(--cm-h) var(--cm-gs) var(--cm-l));--cm-on-accent:${bestInk(s.hue,s.grey,s.lightness)}}
${root}.cm-family-gray{--cm-accent:hsl(var(--cm-h) 0% var(--cm-l));--cm-on-accent:${bestInk(s.hue,0,s.lightness)}}
${root}.cm-variant-plain{--cm-accent:var(--cm-line);--cm-on-accent:var(--cm-ink)}
${Object.entries(semantics).map(([name,hue]) => `${root}.cm-variant-${name}{--cm-accent:hsl(${hue} ${s.semanticS}% ${s.semanticL}%);--cm-on-accent:${bestInk(hue,s.semanticS,s.semanticL)}}`).join('\n')}
${root} .cm-body{padding:var(--cm-pad)}
${root} :is(.cm-title-row,.cm-callout-row){display:flex;gap:1rem;align-items:center}
${root} .cm-content{flex:1}
${root} .cm-icon{flex:none;width:${s.iconSize}px;height:${s.iconSize}px;max-width:30%;color:var(--cm-accent)}
${root} .cm-title{margin:0;font:700 ${s.titleSize}px/1.3 var(--font-heading,var(--font-ui,system-ui,sans-serif));color:inherit}
${root} .cm-text{margin:.65rem 0 0;white-space:pre-wrap}
${root} :is(.cm-header,.cm-footer){padding:calc(var(--cm-pad)*.65) var(--cm-pad);background:color-mix(in srgb,var(--cm-accent) 14%,var(--cm-paper));color:inherit}
${root} .cm-header{border-bottom:1px solid var(--cm-accent);border-radius:var(--cm-radius) var(--cm-radius) 0 0}
${root} .cm-footer{border-top:1px solid var(--cm-accent);border-radius:0 0 var(--cm-radius) var(--cm-radius)}
${root}.cm-fill-tinted{background:color-mix(in srgb,var(--cm-accent) 7%,var(--cm-paper))}
${root}.cm-fill-soft{background:color-mix(in srgb,var(--cm-accent) ${kind === 'card' ? '8' : '15'}%,var(--cm-paper))}
${root}.cm-fill-invert{background:var(--cm-accent);color:var(--cm-on-accent)}
${root}.cm-fill-invert .cm-icon{color:inherit}
${root}.cm-fill-invert :is(.cm-header,.cm-footer){background:transparent}
`;
  }
  function render() {
    inputs.forEach(({ input, output, unit }, key) => {
      if (input.type === 'checkbox') input.checked = state[key]; else input.value = state[key];
      if (input.type === 'range') { output.value = `${state[key]} ${unit}`; input.setAttribute('aria-valuetext', output.value); }
    });
    document.getElementById('maker-generated').textContent = css();
    document.getElementById('specimen').innerHTML = component(state);
    document.getElementById('system-examples').innerHTML = Object.keys(variants).map((variant, index) => component({ ...state, variant, title: variants[variant], text: 'Shared template, independent accent. Family controls never override semantic meaning.', fill: index === 0 ? state.fill : ['plain','tinted','soft','invert'][index % 4] })).join('');
    document.getElementById('maker-html').value = component(state);
    document.getElementById('maker-css').value = css();
    document.getElementById('specimen-status').textContent = `${state.variant} / ${state.family} / ${state.fill}. ${state.icon === 'none' ? 'No icon.' : `${state.icon} icon.`} Invert chooses black or white text from accent luminance; check host overrides and blended states in your destination theme.`;
  }
  const form = document.getElementById('maker-controls');
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('reset', event => { event.preventDefault(); state = { ...defaults }; render(); document.getElementById('maker-export-status').textContent = 'Modifiers reset.'; });
  function download(content, type, name) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    document.getElementById('maker-export-status').textContent = `${name} exported.`;
  }
  document.querySelectorAll('[data-export]').forEach(button => button.addEventListener('click', async () => {
    const type = button.dataset.export;
    if (type === 'copy') {
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable.');
        await navigator.clipboard.writeText(`<style>${css()}</style>\n${component(state)}`);
        document.getElementById('maker-export-status').textContent = 'HTML and scoped CSS copied.';
      } catch (error) { document.getElementById('maker-export-status').textContent = `Could not copy: ${error.message} Download HTML or copy the output fields manually.`; }
    } else if (type === 'css') download(css(), 'text/css', `${kind}.css`);
    else if (type === 'json') download(JSON.stringify({ version:1, kind, settings:state }, null, 2), 'application/json', `${kind}-settings.json`);
    else download(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${kind} specimen</title><style>${css()}</style></head><body>${component(state)}</body></html>`, 'text/html', `${kind}-specimen.html`);
  }));
  render();
})();
