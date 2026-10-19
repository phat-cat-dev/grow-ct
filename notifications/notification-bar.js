import { createNotificationHistory } from './notification-history.js';

export function mountNotificationBar(host, { service, matchHeight, enabled = true } = {}) {
  if (!service || !matchHeight) throw new Error('Notification bar requires a service and control-bar element.');
  host.classList.add('notification-bar');
  let timer;
  const history = createNotificationHistory();
  function hide() {
    clearTimeout(timer);
    if (host.contains(document.activeElement)) matchHeight.querySelector('button:not(:disabled)')?.focus();
    host.dataset.visible = 'false';
    host.inert = true;
    host.setAttribute('aria-hidden', 'true');
  }
  hide();
  const content = document.createElement('div');
  content.className = 'notification-bar__content';
  content.setAttribute('role', 'status');
  content.setAttribute('aria-live', 'polite');
  content.setAttribute('aria-atomic', 'true');
  content.tabIndex = 0;
  const controls = [];
  function navigation(label, symbol, callback) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tm-icon notification-bar__navigation';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.disabled = true;
    const icon = document.createElement('span');
    icon.className = 'tm-symbol';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = symbol;
    button.append(icon);
    button.addEventListener('click', callback);
    controls.push([button, callback]);
    return button;
  }
  const back = navigation('Previous notification', 'arrow_back', () => show(history.move(-1)));
  const forward = navigation('Next notification', 'arrow_forward', () => show(history.move(1)));
  host.replaceChildren(back, content, forward);
  function show({ message, source, level }) {
    clearTimeout(timer);
    host.dataset.level = level;
    host.dataset.visible = 'true';
    host.inert = false;
    host.removeAttribute('aria-hidden');
    content.textContent = `${source}: ${message}`;
    content.scrollTop = 0;
    back.disabled = !history.canBack;
    forward.disabled = !history.canForward;
    timer = setTimeout(hide, 10_000);
  }
  const unsubscribe = service.subscribe(notification => {
    if (!enabled) return;
    show(history.record(notification));
  });
  const resize = () => {
    host.style.height = `${matchHeight.getBoundingClientRect().height}px`;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(matchHeight, { box: 'border-box' });
  window.addEventListener('resize', resize);
  resize();
  return {
    setEnabled(value) {
      enabled = value;
      if (!enabled) {
        hide();
        content.textContent = '';
      }
    },
    destroy() {
      clearTimeout(timer);
      unsubscribe();
      observer.disconnect();
      window.removeEventListener('resize', resize);
      for (const [button, callback] of controls) button.removeEventListener('click', callback);
      host.replaceChildren();
      host.classList.remove('notification-bar');
      host.style.removeProperty('height');
      delete host.dataset.level;
      delete host.dataset.visible;
      host.inert = false;
      host.removeAttribute('aria-hidden');
    },
  };
}
