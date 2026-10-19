export function createNotificationHistory() {
  const entries = [];
  let index = -1;
  return {
    record(notification) {
      entries.push({ ...notification });
      index = entries.length - 1;
      return { ...entries[index] };
    },
    get canBack() { return index > 0; },
    get canForward() { return index < entries.length - 1; },
    move(direction) {
      if ((direction !== -1 && direction !== 1) || index + direction < 0 || index + direction >= entries.length) {
        throw new Error('No notification in that direction.');
      }
      index += direction;
      return { ...entries[index] };
    },
  };
}
