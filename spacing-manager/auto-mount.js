import { mountSpacingManager } from './spacing-manager.js';

const target = document.querySelector('[data-spacing-manager-target]') ?? document.querySelector('main.wrap, .page');
if (!target) throw new Error('Spacing manager could not find a preview target.');
const stylesheet = document.createElement('link');
stylesheet.rel = 'stylesheet';
stylesheet.href = new URL('./spacing-manager.css', import.meta.url).href;
document.head.append(stylesheet);
const host = document.createElement('div');
document.body.append(host);
const initialSettings = {
  spacing: window.ABSpacingTheme?.get(),
  typography: window.ABTypographyTheme?.get(),
};
export const manager = mountSpacingManager(host, { target, initialSettings });
window.ABSpacingManager = manager;
