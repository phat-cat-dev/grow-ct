(function () {
  'use strict';
  const form = document.querySelector('form');
  const status = document.querySelector('[data-status]');
  const preview = document.querySelector('.preview');
  const code = document.querySelector('[data-code]');
  let settings;
  function render() {
    try {
      const next = Object.fromEntries(new FormData(form));
      for (const key of ['size', 'thickness', 'opacity', 'duration', 'enterMs', 'exitMs']) next[key] = Number(next[key]);
      next.animated = form.elements.animated.checked;
      next.interaction = form.elements.interaction.checked;
      settings = BackgroundMaker.validate(next);
      code.value = BackgroundMaker.css(settings);
      document.querySelector('[data-preview-css]').textContent = code.value;
      for (const key of ['size', 'thickness', 'opacity', 'duration', 'enterMs', 'exitMs']) {
        document.querySelector(`[data-value="${key}"]`).value = key === 'opacity' ? `${Math.round(settings[key] * 100)}%` : `${settings[key]} ${key.endsWith('Ms') ? 'ms' : key === 'duration' ? 's' : 'px'}`;
      }
      if (settings.interaction) preview.setAttribute('tabindex', '0');
      else preview.removeAttribute('tabindex');
      document.querySelector('[data-pause]').disabled = !settings.animated;
      status.textContent = 'Updated. Exports include the current pattern and motion settings.';
    } catch (error) { status.textContent = `Could not update: ${error.message}`; }
  }
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', render);
  document.querySelector('[data-replay]').addEventListener('click', () => {
    preview.style.display = 'none';
    void preview.offsetWidth;
    preview.style.display = '';
    status.textContent = 'Entrance replayed. Interact with the area to try its exit.';
  });
  document.querySelector('[data-pause]').addEventListener('click', event => {
    const paused = preview.dataset.paused !== 'true';
    preview.dataset.paused = String(paused);
    event.target.setAttribute('aria-pressed', String(paused));
    event.target.textContent = paused ? 'Resume background' : 'Pause background';
  });
  document.querySelector('[data-copy]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.value);
      status.textContent = 'CSS copied.';
    } catch (error) {
      code.focus(); code.select();
      status.textContent = `Clipboard unavailable: ${error.message} Copy the selected CSS manually.`;
    }
  });
  function download(content, type, name) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = `${name} exported.`;
  }
  document.querySelector('[data-download]').addEventListener('click', () => download(BackgroundMaker.html(settings), 'text/html', 'background-header.html'));
  document.querySelector('[data-json]').addEventListener('click', () => download(JSON.stringify(settings, null, 2), 'application/json', 'background-settings.json'));
  render();
})();
