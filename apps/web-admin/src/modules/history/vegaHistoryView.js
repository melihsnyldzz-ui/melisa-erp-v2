export const VEGA_HISTORY_SOURCES = Object.freeze([
  { company: 'F0102', label: 'Melisa Bebe' },
  { company: 'F0103', label: 'Melisa Muhasebe' },
]);

const own = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

export function historyAllowedSources(permissions = []) {
  const granted = new Set(Array.isArray(permissions) ? permissions : []);
  return VEGA_HISTORY_SOURCES.filter(source => ['dashboard.view', 'finance.view', ...(source.company === 'F0102' ? ['customer.view', 'sales.view'] : ['supplier.view', 'purchase.view'])].every(permission => granted.has(permission)));
}

export function historyInitialSelection(permissions, company, partySourceId) {
  const allowed = historyAllowedSources(permissions);
  const selected = allowed.find(source => source.company === company) || allowed[0];
  return { company: selected?.company || '', partySourceId: selected?.company === company && typeof partySourceId === 'string' ? partySourceId : '' };
}

export function historyValue(value) {
  if (value === undefined || value === null || value === '') return 'Bilinmiyor';
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

export function historyDateTime(value) {
  if (typeof value !== 'string' || !value || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', hour12: false });
}

export function historyField(record, ...keys) {
  for (const key of keys) if (own(record?.payload, key) && record.payload[key] !== null && record.payload[key] !== '') return record.payload[key];
  return null;
}

export function historyFlag(value) {
  if (value === true || value === '1' || value === 1) return 'yes';
  if (value === false || value === '0' || value === 0) return 'no';
  return 'unknown';
}

export function historyPartyName(record) {
  return historyField(record, 'FIRMAADI', 'UNVAN') || `Cari #${historyValue(record?.sourceId)}`;
}

export function historyError(error) {
  const messages = {
    HISTORY_ARCHIVE_NOT_READY: 'Vega 2026 geçmiş arşivi henüz hazır değil. Veri aktarımı tamamlandığında burada görüntülenebilir.',
    HISTORY_RECORD_NOT_FOUND: 'Seçilen kaynak kaydı arşivde bulunamadı. Listeyi yenileyin.',
    HISTORY_INVALID_QUERY: 'Geçmiş sorgusu geçerli değil. Kaynak ve cari seçimini kontrol edin.',
    HISTORY_INVALID_RESPONSE: 'Kaynak veya sayfa bilgisi doğrulanamadığı için sonuç gösterilemedi. Listeyi yenileyin.',
    AUTH_PERMISSION_DENIED: 'Bu şirketin geçmiş kayıtlarını görüntüleme yetkiniz yok.',
    FORBIDDEN: 'Bu şirketin geçmiş kayıtlarını görüntüleme yetkiniz yok.',
    NETWORK_ERROR: 'Geçmiş arşivine ulaşılamadı. Bağlantıyı kontrol edip yeniden deneyin.',
  };
  return messages[error?.code] || error?.message || 'Geçmiş kayıtları yüklenemedi.';
}

function invalid(message) {
  const error = new Error(message);
  error.code = 'HISTORY_INVALID_RESPONSE';
  throw error;
}

function validateCompany(company) {
  if (!VEGA_HISTORY_SOURCES.some(source => source.company === company)) throw new Error('Vega geçmişi yalnız F0102 ve F0103 kaynaklarını destekler.');
}

export function createVegaHistoryApi(getRequest) {
  function query(options, required = []) {
    validateCompany(options.company);
    const page = options.page ?? 1;
    const limit = options.limit ?? 100;
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error('Geçersiz geçmiş sayfası.');
    for (const key of required) if (typeof options[key] !== 'string' || !options[key]) throw new Error(`Geçmiş sorgusu için ${key} gerekli.`);
    for (const key of ['partySourceId', 'sourceKey']) if (options[key] != null && typeof options[key] !== 'string') throw new Error(`Geçmiş ${key} kimliği metin olmalı.`);
    return Object.fromEntries(Object.entries({ company: options.company, page, limit, search: options.search,
      partySourceId: options.partySourceId, sourceKey: options.sourceKey, family: options.family }).filter(([, value]) => value !== undefined && value !== ''));
  }
  return Object.freeze({
    parties: options => getRequest('/api/vega-history/parties', query(options)),
    documents: options => getRequest('/api/vega-history/documents', query(options)),
    detail: options => getRequest('/api/vega-history/documents/detail', query(options, ['sourceKey'])),
    ledger: options => getRequest('/api/vega-history/ledger', query(options, ['partySourceId'])),
  });
}

function validateRecord(record, company, kind) {
  if (!record || typeof record !== 'object' || record.company !== company || record.period !== 'D0007'
    || record.kind !== kind || typeof record.sourceId !== 'string' || !record.sourceId
    || typeof record.sourceKey !== 'string' || !record.sourceKey || !record.payload || typeof record.payload !== 'object' || Array.isArray(record.payload)) invalid('Kaynak kayıt kapsamı eşleşmiyor.');
  // A party card may have been created before 2026; only transaction dates are year-scoped.
  if ((kind === 'document' || kind === 'account_movement' || (kind === 'line' && record.date != null))
    && !/^2026-\d{2}-\d{2}$/.test(record.date || '')) invalid('Kaynak kaydı 2026 tarih aralığında değil.');
  for (const field of ['TUTAR', 'ARATOPLAM', 'BAKIYE', 'BORC', 'ALACAK', 'GELIR', 'GIDER', 'MIKTAR', 'BIRIMMIKTAR', 'FIYATI', 'GERCEKTOPLAM', 'KUR']) {
    if (record.payload[field] != null && typeof record.payload[field] !== 'string') invalid('Özgün ondalık değer metin olarak korunmamış.');
  }
}

// Metadata and decimal strings are kept separate: only page counts use Number.
export function readVegaHistoryResponse(response, { company, page = 1, limit = 100, kind, sourceKey, partySourceId, family } = {}) {
  validateCompany(company);
  const source = response?.source;
  const effects = response?.operationalEffects;
  if (response?.success !== true || response?.archiveOnly !== true || source?.database !== 'VEGA2026'
    || source.company !== company || source.period !== 'D0007' || source.dateFrom !== '2026-01-01' || source.dateToExclusive !== '2027-01-01'
    || effects?.stock !== false || effects?.account !== false || effects?.cash !== false) invalid('Salt okunur geçmiş kapsamı doğrulanamadı.');
  if (kind === 'account_movement' && family && source.documentFamily !== family) invalid('Ekstre kaynak bilgisi eşleşmiyor.');
  const rows = sourceKey ? response.data?.lines : response.data;
  if (!Array.isArray(rows)) invalid('Geçmiş kayıt listesi eksik.');
  const meta = response.meta;
  if (!meta || !Number.isSafeInteger(meta.page) || meta.page !== page || !Number.isSafeInteger(meta.limit) || meta.limit < 1 || meta.limit > limit
    || !Number.isSafeInteger(meta.total) || meta.total < 0 || !Number.isSafeInteger(meta.totalPages)
    || (meta.totalPages !== Math.ceil(meta.total / meta.limit) && !(meta.total === 0 && meta.totalPages === 1))) invalid('Geçmiş sayfa bilgisi geçersiz.');
  const expected = Math.min(meta.limit, Math.max(0, meta.total - (page - 1) * meta.limit));
  if (rows.length !== expected || new Set(rows.map(row => row.sourceKey)).size !== rows.length) invalid('Geçmiş sayfası eksik veya yinelenen kayıt içeriyor.');
  for (const row of rows) {
    validateRecord(row, company, sourceKey ? 'line' : kind);
    if (!sourceKey && partySourceId && row.partySourceId !== partySourceId) invalid('Cari kayıt kapsamı eşleşmiyor.');
    if (!sourceKey && family && row.documentFamily !== family) invalid('Kaynak hareket ailesi eşleşmiyor.');
  }
  if (sourceKey) {
    validateRecord(response.data.document, company, 'document');
    if (response.data.document.sourceKey !== sourceKey) invalid('Belge kimliği eşleşmiyor.');
    if (partySourceId && response.data.document.partySourceId !== partySourceId) invalid('Belge başka bir cariye bağlı.');
    for (const row of rows) if (row.headerSourceId !== response.data.document.sourceId || row.documentFamily !== response.data.document.documentFamily) invalid('Belge satırı başka bir başlığa bağlı.');
  }
  if (response.relations !== undefined) validateRelations(response.relations, sourceKey ? [response.data.document, ...rows] : rows, company);
  return response;
}

function validateRelations(relations, records, company) {
  if (!Array.isArray(relations) || relations.length !== records.length) invalid('Arşiv bağlantıları eksik.');
  const parents = new Map(records.map(record => [record.sourceKey, record])), seen = new Set();
  const trim = value => typeof value === 'string' ? value.trim() : null;
  for (const relation of relations) {
    const parent = parents.get(relation?.recordSourceKey);
    const expectedKind = { account_movement: 'document', document: 'account', line: 'product' }[parent?.kind];
    if (!parent || !expectedKind || relation.targetKind !== expectedKind || seen.has(parent.sourceKey)
      || !Number.isSafeInteger(relation.matchCount) || relation.matchCount < 0
      || relation.status !== (relation.matchCount === 1 ? 'linked' : relation.matchCount > 1 ? 'ambiguous' : 'missing')) invalid('Arşiv bağlantısı kapsamı geçersiz.');
    seen.add(parent.sourceKey);
    if (relation.status !== 'linked') { if (relation.target !== null) invalid('Belirsiz arşiv bağlantısı hedef içeriyor.'); continue; }
    const target = relation.target;
    validateRecord(target, company, expectedKind);
    if (typeof target.table !== 'string' || target.sourceKey !== `VEGA2026/${company}/D0007/${target.table}/${target.sourceId}`
      || !target.table.startsWith(company) || /[\/\s]/.test(target.sourceId)) invalid('Arşiv hedef kimliği geçersiz.');
    if (expectedKind === 'account' && target.sourceId !== parent.partySourceId) invalid('Belgenin kaynak carisi eşleşmiyor.');
    if (expectedKind === 'product' && target.sourceId !== parent.payload.STOKNO) invalid('Satırın kaynak ürünü eşleşmiyor.');
    if (expectedKind === 'document') {
      const primary = parent.documentFamily === 'CARIHAREKETLERI';
      const type = parent.payload[primary ? 'IZAHAT' : 'BELGEIZAHAT'];
      const id = parent.payload[parent.documentFamily === 'KASA' ? 'BELGELINK' : 'BELGEIND'];
      if (!parent.partySourceId || !parent.date || target.partySourceId !== parent.partySourceId || target.date !== parent.date || !trim(type)
        || trim(target.payload.BELGETIPI) !== trim(type)
        || (primary ? !trim(parent.payload.EVRAKNO) || trim(target.payload.BELGENO) !== trim(parent.payload.EVRAKNO)
          : !['KASA', 'CARIGENELHAREKET'].includes(parent.documentFamily) || target.sourceId !== id || (parent.headerSourceId && parent.headerSourceId !== id))) invalid('Hareketin belge bağlantısı doğrulanamadı.');
    }
  }
}

export function historyRelationFor(response, record, targetKind) {
  return response?.relations?.find(relation => relation.recordSourceKey === record.sourceKey && relation.targetKind === targetKind) || null;
}

export function historyRelationLabel(relation) {
  if (!relation) return 'Bağlantı bilgisi bu yanıtta yok';
  if (relation.status === 'ambiguous') return `${relation.matchCount} eşleşme var; belge otomatik seçilmedi`;
  if (relation.status === 'missing') return relation.reason === 'NO_DOCUMENT_REFERENCE' ? 'Belge bağlantı bilgisi eksik' : 'Arşivde kesin bağlantı bulunamadı';
  return '';
}

// A detached callback from an earlier company/party/page cannot open its record
// after the visible context changed. Only the original source target is passed.
export function historyRelationAction(relation, expectedContext, readContext, onOpen) {
  return () => {
    if (relation?.status !== 'linked' || !relation.target || readContext() !== expectedContext) return false;
    onOpen(relation.target); return true;
  };
}

export function historyPageRange(meta) {
  if (!meta) return '';
  if (meta.total === 0) return '0 kayıt';
  return `${(meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)} / ${meta.total} kayıt`;
}
