export function persistJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function persistJsonProperty(owner, property, key, value) {
  try {
    return persistJson(owner[property], key, value);
  } catch {
    return false;
  }
}
