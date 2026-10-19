(function (global) {
  'use strict';
  const presets = {
    dots: 'Dots', grid: 'Grid', stripes: 'Stripes', crosshatch: 'Crosshatch',
    checker: 'Checker', rings: 'Rings', aurora: 'Aurora drift', orbits: 'Floating lights',
  };
  function validate(value = {}) {
    const settings = { preset: 'dots', ink: '#376d87', paper: '#edf4f7', size: 32, thickness: 2, opacity: .3, duration: 18, animated: false, interaction: true, entrance: 'fade', exit: 'fade', enterMs: 700, exitMs: 450, ...value };
    if (!Object.hasOwn(presets, settings.preset)) throw new RangeError('Unknown background preset.');
    for (const key of ['ink', 'paper']) if (!/^#[0-9a-f]{6}$/i.test(settings[key])) throw new TypeError(`${key} must be a six-digit hex colour.`);
    for (const [key, min, max] of [['size', 8, 120], ['thickness', 1, 8], ['opacity', .05, 1], ['duration', 3, 60], ['enterMs', 0, 3000], ['exitMs', 0, 3000]]) {
      if (!Number.isFinite(settings[key]) || settings[key] < min || settings[key] > max) throw new RangeError(`${key} must be between ${min} and ${max}.`);
    }
    if (typeof settings.animated !== 'boolean') throw new TypeError('animated must be boolean.');
    if (typeof settings.interaction !== 'boolean') throw new TypeError('interaction must be boolean.');
    for (const key of ['entrance', 'exit']) if (!['fade', 'rise', 'zoom', 'blur', 'wipe'].includes(settings[key])) throw new RangeError(`Unknown ${key} effect.`);
    return settings;
  }
  function css(value) {
    const s = validate(value);
    const ink = `color-mix(in srgb, var(--pattern-ink) ${Math.round(s.opacity * 100)}%, transparent)`;
    const patterns = {
      dots: `radial-gradient(${ink} ${s.thickness}px, transparent ${s.thickness + .5}px)`,
      grid: `linear-gradient(${ink} ${s.thickness}px, transparent ${s.thickness}px), linear-gradient(90deg, ${ink} ${s.thickness}px, transparent ${s.thickness}px)`,
      stripes: `repeating-linear-gradient(135deg, ${ink} 0 ${s.thickness}px, transparent ${s.thickness}px ${s.size}px)`,
      crosshatch: `repeating-linear-gradient(45deg, ${ink} 0 ${s.thickness}px, transparent ${s.thickness}px ${s.size}px), repeating-linear-gradient(-45deg, ${ink} 0 ${s.thickness}px, transparent ${s.thickness}px ${s.size}px)`,
      checker: `conic-gradient(${ink} 25%, transparent 0 50%, ${ink} 0 75%, transparent 0)`,
      rings: `repeating-radial-gradient(circle at center, transparent 0 ${s.size - s.thickness}px, ${ink} ${s.size - s.thickness}px ${s.size}px)`,
      aurora: `radial-gradient(ellipse at 20% 20%, ${ink}, transparent 60%), radial-gradient(ellipse at 80% 65%, ${ink}, transparent 55%)`,
      orbits: `radial-gradient(circle at 25% 35%, ${ink} 0 12%, transparent 35%), radial-gradient(circle at 70% 70%, ${ink} 0 8%, transparent 30%)`,
    };
    const large = ['aurora', 'orbits', 'rings'].includes(s.preset);
    const hidden = effect => ({
      fade: 'opacity: 0;',
      rise: 'opacity: 0; transform: translateY(3rem);',
      zoom: 'opacity: 0; transform: scale(1.12);',
      blur: 'opacity: 0; filter: blur(14px);',
      wipe: 'opacity: 0; clip-path: inset(0 100% 0 0);',
    })[effect];
    const exitRule = `.pattern-bg:focus-within::before, .pattern-bg:active::before`;
    return `.pattern-bg {
  --pattern-ink: var(--accent, ${s.ink});
  --pattern-paper: ${s.paper};
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: var(--pattern-paper);
}
.pattern-bg::before {
  content: "";
  position: absolute;
  inset: -20%;
  z-index: -1;
  pointer-events: none;
  background-image: ${patterns[s.preset]};
  background-size: ${large ? '100% 100%' : `${s.size}px ${s.size}px`};
  opacity: 1;
  transform: none;
  filter: none;
  clip-path: inset(0);
  transition-property: opacity, transform, filter, clip-path;
  transition-duration: ${s.enterMs}ms;
  transition-timing-function: ease;
  ${s.animated ? `animation: pattern-drift ${s.duration}s ease-in-out infinite alternate;` : ''}
}
@starting-style {
  .pattern-bg::before { ${hidden(s.entrance)} }
}
${s.interaction ? `${exitRule} { ${hidden(s.exit)} transition-duration: ${s.exitMs}ms; }
@media (hover: hover) {
  .pattern-bg:hover::before { ${hidden(s.exit)} transition-duration: ${s.exitMs}ms; }
}` : ''}
@keyframes pattern-drift {
  from { translate: -3% -2%; rotate: -2deg; }
  to { translate: 3% 2%; rotate: 2deg; }
}
.pattern-bg[data-paused="true"]::before { animation-play-state: paused; }
.no-motion .pattern-bg::before,
[data-tm-no-motion="true"] .pattern-bg::before { animation: none !important; transition: none !important; }
@media (prefers-reduced-motion: reduce) {
  .pattern-bg::before { animation: none !important; transition: none !important; }
}
@media print { .pattern-bg::before { animation: none !important; } }`;
  }
  function html(value) {
    const settings = validate(value);
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Background header</title><style>
${css(settings)}
body { margin: 0; font: 1rem/1.6 system-ui,sans-serif; color: #172e3a; }
.pattern-bg { min-height: 65vh; padding: clamp(2rem,8vw,7rem); }
h1 { font-size: clamp(2.5rem,7vw,5rem); line-height: 1.1; max-width: 14ch; }
button { font: inherit; padding: .5rem 1rem; }
</style></head><body>
<header class="pattern-bg"${settings.interaction ? ' tabindex="0" aria-label="Interactive background area"' : ''}><h1>Your next possibility.</h1><p>Replace this with your own introduction.</p>
${settings.animated ? `<button type="button" aria-pressed="false" onclick="const host=this.closest('.pattern-bg');const paused=host.dataset.paused!=='true';host.dataset.paused=String(paused);this.setAttribute('aria-pressed',String(paused));this.textContent=paused?'Resume background':'Pause background';">Pause background</button>` : ''}
</header></body></html>`;
  }
  const api = { presets, validate, css, html };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.BackgroundMaker = api;
})(globalThis);
