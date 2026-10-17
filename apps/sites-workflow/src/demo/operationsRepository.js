// The demo is a single-origin browser sandbox. This adapter is intentionally
// separate from the business transitions so the future API can replace it.
export const STORAGE_KEY = 'melisa.connected-demo.v2';
export const LEGACY_KEY = 'melisa.connected-demo.v1';
export const BACKUP_KEY = `${STORAGE_KEY}.previous`;
const LOCK_KEY = `${STORAGE_KEY}.writer`;

function assertState(state) {
  if (!state || state.version !== 2 || !Number.isSafeInteger(state.revision) || state.revision < 0 ||
      !Number.isSafeInteger(state.nextId) || !Number.isSafeInteger(state.nextOrderId) ||
      !Array.isArray(state.products) || !Array.isArray(state.customers) || !Array.isArray(state.suppliers) ||
      !Array.isArray(state.documents) || !Array.isArray(state.movements) || !Array.isArray(state.orders) ||
      !state.cash || !['TRY', 'USD', 'EUR'].every(c => Number.isSafeInteger(state.cash[c]))) {
    throw Error('Demo kaydı okunamadı. Kayıt korundu; önceki sağlam sürümü geri yükleyebilir veya kaydı dışa aktarabilirsiniz.');
  }
  for (const field of ['products', 'customers', 'suppliers', 'documents', 'orders']) {
    const ids = state[field].map(row => row?.id);
    if (ids.some(id => !id) || new Set(ids).size !== ids.length) throw Error('Demo kaydında tekrarlanan kimlik var. Kayıt korundu.');
  }
  return state;
}

function parse(raw) {
  try {
    const state = JSON.parse(raw);
    if (state?.version === 1) {
      state.version = 2;
      state.orders ??= [];
      state.nextOrderId ??= 1;
      state.cardAudit ??= [];
      state.orderAudit ??= [];
      state.commandReceipts ??= [];
    }
    return assertState(state);
  }
  catch (error) { throw Error(`Demo kaydı bozuk: ${error.message}`); }
}

export function createOperationsRepository({ storage, legacyStorage, lock, seed }) {
  const get = (key) => {
    try { return storage.getItem(key); }
    catch { throw Error('Demo saklama alanı okunamadı; kayıtlar sıfırlanmadı.'); }
  };
  const put = (key, value) => {
    try { storage.setItem(key, value); }
    catch { throw Error('Demo kaydı yazılamadı. Depolama alanını kontrol edin; işlem uygulanmadı.'); }
  };
  function read() {
    const current = get(STORAGE_KEY);
    if (current !== null) return parse(current);
    let legacy;
    try { legacy = legacyStorage?.getItem(LEGACY_KEY); }
    catch { throw Error('Önceki demo kaydı okunamadı; veriler sıfırlanmadı.'); }
    // The v1 record stays untouched until a v2 commit succeeds.
    return legacy === null || legacy === undefined ? assertState(seed()) : parse(legacy);
  }
  async function execute(command, transition) {
    if (!lock) throw Error('Tarayıcı güvenli sekme kilidini desteklemiyor; demo işlemi kaydedilmedi.');
    return lock(LOCK_KEY, () => {
      const raw = get(STORAGE_KEY);
      const before = raw === null ? read() : parse(raw);
      const requestId = command.requestId;
      if (requestId !== undefined && (typeof requestId !== 'string' || !/^[\w-]{8,100}$/.test(requestId))) throw Error('İşlem anahtarı geçersiz.');
      const fingerprint = JSON.stringify(Object.fromEntries(Object.entries(command).filter(([key]) => !['requestId', 'expectedRevision'].includes(key))));
      const prior = requestId && before.commandReceipts?.find(item => item.requestId === requestId);
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw Error('Aynı işlem anahtarı farklı bir komutta kullanılmış.');
        return before;
      }
      if (command.expectedRevision !== undefined && command.expectedRevision !== before.revision) throw Error('Kayıt başka bir sekmede değişti. Güncel bilgiyi inceleyip işlemi yeniden yapın.');
      const next = transition(before, command);
      if (next === before) return before;
      assertState(next);
      if (next.revision !== before.revision + 1) throw Error('İşlem sürümü beklenen şekilde ilerlemedi.');
      if (requestId) next.commandReceipts = [...(before.commandReceipts || []), { requestId, fingerprint }];
      const serialized = JSON.stringify(next);
      // A complete string is written in one storage operation. Retain the
      // previous valid record for explicit recovery, never silently reset.
      put(STORAGE_KEY, serialized);
      try { put(BACKUP_KEY, JSON.stringify(before)); }
      catch { /* The committed record is valid; a backup quota failure must not replay the command. */ }
      return next;
    });
  }
  function exportRaw() { return get(STORAGE_KEY) ?? legacyStorage?.getItem(LEGACY_KEY) ?? null; }
  function backup() { const raw = get(BACKUP_KEY); return raw === null ? null : parse(raw); }
  async function restore() {
    if (!lock) throw Error('Tarayıcı güvenli sekme kilidini desteklemiyor.');
    return lock(LOCK_KEY, () => {
      const previous = backup();
      if (!previous) throw Error('Geri yüklenecek sağlam bir kayıt bulunamadı.');
      const raw = get(STORAGE_KEY);
      const currentRevision = raw === null ? 0 : (() => { try { return JSON.parse(raw).revision || 0; } catch { return 0; } })();
      const recovered = { ...previous, revision: Math.max(previous.revision, currentRevision) + 1 };
      put(STORAGE_KEY, JSON.stringify(recovered));
      return recovered;
    });
  }
  return { read, execute, exportRaw, backup, restore };
}
