const tokenKeys = ['melisaVegaProductsAccessToken', 'melisaVegaProductsRefreshToken'];

// Keep the existing, verified product session when a tab is reopened. No
// passwords, demo tokens or unrelated ERP sessions enter this storage.
export function createVegaProductStorage(persistent, legacy) {
  const memory = new Map();
  const read = (store, key) => { try { return store?.getItem(key) || null; } catch { return null; } };
  const remove = (store, key) => { try { store?.removeItem(key); } catch { /* Private browsing may block storage. */ } };
  const write = (store, key, value) => { try { store?.setItem(key, value); return read(store, key) === value; } catch { return false; } };
  // Prefer a newer persistent pair over an old tab's credentials.
  if (!tokenKeys.some(key => read(persistent, key))) {
    const values = tokenKeys.map(key => read(legacy, key));
    const copied = values.map((value, index) => !value || write(persistent, tokenKeys[index], value));
    if (copied.every(Boolean)) tokenKeys.forEach(key => remove(legacy, key));
    else tokenKeys.forEach(key => remove(persistent, key));
  } else tokenKeys.forEach(key => remove(legacy, key));
  return {
    getItem(key) { return memory.get(key) || read(persistent, key) || read(legacy, key) || null; },
    setItem(key, value) {
      if (write(persistent, key, value)) { memory.delete(key); remove(legacy, key); }
      else if (write(legacy, key, value)) memory.delete(key);
      else memory.set(key, value);
    },
    removeItem(key) { memory.delete(key); remove(persistent, key); remove(legacy, key); },
  };
}
