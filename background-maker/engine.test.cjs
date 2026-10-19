const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('./engine.js');

test('all presets support every entrance and exit without fading the base', () => {
  for (const preset of Object.keys(engine.presets)) {
    for (const effect of ['fade', 'rise', 'zoom', 'blur', 'wipe']) {
      const css = engine.css({ preset, entrance: effect, exit: effect, paper: '#abcdef', enterMs: 800, exitMs: 300, animated: true });
      assert.match(css, /--pattern-paper: #abcdef/);
      assert.match(css, /@starting-style/);
      assert.match(css, /transition-duration: 800ms/);
      assert.match(css, /transition-duration: 300ms/);
      assert.match(css, /:focus-within::before/);
      assert.match(css, /pattern-drift 18s/);
      assert.doesNotMatch(css, /\.pattern-bg:hover\s*\{/);
    }
  }
});

test('portable exports retain interaction and can disable it', () => {
  assert.match(engine.html({}), /tabindex="0"/);
  const css = engine.css({ interaction: false });
  assert.doesNotMatch(css, /:focus-within|:hover::before/);
  assert.doesNotMatch(engine.html({ interaction: false }), /tabindex/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /transition: none !important/);
});

test('invalid effects and transition times fail explicitly', () => {
  for (const value of [{ entrance: 'bad' }, { exit: 'bad' }, { enterMs: -1 }, { exitMs: 3001 }, { enterMs: NaN }, { interaction: 'true' }]) {
    assert.throws(() => engine.validate(value));
  }
});
