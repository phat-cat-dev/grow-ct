// Pure engine for the animation manager: turns catalog entries + instance
// options into (a) the base stylesheet every mark needs, (b) a ready-to-paste
// markup string, and (c) validated manager settings. No DOM access here so the
// same functions back the live preview, the copy/export buttons and the bundle.

import { CATALOG, COLOR_ROLES, findAnimation } from './animation-catalog.js';

export { CATALOG, COLOR_ROLES, findAnimation };

const ROLE_IDS = COLOR_ROLES.map(([id]) => id);

// Hidden SVG filter that gives every ink stroke its hand-drawn wobble. Inject
// once per page; the id is referenced by `filter:url(#am-ink)` in the base CSS.
export const INK_FILTER_SVG =
  '<svg width="0" height="0" style="position:absolute" aria-hidden="true" data-am-filter>' +
  '<filter id="am-ink" x="-20%" y="-20%" width="140%" height="140%">' +
  '<feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="2" seed="4" result="n"/>' +
  '<feDisplacementMap in="SourceGraphic" in2="n" scale="2"/></filter></svg>';

// Handwriting faces used by the note marks. Load once per page.
export const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Kalam:wght@400;700&display=swap';

export const DEFAULT_BAND = { top: 52, height: 42, pad: 0.14 };

const RANGES = {
  speed: [0.4, 2.5], scale: [0.3, 3], rotation: [-45, 45],
  repeats: [1, 10], jitter: [0, 10],
  'band.top': [20, 70], 'band.height': [12, 64], 'band.pad': [0.02, 0.6],
};

const clamp = (value, [min, max]) => Math.min(max, Math.max(min, value));

export function defaultOptions(entry) {
  const found = typeof entry === 'string' ? findAnimation(entry) : entry;
  return {
    speed: 1, scale: 1, rotation: 0, repeats: 3, jitter: 3,
    color: found?.color ?? 'accent',
    band: { ...DEFAULT_BAND },
  };
}

export function defaultSettings() {
  return {
    selected: CATALOG[0].id,
    ...defaultOptions(CATALOG[0]),
    applied: true,
    notificationsEnabled: true,
  };
}

export function validateSettings(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Animation manager settings must be an object.');
  }
  const base = defaultSettings();
  const selected = value.selected ?? base.selected;
  if (!findAnimation(selected)) throw new RangeError(`Unknown animation "${selected}".`);
  const color = value.color ?? base.color;
  if (!ROLE_IDS.includes(color)) throw new RangeError(`Unknown colour role "${color}".`);
  const number = (key, fallback) => {
    const raw = value[key] ?? fallback;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) throw new TypeError(`${key} must be a number.`);
    return clamp(raw, RANGES[key]);
  };
  const band = { ...DEFAULT_BAND, ...(value.band ?? {}) };
  const state = {
    selected, color,
    speed: number('speed', base.speed),
    scale: number('scale', base.scale),
    rotation: number('rotation', base.rotation),
    repeats: Math.round(number('repeats', base.repeats)),
    jitter: number('jitter', base.jitter),
    band: {
      top: clamp(Number(band.top) || DEFAULT_BAND.top, RANGES['band.top']),
      height: clamp(Number(band.height) || DEFAULT_BAND.height, RANGES['band.height']),
      pad: clamp(Number(band.pad) || DEFAULT_BAND.pad, RANGES['band.pad']),
    },
    applied: value.applied ?? base.applied,
    notificationsEnabled: value.notificationsEnabled ?? base.notificationsEnabled,
  };
  for (const key of ['applied', 'notificationsEnabled']) {
    if (typeof state[key] !== 'boolean') throw new TypeError(`${key} must be true or false.`);
  }
  return state;
}

// Inline custom properties / colour for one instance, as a `style` value.
export function instanceStyle(entry, options = {}) {
  const opts = validateSettings({ ...defaultOptions(entry), ...options, selected: entry.id });
  const parts = [];
  if (Math.abs(opts.speed - 1) > 1e-6) parts.push(`--am-rate:${round(opts.speed)}`);
  if (Math.abs(opts.scale - 1) > 1e-6) parts.push(`--am-scale:${round(opts.scale)}`);
  if (Math.abs(opts.rotation) > 1e-6) parts.push(`--am-rot:${round(opts.rotation)}deg`);
  if (opts.repeats > 1) {
    for (let i = 1; i < opts.repeats; i++) {
      parts.push(`--am-turn-${i}:${round((Math.random() * 2 - 1) * opts.jitter)}deg`);
    }
  }
  const colorToken = `var(--am-c-${opts.color})`;
  if (entry.kind === 'hl') {
    parts.push(`--c:${colorToken}`);
    const band = { ...DEFAULT_BAND, ...(opts.band ?? {}) };
    if (band.top !== DEFAULT_BAND.top) parts.push(`--hl-top:${round(band.top)}%`);
    if (band.height !== DEFAULT_BAND.height) parts.push(`--hl-h:${round(band.height)}%`);
    if (band.pad !== DEFAULT_BAND.pad) parts.push(`--hl-pad:${round(band.pad)}em`);
  } else if (entry.themed !== false) {
    parts.push(`color:${colorToken}`);
  }
  return parts.join(';');
}

