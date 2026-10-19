import { defaultColorSystem, validateColorSystem, mainColor, COLOR_HARMONIES, harmonyPalette } from '../../.dev/assets/ab-them/public/site/color-system.js';
import { validateTypography } from '../../.dev/assets/ab-them/public/site/typography-system.js';
import { validateSpacing } from '../../.dev/assets/ab-them/public/site/spacing-system.js';
import { validateLayout } from '../../.dev/assets/ab-them/public/site/layout-system.js';
import { validateCards } from '../../.dev/assets/ab-them/public/site/card-system.js';
import { connectorAssets } from '../../.dev/assets/ab-them/public/site/connectors.js';

export function validateScheme(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.name !== 'string' || !/^[a-z0-9_-]+$/i.test(value.name)) {
    throw new Error('Use a scheme name containing only letters, numbers, hyphens or underscores.');
  }
  if (value.themeMode !== undefined && !['light', 'dark', 'system'].includes(value.themeMode)) throw new Error('Invalid theme mode.');
  if (value.customCss !== undefined && typeof value.customCss !== 'string') throw new Error('Custom CSS must be text.');
  for (const [key, max] of [['brandH', 360], ['brandS', 100], ['greyS', 40], ['semanticS', 90]]) {
    if (value[key] !== undefined && (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] < 0 || value[key] > max)) throw new Error(`Invalid ${key}.`);
  }
  if (value.themeManager !== undefined && (!value.themeManager || typeof value.themeManager.locked !== 'boolean')) throw new Error('Invalid theme-manager lock setting.');
  if (value.themeManager?.appearance !== undefined && !['light', 'dark', 'contrast', 'system'].includes(value.themeManager.appearance)) throw new Error('Invalid theme-manager appearance.');
  if (value.themeManager?.noMotion !== undefined && typeof value.themeManager.noMotion !== 'boolean') throw new Error('Invalid no-motion preference.');
  if (value.themeManager?.notificationsEnabled !== undefined && typeof value.themeManager.notificationsEnabled !== 'boolean') throw new Error('Invalid notification preference.');
  if (value.themeManager?.harmonyLocked !== undefined && typeof value.themeManager.harmonyLocked !== 'boolean') throw new Error('Invalid harmony-lock preference.');
  if (value.themeManager?.buttonAppearance !== undefined && !['inverse', 'shaded', 'outline', 'ghost', 'soft'].includes(value.themeManager.buttonAppearance)) throw new Error('Invalid button appearance.');
  validateColorSystem(value.colorSystem ?? defaultColorSystem(value));
  validateTypography(value.typography);
  validateSpacing(value.spacing);
  validateLayout(value.layout);
  validateCards(value.cards);
  if (value.connectors !== undefined) connectorAssets(value.connectors);
  return structuredClone(value);
}

export function schemeColour(config) {
  const state = config.colorSystem ?? defaultColorSystem(config);
  const colour = mainColor(state);
  return { ...colour, l: colour.l ?? (config.themeMode === 'dark' ? state.dark.strong : state.light.strong) };
}

export function withSchemeColour(config, colour) {
  const next = structuredClone(config);
  const system = next.colorSystem ?? defaultColorSystem(next);
  system.baseColor = { ...colour };
  next.colorSystem = system;
  next.brandH = colour.h;
  next.brandS = colour.s;
  next.greyS = colour.gs;
  return validateScheme(next);
}

export function schemeHarmony(config, mode = config.themeMode) {
  const system = config.colorSystem ?? defaultColorSystem(config);
  validateColorSystem(system);
  const foundation = system.baseColor ?? system.brand;
  const base = { ...foundation, l: foundation.l ?? (mode === 'dark' ? system.dark.strong : system.light.strong) };
  const swatches = harmonyPalette(system).map(entry => ({
    h: (base.h + entry.offset + 360) % 360,
    s: Math.round(base.s * (entry.saturation ?? 1) * 10) / 10,
    l: entry.absoluteLightness ?? Math.max(10, Math.min(90, base.l + entry.lightness)),
    gs: base.gs,
  }));
  return {
    presets: Object.keys(COLOR_HARMONIES), preset: system.harmony,
    count: system.harmonyCount ?? 4, base, swatches,
    selected: !system.baseColor && system.main === 'harmony' && system.mainShade ? system.harmonyHue - 1 : -1,
  };
}

