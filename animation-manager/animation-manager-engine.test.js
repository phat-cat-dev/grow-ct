import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOG, defaultSettings, validateSettings, instanceMarkup, exportSnippet, baseCss,
} from './animation-manager-engine.js';

test('repeat controls have finite validated defaults and bounds', () => {
  assert.equal(defaultSettings().repeats, 3);
  assert.equal(defaultSettings().jitter, 3);
  assert.equal(validateSettings({ repeats: 200 }).repeats, 10);
  assert.equal(validateSettings({ repeats: 0 }).repeats, 1);
  assert.equal(validateSettings({ repeats: 2.7 }).repeats, 3);
  assert.equal(validateSettings({ jitter: -5 }).jitter, 0);
  assert.equal(validateSettings({ jitter: 90 }).jitter, 10);
  for (const value of [NaN, Infinity, '3']) {
    assert.throws(() => validateSettings({ repeats: value }), TypeError);
    assert.throws(() => validateSettings({ jitter: value }), TypeError);
  }
});

test('every mark exports all passes with bounded per-pass tilts', () => {
  for (const mark of CATALOG) {
    const html = instanceMarkup(mark, { repeats: 10, jitter: 2 });
    assert.match(html, /data-am-repeat="10"/, mark.id);
    const angles = [...html.matchAll(/--am-turn-(\d+):(-?[\d.]+)deg/g)];
    assert.equal(angles.length, 9, mark.id);
    angles.forEach(([, , angle]) => assert.ok(Math.abs(Number(angle)) <= 2, mark.id));
    const inks = [...html.matchAll(/class="am-ink"/g)];
    assert.equal([...html.matchAll(/data-am-delay=/g)].length, inks.length, mark.id);
    assert.doesNotMatch(instanceMarkup(mark, { play: false }), /\bam-run\b/, mark.id);
    assert.doesNotMatch(instanceMarkup(mark, { repeats: 1 }), /data-am-repeat|--am-turn-/, mark.id);
  }
});

test('zero jitter, safe text and portable CSS repeat schedule', () => {
  const html = instanceMarkup('circle', { repeats: 3, jitter: 0, text: '<img onerror="bad">' });
  assert.match(html, /--am-turn-1:0deg;--am-turn-2:0deg/);
  assert.doesNotMatch(html, /<img/);
  const css = baseCss();
  for (let count = 2; count <= 10; count++) assert.ok(css.includes(`@keyframes am-turn-${count}`));
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.no-motion \.am-item/);
  const snippet = exportSnippet('double-underline', { repeats: 4, jitter: 2 });
  assert.match(snippet, /data-am-repeat="4"/);
  assert.match(snippet, /data-am-delay="0.18"/);
  assert.doesNotMatch(snippet, /<script/);
});
