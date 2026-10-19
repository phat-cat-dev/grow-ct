import { DEFAULT_SPACING, SPACING_PROFILES, validateSpacing, spacingCss } from '../../.dev/assets/ab-them/public/site/spacing-system.js';
import { DEFAULT_TYPOGRAPHY, TYPOGRAPHY_RATIOS, TYPOGRAPHY_BULLETS, ACADEMIC_BULLETS, HEADING_HARMONIES, headingSizes, validateTypography, typographyCss } from '../../.dev/assets/ab-them/public/site/typography-system.js';
import { FONT_FAMILIES, DEFAULT_CONNECTORS, connectorAssets } from '../../.dev/assets/ab-them/public/site/connectors.js';

export { SPACING_PROFILES, TYPOGRAPHY_RATIOS, TYPOGRAPHY_BULLETS, ACADEMIC_BULLETS, HEADING_HARMONIES, headingSizes, FONT_FAMILIES };

export function validateSettings(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Manager settings must be an object.');
  const state = {
    spacing: validateSpacing(value.spacing ?? DEFAULT_SPACING),
    typography: validateTypography(value.typography ?? DEFAULT_TYPOGRAPHY),
    connectors: connectorAssets(value.connectors ?? DEFAULT_CONNECTORS).config,
    typeScale: value.typeScale ?? 1,
    spaceScale: value.spaceScale ?? 1,
    hue: value.hue ?? 202,
    saturation: value.saturation ?? 72,
    downstream: value.downstream ?? false,
    notificationsEnabled: value.notificationsEnabled ?? true,
  };
  for (const [key, min, max] of [['typeScale', .5, 2], ['spaceScale', .5, 2], ['hue', 0, 360], ['saturation', 0, 100]]) {
    if (typeof state[key] !== 'number' || !Number.isFinite(state[key]) || state[key] < min || state[key] > max) {
      throw new RangeError(`${key} must be between ${min} and ${max}.`);
    }
  }
  for (const key of ['downstream', 'notificationsEnabled']) {
    if (typeof state[key] !== 'boolean') throw new TypeError(`${key} must be true or false.`);
  }
  state.typography.applied = state.downstream;
  return state;
}

export function fontUrl(settings) {
  return connectorAssets(settings.connectors).urls[0];
}

export function settingsCss(value, scope = ':root') {
  const state = validateSettings(value);
  const contentScope = scope === ':root' ? 'body' : scope;
  const fluid = spacingCss(state.spacing)
    .replaceAll(':where([data-ab-profile])', `:where(${scope} [data-ab-profile])`)
    .replace(/\[data-ab-profile="/g, `${scope} [data-ab-profile="`)
    .replaceAll(':root', scope)
    .replaceAll('.fluid-card .fluid-icon', `${scope} .fluid-card .fluid-icon`);
  const typography = typographyCss(state.typography, scope)
    .replace(/body \{[^}]*\}\n/, '')
    .replace(/:root p \{[^}]*\}\n/, '');
  const fonts = connectorAssets(state.connectors).css.match(/:root \{([\s\S]*?)\n\}/)[1];
  return `${fluid}\n${typography}\n${scope} {
${fonts}
  --h: ${state.hue}; --brand-h: ${state.hue};
  --s: ${state.saturation}%; --brand-s: ${state.saturation}%;
  --type-scale: ${state.typeScale}; --space-scale: ${state.spaceScale};
  --fs-base: var(--ab-text-xs);
  --fs-xs: var(--ab-text-2xs); --fs-sm: var(--ab-text-xs); --fs-md: var(--ab-text-sm);
  --fs-lg: var(--ab-text-md); --fs-xl: var(--ab-text-lg); --fs-2xl: var(--ab-text-xl);
  --space-3xs: calc(var(--ab-fluid-space) * .25 * var(--space-scale));
  --space-2xs: calc(var(--ab-fluid-space) * .5 * var(--space-scale));
  --space-xs: calc(var(--ab-fluid-space) * .75 * var(--space-scale));
  --space-sm: calc(var(--ab-fluid-space) * var(--space-scale));
  --space-md: calc(var(--ab-fluid-space) * 1.5 * var(--space-scale));
  --space-lg: calc(var(--ab-fluid-space) * 2.25 * var(--space-scale));
  --space-xl: calc(var(--ab-fluid-space) * 3 * var(--space-scale));
  --pad-card: var(--space-sm); --pad-component: var(--space-md);
  --pad-block: calc(var(--ab-layout-block-ver) * var(--space-scale));
  --pad-article: calc(var(--ab-layout-block-ver) * 1.5 * var(--space-scale));
  --stack: var(--space-sm); --stack-tight: var(--space-2xs);
  --lh-body: ${state.typography.lineHeight};
  --measure: ${state.typography.readingWidth}ch;
  --sm-text: calc(var(--ab-text-xs) * var(--type-scale) * ${state.typography.bodySize / 16});
  --sm-padding: calc(var(--ab-space-item-padding) * var(--space-scale));
  --sm-gap: calc(var(--ab-space-item-margin) * var(--space-scale));
}
${contentScope} { font-family: var(--font-body); font-size: var(--sm-text); line-height: var(--lh-body); }
${scope} :is(h1,h2,h3,h4,h5,h6) { font-family: var(--font-heading); }
${scope} p { max-inline-size: var(--measure); }
${scope} .sm-specimen { padding: var(--sm-padding); }
${scope} .sm-space-demo { display: grid; gap: var(--sm-gap); padding-block: var(--ab-layout-block-ver); }
${scope} .sm-copy { font-size: var(--sm-text); line-height: var(--lh-body); }
${scope} .sm-demo-icon { inline-size: var(--ab-icon-size); block-size: var(--ab-icon-size); }
`;
}
