import { mountAnimationManager } from './animation-manager.js';

const target = document.querySelector('[data-animation-manager-target]') ?? document.querySelector('main.wrap, main, .page, .wrap');
if (!target) throw new Error('Animation manager could not find a page target.');
const stylesheet = document.createElement('link');
stylesheet.rel = 'stylesheet';
stylesheet.href = new URL('./animation-manager.css', import.meta.url).href;
document.head.append(stylesheet);
const host = document.createElement('div');
document.body.append(host);
export const manager = mountAnimationManager(host, { target });
window.ABAnimationManager = manager;
