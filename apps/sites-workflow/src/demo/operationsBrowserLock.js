// Web Locks is available on HTTPS; IndexedDB transactions provide the same
// cross-tab writer serialization on the supervised HTTP preview origin.
export function createBrowserLock() {
  if (globalThis.navigator?.locks?.request) return globalThis.navigator.locks.request.bind(globalThis.navigator.locks);
  if (!globalThis.indexedDB) return null;
  let opening;
  const open = () => opening ??= new Promise((resolve,reject) => {
    const request = indexedDB.open('melisa-demo-write-lock',1);
    request.onupgradeneeded = () => request.result.createObjectStore('writers');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(Error('Demo kayıt kilidi açılamadı. İşlem uygulanmadı.'));
  });
  return async (name, action) => {
    const db = await open();
    return new Promise((resolve,reject) => {
      const tx = db.transaction('writers','readwrite');
      const store = tx.objectStore('writers');
      let result, failure;
      tx.oncomplete = () => failure ? reject(failure) : resolve(result);
      tx.onabort = () => reject(failure || Error('Demo kayıt kilidi kesildi. İşlem sonucunu kontrol edin.'));
      tx.onerror = () => { failure ||= Error('Demo kayıt kilidi kesildi. İşlem sonucunu kontrol edin.'); };
      const check = store.get(name);
      check.onsuccess = () => {
        try {
          // The read, business transition and localStorage write are synchronous.
          // Queue another IDB request before this transaction can commit.
          result = action();
          if (result?.then) throw Error('Demo işlemi senkron tamamlanmalı.');
          store.put(Date.now(),name);
        } catch(error) { failure=error;tx.abort(); }
      };
    });
  };
}
