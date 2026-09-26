function resolveStorage(storage) {
  if (storage !== undefined) return storage;
  return globalThis.localStorage;
}

export function readStorage(key, fallback = null, storage) {
  try {
    const value = resolveStorage(storage)?.getItem(key);
    return value === null || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value, storage) {
  try {
    const target = resolveStorage(storage);
    if (!target) return false;
    target.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}
