export function createNotificationService() {
  const listeners = new Set();
  let latest = null;
  return {
    publish({ message, source = 'Application', level = 'info' }) {
      if (typeof message !== 'string' || !message.trim() || typeof source !== 'string' || !['info', 'success', 'error'].includes(level)) {
        throw new Error('Notifications require a message, source and valid level.');
      }
      latest = Object.freeze({ message, source, level });
      for (const listener of listeners) listener(latest);
    },
    subscribe(listener) {
      listeners.add(listener);
      if (latest) listener(latest);
      return () => listeners.delete(listener);
    },
  };
}

const sharedService = Symbol.for('grow.notification-service');
export const notifications = globalThis[sharedService] ??= createNotificationService();