export function withSchemeHarmony(config, changes, mode) {
  if (config.themeManager?.harmonyLocked && (changes.preset !== undefined || changes.count !== undefined)) {
    throw new Error('Unlock the harmony scheme to change its preset or colour count.');
  }
  if (config.themeManager?.locked && ['h', 's', 'l', 'select'].some(key => changes[key] !== undefined)) {
    throw new Error('Unlock the base colour to edit it or select another accent.');
  }
  const next = structuredClone(config);
  const system = next.colorSystem ?? defaultColorSystem(next);
  next.colorSystem = system;
  const hadSelection = system.main === 'harmony' && !!system.mainShade && !system.baseColor;
  if (changes.preset !== undefined) system.harmony = changes.preset;
  if (changes.count !== undefined) {
    system.harmonyCount = changes.count;
    system.harmonyHue = Math.min(system.harmonyHue, changes.count);
    if (config.themeManager?.locked && system.mainShade?.family === 'harmony') system.mainShade.step = system.harmonyHue;
  }
  if (changes.h !== undefined || changes.s !== undefined || changes.l !== undefined) {
    const base = schemeHarmony(config, mode).base;
    const updated = { ...base, ...Object.fromEntries(['h', 's', 'l'].filter(key => changes[key] !== undefined).map(key => [key, changes[key]])) };
    system.brand = { ...system.brand, h: updated.h, s: updated.s, l: updated.l, gs: updated.gs };
    if (system.baseColor) system.baseColor = updated;
    else {
      system.light.strong = updated.l;
      system.dark.strong = updated.l;
    }
  }
  if (!system.included.includes('harmony')) system.included.push('harmony');
  const selection = changes.select ?? (hadSelection && !config.themeManager?.locked ? system.harmonyHue - 1 : undefined);
  if (selection !== undefined) {
    if (!Number.isInteger(selection) || selection < 0 || selection >= (system.harmonyCount ?? 4)) throw new Error('Choose a valid harmony swatch.');
    delete system.mainShade;
    const palette = schemeHarmony(next, mode);
    // Keep the foundation stable when a fixed pasted source becomes a selected accent.
    system.brand = { ...system.brand, h: palette.base.h, s: palette.base.s, l: palette.base.l, gs: palette.base.gs };
    system.light.strong = Math.max(20, Math.min(80, palette.base.l));
    system.dark.strong = system.light.strong;
    delete system.baseColor;
    system.main = 'harmony';
    system.harmonyHue = selection + 1;
    system.mainShade = { family: 'harmony', step: selection + 1, ...palette.swatches[selection] };
  }
  next.harmony = system.harmony;
  return validateScheme(next);
}

export function randomizeScheme(config, mode, random = Math.random) {
  const baseLocked = config.themeManager?.locked ?? true;
  const harmonyLocked = config.themeManager?.harmonyLocked ?? false;
  if (baseLocked && harmonyLocked) throw new Error('Unlock the harmony scheme or base colour to randomise.');
  let next = structuredClone(config);
  if (!baseLocked) {
    next = withSchemeColour(next, { h: Math.floor(random() * 360), s: 45 + Math.floor(random() * 40), l: 35 + Math.floor(random() * 25), gs: 12 });
  }
  if (!harmonyLocked) {
    const current = schemeHarmony(next, mode);
    const alternatives = current.presets.filter(preset => preset !== current.preset);
    next = withSchemeHarmony(next, {
      preset: alternatives[Math.floor(random() * alternatives.length)],
      count: 3 + Math.floor(random() * 8),
    }, mode);
  }
  return validateScheme(next);
}

export function createStudioAdapter({ baseUrl = '', fetcher = globalThis.fetch } = {}) {
  async function request(path, options) {
    const response = await fetcher(baseUrl + path, options);
    if (!response.ok) throw new Error(`Studio request failed (${response.status}): ${await response.text()}`);
    return response;
  }
  return {
    validate: validateScheme,
    colour: schemeColour,
    withColour: withSchemeColour,
    harmony: schemeHarmony,
    withHarmony: withSchemeHarmony,
    randomize: randomizeScheme,
    async list() {
      const names = await (await request('/api/themes')).json();
      if (!Array.isArray(names) || !names.every(name => typeof name === 'string' && /^[a-z0-9_-]+$/i.test(name))) throw new Error('The studio returned an invalid scheme list.');
      return names;
    },
    async load(name) {
      if (!/^[a-z0-9_-]+$/i.test(name)) throw new Error('Choose a valid saved scheme.');
      return validateScheme(await (await request('/api/themes/' + encodeURIComponent(name))).json());
    },
    async save(config) {
      validateScheme(config);
      const result = await (await request('/api/themes/' + encodeURIComponent(config.name), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config),
      })).json();
      if (result.ok !== true) throw new Error('The studio did not confirm the save.');
    },
    async build(config) {
      await this.save(config);
      const result = await (await request('/api/build/' + encodeURIComponent(config.name), { method: 'POST' })).json();
      if (result.ok !== true) throw new Error('The studio did not confirm the build.');
      const path = baseUrl + '/dist/' + encodeURIComponent(config.name);
      return { css: path + '/theme.css', tokens: path + '/tokens.json' };
    },
    async readCss(url) { return (await request(url.slice(baseUrl.length))).text(); },
  };
}