const round = value => Number(Number(value).toFixed(3));
const escapeHtml = text => String(text).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// Full markup string for one mark. `text` fills a text-bearing mark; `over`
// fills the correction's replacement word. `play` adds the run class so the
// mark draws itself on when it first appears.
export function instanceMarkup(entry, options = {}) {
  const found = typeof entry === 'string' ? findAnimation(entry) : entry;
  if (!found) throw new Error('Unknown animation.');
  const { text, over, play = true } = options;
  const { repeats } = validateSettings({ ...options, selected: found.id });
  const style = instanceStyle(found, options);
  const attrs = style ? ` style="${style}"` : '';
  const run = play ? ' am-run' : '';
  const finish = markup => {
    let result = markup;
    if (!play) result = result.replace(/\bam-run\b/g, '');
    else result = result.replace(/class="am-item(?! am-run)/, 'class="am-item am-run');
    if (repeats > 1) {
      result = result.replace(/^<(\w+)/, `<$1 data-am-repeat="${repeats}"`);
      result = result.replace(/<[^>]+class="am-ink"[^>]*>/g, tag => {
        const delay = Number(tag.match(/--am-d:([\d.]+)s/)?.[1] ?? 0);
        return tag.replace('class="am-ink"', `class="am-ink" data-am-delay="${delay}"`);
      });
    }
    return result;
  };

  if (found.html) {
    // Note templates carry their own run class on the element that animates.
    const content = escapeHtml(text ?? found.sample ?? found.name);
    return finish(found.html
      .replace('{{attrs}}', attrs)
      .replace('{{text}}', content)
      .replace('{{over}}', escapeHtml(over ?? found.over ?? '')));
  }

  const preserve = found.stretch ? ' preserveAspectRatio="none"' : '';
  if (found.kind === 'wrap') {
    const content = escapeHtml(text ?? found.sample ?? found.name);
    return finish(`<span class="am-item${run} am-mk pos-${found.pos}"${attrs}>${content}` +
      `<svg viewBox="${found.vb}"${preserve}>${found.svg}</svg></span>`);
  }
  const extra = found.kind === 'wide' && found.maxw ? ' am-rect' : '';
  const cls = found.kind === 'wide' ? `am-item${run} am-wide${extra}` : `am-item${run} am-glyph`;
  return finish(`<svg class="${cls}" viewBox="${found.vb}"${preserve}${attrs}>${found.svg}</svg>`);
}

function repeatCss() {
  // A shared cycle keeps staggered strokes and per-pass tilts in sync, even in
  // exported snippets that have no JavaScript runtime.
  const delays = [...new Set([0, ...CATALOG.flatMap(entry =>
    [...(entry.svg || entry.html || '').matchAll(/--am-d:([\d.]+)s/g)].map(match => Number(match[1])))])];
  const cycle = Math.max(...delays) + .8 + .35;
  const percent = seconds => `${round(seconds / cycle * 100)}%`;
  const css = [];
  for (const delay of delays) {
    const name = `am-repeat-draw-${Math.round(delay * 1000)}`;
    css.push(`.am-item[data-am-repeat].am-run .am-ink[data-am-delay="${delay}"] {
  animation: ${name} calc(${cycle}s / var(--am-rate, 1)) ease 0s var(--am-repeats) backwards;
}
@keyframes ${name} {
  0%, ${percent(delay)} { stroke-dashoffset: 1; }
  ${percent(delay + .6)}, 100% { stroke-dashoffset: 0; }
}`);
  }
  for (let count = 2; count <= 10; count++) {
    const turns = Array.from({ length: count }, (_, i) =>
      `${round(i / count * 100)}% { rotate: var(--am-turn-${i}, 0deg); }`).join('\n');
    css.push(`.am-item[data-am-repeat="${count}"] { --am-repeats: ${count}; --am-turn-animation: am-turn-${count} calc(${round(cycle * count)}s / var(--am-rate, 1)) steps(1, end) both; }
@keyframes am-turn-${count} {
${turns}
100% { rotate: var(--am-turn-${count - 1}, 0deg); }
}`);
  }
  css.push(`.am-item[data-am-repeat].am-run { animation: var(--am-turn-animation); }
.am-item[data-am-repeat].am-run .am-wipe {
  animation: am-repeat-wipe calc(${cycle}s / var(--am-rate, 1)) ease 0s var(--am-repeats) backwards;
}
.am-item[data-am-repeat].am-run .am-stretchwrap {
  animation: am-repeat-stretch calc(${cycle}s / var(--am-rate, 1)) ease 0s var(--am-repeats) backwards;
}
.am-item[data-am-repeat].am-hl.am-run {
  animation: var(--am-turn-animation), am-repeat-highlight calc(${cycle}s / var(--am-rate, 1)) ease 0s var(--am-repeats) backwards;
}
@keyframes am-repeat-wipe { 0% { transform: scaleX(0); } ${percent(.6)}, 100% { transform: scaleX(1); } }
@keyframes am-repeat-stretch { 0% { transform: scaleX(.12); } ${percent(.8)}, 100% { transform: scaleX(1); } }
@keyframes am-repeat-highlight { 0% { background-size: 0% 100%; } ${percent(.55)}, 100% { background-size: 100% 100%; } }`);
  css.push('.am-hl, .am-hand, .am-hnote { display: inline-block; }');
  return css.join('\n');
}

// The stylesheet every mark needs. Unscoped so it covers both the manager
// preview and marks injected into the host page. Colour roles resolve against
// the page's theme tokens, with self-contained fallbacks.
export function baseCss() {
  return `.am-item{
  --am-c-accent: var(--accent, #365f80);
  --am-c-positive: var(--c-positive, hsl(150 55% 40%));
  --am-c-negative: var(--c-negative, hsl(5 65% 52%));
  --am-c-neutral: var(--c-neutral, hsl(40 70% 46%));
  --am-c-comment: var(--c-comment, hsl(270 45% 54%));
  --am-c-pen: var(--pen, hsl(5 72% 54%));
  --am-c-ink: var(--ink, #222);
  --am-font-hand: "Caveat", "Segoe Script", cursive;
  --am-font-note: "Kalam", var(--font-ui, system-ui), sans-serif;
  transform: rotate(var(--am-rot, 0deg));
}
.am-ink { fill: none; stroke: currentColor; stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; stroke-dashoffset: 0; filter: url(#am-ink); }
.am-dash { fill: none; stroke: currentColor; stroke-linecap: round; }
.am-run .am-ink { animation: am-draw calc(.6s / var(--am-rate, 1)) ease var(--am-d, 0s) both; }
@keyframes am-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
.am-dot { fill: currentColor; transform-box: fill-box; transform-origin: center; filter: url(#am-ink); }
@keyframes am-dotpop { 0% { transform: scale(0); opacity: 0; } 70% { transform: scale(1.18); } 100% { transform: scale(1); opacity: 1; } }
.am-run .am-dot { animation: am-dotpop calc(.4s / var(--am-rate, 1)) cubic-bezier(.3, 1.4, .5, 1) calc(var(--am-d, 0s) + .36s) both; }

.am-mk { position: relative; display: inline-block; font-weight: 700; font-size: calc(1.35rem * var(--am-scale, 1)); color: var(--am-c-ink); padding: .12em .18em; white-space: nowrap; line-height: 1.3; }
.am-mk svg { position: absolute; overflow: visible; pointer-events: none; color: inherit; }
.am-mk.pos-u svg, .am-mk.pos-uu svg, .am-mk.pos-wav svg, .am-mk.pos-scr svg { left: -4%; bottom: -.22em; width: 108%; height: .5em; }
.am-mk.pos-uu svg { height: .7em; }
.am-mk.pos-str svg { left: -4%; top: 42%; width: 108%; height: .4em; }
.am-mk.pos-ov svg { left: -12%; top: -30%; width: 124%; height: 160%; }
.am-mk.pos-box svg { left: -10%; top: -26%; width: 120%; height: 152%; }
.am-mk.pos-brk svg { left: -14%; top: -20%; width: 128%; height: 140%; }
.am-mk.pos-bigoval { font-size: calc(1.5rem * var(--am-scale, 1)); padding: .15em .7em; }
.am-mk.pos-bigoval svg { left: -4%; top: -45%; width: 108%; height: 190%; }

.am-glyph { display: inline-block; vertical-align: middle; width: calc(52px * var(--am-scale, 1)); height: calc(52px * var(--am-scale, 1)); color: var(--am-c-accent); }

.am-wide { display: block; width: 100%; max-width: calc(400px * var(--am-scale, 1)); height: auto; color: var(--am-c-accent); }
.am-wide.am-rect { max-width: calc(150px * var(--am-scale, 1)); }
.am-wipe { transform-origin: left center; }
.am-run .am-wipe { animation: am-wipe calc(.6s / var(--am-rate, 1)) ease both; }
@keyframes am-wipe { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.am-stretchwrap { transform-origin: left center; }
.am-run .am-stretchwrap { animation: am-stretch calc(.8s / var(--am-rate, 1)) ease both; }
@keyframes am-stretch { from { transform: scaleX(.12); } to { transform: scaleX(1); } }

.am-hl { --c: var(--am-c-accent); --hl-top: 52%; --hl-h: 42%; --hl-pad: .14em; font-weight: 700; font-size: calc(1.35rem * var(--am-scale, 1)); background: linear-gradient(to bottom, transparent var(--hl-top), color-mix(in srgb, var(--c) 40%, transparent) var(--hl-top), color-mix(in srgb, var(--c) 40%, transparent) calc(var(--hl-top) + var(--hl-h)), transparent calc(var(--hl-top) + var(--hl-h))); background-repeat: no-repeat; background-position: left center; background-size: 100% 100%; padding-inline: var(--hl-pad); margin-inline: calc(var(--hl-pad) * -1); border-radius: 3px; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
.am-hl.am-run { animation: am-hlsweep calc(.55s / var(--am-rate, 1)) ease both; }
@keyframes am-hlsweep { from { background-size: 0% 100%; } to { background-size: 100% 100%; } }

.am-hand { font-family: var(--am-font-hand); font-weight: 700; font-size: calc(2rem * var(--am-scale, 1)); line-height: 1.1; color: var(--am-c-accent); }
.am-hnote { font-family: var(--am-font-note); font-size: calc(1.05rem * var(--am-scale, 1)); color: var(--am-c-ink); }
.am-marginnote { display: inline-block; font-family: var(--am-font-hand); font-size: calc(1.45rem * var(--am-scale, 1)); color: var(--am-c-pen); --am-rot: -4deg; }
.am-teacher { display: inline-flex; align-items: center; gap: 6px; font-family: var(--am-font-hand); font-size: calc(1.6rem * var(--am-scale, 1)); color: var(--am-c-pen); }
.am-teacher .am-teacher-tick { width: 1.1em; height: 1.1em; flex: none; color: var(--am-c-positive); }
.am-corr { position: relative; display: inline-block; font-weight: 600; }
.am-corr .am-mk { font-size: inherit; font-weight: inherit; color: var(--am-c-negative); padding-inline: 0; }
.am-corr .am-over { position: absolute; left: 50%; bottom: 120%; transform: translateX(-50%) rotate(-3deg); font-family: var(--am-font-hand); font-size: calc(1.3rem * var(--am-scale, 1)); color: var(--am-c-accent); white-space: nowrap; }
.am-sticky { display: inline-block; background: #fff3a8; color: #3a361f; font-family: var(--am-font-note); padding: 14px 16px; border-radius: 2px; box-shadow: 0 8px 16px -8px rgba(0, 0, 0, .35); --am-rot: -2deg; max-width: 220px; }
.am-checkitem { display: inline-flex; align-items: center; gap: .6rem; font-family: var(--am-font-note); font-size: calc(1.05rem * var(--am-scale, 1)); }
.am-checkitem .am-check-tick { width: 1.5em; height: 1.5em; flex: none; color: var(--am-c-positive); }

${repeatCss()}

.no-motion .am-item, [data-tm-no-motion="true"] .am-item,
.no-motion .am-item *, [data-tm-no-motion="true"] .am-item * {
  animation: none !important;
}
@media (prefers-reduced-motion: reduce) {
  .am-item[data-am-repeat] { animation: none !important; }
  .am-run .am-ink, .am-run .am-dot, .am-hl.am-run, .am-run .am-wipe, .am-run .am-stretchwrap { animation: none !important; }
  .am-hl.am-run { background-size: 100% 100%; }
}
`;
}

// A complete, self-contained snippet for the copy / export buttons: the base
// stylesheet, the ink filter, and the mark markup. Paste anywhere.
export function exportSnippet(entry, options = {}) {
  const found = typeof entry === 'string' ? findAnimation(entry) : entry;
  return `<!-- Animation: ${found.name} (${found.id}). Needs the ink filter + stylesheet once per page. -->
${INK_FILTER_SVG}
<style>
${baseCss()}</style>

${instanceMarkup(found, options)}`;
}
