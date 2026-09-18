import { HISTORY_EFFECTS, HISTORY_SOURCE, hashHistoryRecord, historyError, parseHistoryAccountLinkQuery, parseHistoryQuery, validateHistoryRecord } from './vegaHistoryCore.mjs';

const columns = `source_key, company, period, source_table, source_id, kind, document_family,
 header_source_id, party_source_id, CONVERT(char(10),document_date,23) AS source_date,
 currency, payload_json, payload_hash, record_hash`;
export function mapHistoryRecord(row) {
  try {
    const record = { sourceKey: row.source_key, company: row.company, period: row.period, table: row.source_table,
      sourceId: row.source_id, kind: row.kind, documentFamily: row.document_family ?? null,
      headerSourceId: row.header_source_id ?? null, partySourceId: row.party_source_id ?? null,
      date: row.source_date ?? null, currency: row.currency ?? null,
      payload: JSON.parse(row.payload_json), payloadHash: row.payload_hash };
    validateHistoryRecord(record);
    if (hashHistoryRecord(record) !== row.record_hash) throw Error('Record hash differs');
    return record;
  } catch {
    throw historyError('HISTORY_ARCHIVE_CORRUPT', 'Arşiv kaydı kaynak kimliği veya içerik doğrulamasından geçemedi.', 503);
  }
}
function envelope(data, options, total, metadata) {
  return { success: true, archiveOnly: true, operationalEffects: { ...HISTORY_EFFECTS },
    source: { database: HISTORY_SOURCE.database, company: options.company, period: HISTORY_SOURCE.period, dateFrom: HISTORY_SOURCE.dateFrom, dateToExclusive: HISTORY_SOURCE.dateToExclusive, captureCompletedAt: metadata?.captureCompletedAt ?? null, importedAt: metadata?.importedAt ?? null, ...(options.family ? { documentFamily: options.family } : {}) },
    data, meta: { page: options.page, limit: options.limit, total, totalPages: Math.ceil(total / options.limit) } };
}
const likeValue = search => search == null ? null : `%${search.replace(/[~%_\[]/g, char => `~${char}`)}%`;
const sourceText = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const sourceInteger = value => typeof value === 'string' && /^[1-9]\d*$/.test(value) ? value : null;

// Response-only relationships. Source records/hashes are never modified and a
// matching amount, currency, latest date or coincident movement IND is not a link.
export function resolveHistoryRelation(record, candidates, targetKind) {
  let matches = [], reason = 'NO_MATCH';
  const scoped = candidates.filter(target => target.company === record.company && target.period === record.period && target.kind === targetKind);
  if (targetKind === 'document' && record.kind === 'account_movement') {
    const type = sourceText(record.payload[record.documentFamily === 'CARIHAREKETLERI' ? 'IZAHAT' : 'BELGEIZAHAT']);
    const id = record.documentFamily === 'KASA' ? sourceInteger(record.payload.BELGELINK)
      : record.documentFamily === 'CARIGENELHAREKET' ? sourceInteger(record.payload.BELGEIND) : null;
    const number = record.documentFamily === 'CARIHAREKETLERI' ? sourceText(record.payload.EVRAKNO) : null;
    if (!record.partySourceId || !record.date || !type || (!id && !number)) reason = 'NO_DOCUMENT_REFERENCE';
    else if (id && record.headerSourceId && record.headerSourceId !== id) reason = 'REFERENCE_CONFLICT';
    else matches = scoped.filter(target => target.partySourceId === record.partySourceId && target.date === record.date
      && sourceText(target.payload.BELGETIPI) === type
      && (id ? target.sourceId === id : sourceText(target.payload.BELGENO) === number));
  } else if (targetKind === 'product' && record.kind === 'line') {
    const id = sourceInteger(record.payload.STOKNO);
    if (!id) reason = 'NO_PRODUCT_REFERENCE'; else matches = scoped.filter(target => target.sourceId === id);
  } else if (targetKind === 'account' && record.kind === 'document') {
    if (!record.partySourceId) reason = 'NO_PARTY_REFERENCE'; else matches = scoped.filter(target => target.sourceId === record.partySourceId);
  } else reason = 'UNSUPPORTED_RELATION';
  const status = matches.length === 1 ? 'linked' : matches.length > 1 ? 'ambiguous' : 'missing';
  return { recordSourceKey: record.sourceKey, targetKind, status, matchCount: matches.length,
    reason: status === 'linked' ? 'UNIQUE_SOURCE_REFERENCE' : status === 'ambiguous' ? 'MULTIPLE_SOURCE_MATCHES' : reason,
    target: status === 'linked' ? matches[0] : null };
}

// Dependency injection keeps tests offline. Defaults connect only when a GET is handled.
export function createVegaHistoryService({ getPool, sql } = {}) {
  async function runtime() {
    if (getPool) { if (!sql) throw Error('Injected SQL driver is required.'); return { pool: await getPool(), driver: sql }; }
    const database = await import('../config/database.js');
    return { pool: await database.getSqlPool(), driver: database.getSqlDriver() };
  }
  async function read(action) {
    try {
      const context = await runtime();
      const schema = await context.pool.request().query(`SELECT CASE WHEN OBJECT_ID(N'dbo.vega_history_records',N'U') IS NOT NULL AND OBJECT_ID(N'dbo.vega_history_snapshots',N'U') IS NOT NULL THEN 1 ELSE 0 END AS ready;
        IF OBJECT_ID(N'dbo.vega_history_snapshots',N'U') IS NOT NULL
          SELECT TOP (1) CONVERT(varchar(33),completed_at,126)+'Z' AS captureCompletedAt,CONVERT(varchar(33),imported_at,126)+'Z' AS importedAt FROM dbo.vega_history_snapshots ORDER BY id DESC;`);
      if (schema.recordset?.[0]?.ready !== 1) throw historyError('HISTORY_ARCHIVE_NOT_READY', '2026 geçmiş arşivi bu veritabanında henüz hazırlanmadı.', 503);
      if (!Array.isArray(schema.recordsets?.[1])) throw historyError('HISTORY_READ_FAILED', 'Arşiv paket tarihi okunamadı.', 503);
      context.metadata = schema.recordsets[1][0] ?? null;
      if (context.metadata && [context.metadata.captureCompletedAt, context.metadata.importedAt].some(value => typeof value !== 'string' || !value.endsWith('Z') || !Number.isFinite(Date.parse(value)))) throw historyError('HISTORY_ARCHIVE_CORRUPT', 'Arşiv paket tarihi geçersiz.', 503);
      return await action(context);
    } catch (error) {
      if (String(error.code || '').startsWith('HISTORY_')) throw error;
      if ([207, 208].includes(Number(error.number))) throw historyError('HISTORY_ARCHIVE_NOT_READY', '2026 geçmiş arşiv şeması henüz hazır değil.', 503);
      throw historyError('HISTORY_READ_FAILED', '2026 geçmiş arşivi okunamadı.', 503);
    }
  }
  function request({ pool, driver }, options, kind) {
    return pool.request()
      .input('sourceDatabase', driver.NVarChar(64), HISTORY_SOURCE.database)
      .input('company', driver.NVarChar(5), options.company)
      .input('period', driver.NVarChar(5), HISTORY_SOURCE.period)
      .input('kind', driver.NVarChar(24), kind)
      .input('partySourceId', driver.NVarChar(128), options.partySourceId)
      .input('family', driver.NVarChar(128), options.family)
      .input('search', driver.NVarChar(410), likeValue(options.search))
      .input('headerSourceId', driver.NVarChar(128), options.headerSourceId ?? null)
      .input('offset', driver.Int, (options.page - 1) * options.limit)
      .input('limit', driver.Int, options.limit);
  }
  const where = `source_database=@sourceDatabase AND company=@company AND period=@period AND kind=@kind
    AND (@partySourceId IS NULL OR party_source_id=@partySourceId)
    AND (@family IS NULL OR document_family=@family)
    AND (@headerSourceId IS NULL OR header_source_id=@headerSourceId)
    AND (@search IS NULL OR source_id LIKE @search ESCAPE N'~' OR payload_json COLLATE Turkish_100_CI_AI LIKE @search ESCAPE N'~')`;
  async function page(context, options, kind) {
    const response = await request(context, options, kind).query(`
      DECLARE @ceiling BIGINT=(SELECT COALESCE(MAX(id),0) FROM dbo.vega_history_records WHERE source_database=@sourceDatabase AND company=@company AND period=@period);
      SELECT COUNT_BIG(*) AS total FROM dbo.vega_history_records WHERE id<=@ceiling AND ${where};
      SELECT ${columns} FROM dbo.vega_history_records WHERE id<=@ceiling AND ${where}
      ORDER BY document_date DESC,id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;`);
    const total = Number(response.recordsets?.[0]?.[0]?.total);
    if (!Number.isSafeInteger(total) || total < 0 || !Array.isArray(response.recordsets?.[1])) throw historyError('HISTORY_READ_FAILED', 'Arşiv sayfalama bilgisi geçersiz.', 503);
    if (response.recordsets[1].length !== Math.min(options.limit, Math.max(0, total - (options.page - 1) * options.limit))) throw historyError('HISTORY_READ_FAILED', 'Arşiv sayfası eksik döndü.', 503);
    return envelope(response.recordsets[1].map(mapHistoryRecord), options, total, context.metadata);
  }
  async function relationCandidates(context, options, kind, sourceIds = null) {
    if (sourceIds && !sourceIds.length) return [];
    const ids = sourceIds ? [...new Set(sourceIds)] : null;
    if (ids && (ids.length > 500 || ids.some(id => typeof id !== 'string' || !id))) throw historyError('HISTORY_INVALID_QUERY', 'Arşiv bağlantı kimlikleri geçersiz.');
    const query = request(context, { ...options, family: null, search: null, headerSourceId: null }, kind);
    if (ids) ids.forEach((id, index) => query.input(`relationId${index}`, context.driver.NVarChar(128), id));
    const scope = `source_database=@sourceDatabase AND company=@company AND period=@period AND kind=@kind
      ${kind === 'document' ? 'AND party_source_id=@partySourceId' : ''}
      ${ids ? `AND source_id IN (${ids.map((_, index) => `@relationId${index}`).join(',')})` : ''}`;
    // All matching archive headers participate, even if they are not on the
    // visible document page. Count/ceiling checks reject incomplete reads.
    const result = await query.query(`DECLARE @relationCeiling BIGINT=(SELECT COALESCE(MAX(id),0) FROM dbo.vega_history_records WHERE source_database=@sourceDatabase AND company=@company AND period=@period);
      SELECT COUNT_BIG(*) AS total FROM dbo.vega_history_records WHERE id<=@relationCeiling AND ${scope};
      SELECT ${columns} FROM dbo.vega_history_records WHERE id<=@relationCeiling AND ${scope};`);
    const total = Number(result.recordsets?.[0]?.[0]?.total), rows = result.recordsets?.[1];
    if (!Number.isSafeInteger(total) || total < 0 || !Array.isArray(rows) || rows.length !== total) throw historyError('HISTORY_READ_FAILED', 'Arşiv bağlantısı için kaynak kayıtları tam okunamadı.', 503);
    const records = rows.map(mapHistoryRecord);
    if (new Set(records.map(record => record.sourceKey)).size !== records.length
      || records.some(record => record.company !== options.company || record.period !== HISTORY_SOURCE.period || record.kind !== kind
        || (kind === 'document' && record.partySourceId !== options.partySourceId) || (ids && !ids.includes(record.sourceId)))) throw historyError('HISTORY_ARCHIVE_CORRUPT', 'Arşiv bağlantı kapsamı doğrulanamadı.', 503);
    return records;
  }
  return {
    accountLink(query) {
      const options = parseHistoryAccountLinkQuery(query);
      return read(async context => {
        const response = await context.pool.request()
          .input('company', context.driver.NVarChar(5), options.company)
          .input('entityType', context.driver.NVarChar(10), options.entityType)
          .input('entityId', context.driver.BigInt, options.entityId)
          .query(`SELECT TOP (2) l.company,l.party_source_id,l.entity_type,l.entity_id,l.evidence_hash
            FROM dbo.vega_history_account_links l
            WHERE l.company=@company AND l.entity_type=@entityType AND l.entity_id=@entityId
              AND EXISTS(SELECT 1 FROM dbo.vega_history_records r WHERE r.source_database=N'VEGA2026'
                AND r.company=l.company AND r.period=N'D0007' AND r.kind=N'account' AND r.source_id=l.party_source_id);`);
        if (!Array.isArray(response.recordset) || response.recordset.length > 1) throw historyError('HISTORY_ARCHIVE_CORRUPT', 'Arşiv cari bağlantısı tekil değil.', 503);
        const row = response.recordset[0];
        if (row && (row.company !== options.company || row.entity_type !== options.entityType || Number(row.entity_id) !== options.entityId || typeof row.party_source_id !== 'string' || !row.party_source_id.trim() || !/^[a-f0-9]{64}$/.test(row.evidence_hash))) throw historyError('HISTORY_ARCHIVE_CORRUPT', 'Arşiv cari bağlantısı doğrulanamadı.', 503);
        return envelope(row ? { company: row.company, partySourceId: row.party_source_id, entityType: row.entity_type, entityId: options.entityId, evidenceHash: row.evidence_hash } : null, { ...options, page: 1, limit: 1 }, row ? 1 : 0, context.metadata);
      });
    },
    listParties(query) { const options = parseHistoryQuery(query); return read(context => page(context, { ...options, family: null, partySourceId: null }, 'account')); },
    listDocuments(query) { const options = parseHistoryQuery(query); return read(context => page(context, options, 'document')); },
    listLedger(query) {
      const options = parseHistoryQuery(query, { requireParty: true });
      const family = options.family || 'CARIHAREKETLERI';
      if (!['CARIHAREKETLERI', 'CARIGENELHAREKET', 'KASA'].includes(family)) throw historyError('HISTORY_INVALID_QUERY', 'Cari hareket kaynağı geçersiz.');
      return read(async context => {
        const result = await page(context, { ...options, family }, 'account_movement');
        const headers = result.data.length ? await relationCandidates(context, options, 'document') : [];
        return { ...result, relations: result.data.map(record => resolveHistoryRelation(record, headers, 'document')) };
      });
    },
    documentDetail(query) {
      const options = parseHistoryQuery(query, { requireSourceKey: true });
      return read(async context => {
        const response = await request(context, options, 'document')
          .input('sourceKey', context.driver.NVarChar(450), options.sourceKey)
          .query(`SELECT TOP (1) ${columns} FROM dbo.vega_history_records WHERE source_database=@sourceDatabase AND company=@company AND period=@period AND kind=@kind AND source_key=@sourceKey;`);
        if (!response.recordset?.length) throw historyError('HISTORY_RECORD_NOT_FOUND', 'Kaynak belge bu şirketin arşivinde bulunamadı.', 404);
        const document = mapHistoryRecord(response.recordset[0]);
        if (document.company !== options.company || document.period !== HISTORY_SOURCE.period || document.kind !== 'document' || document.sourceKey !== options.sourceKey) throw historyError('HISTORY_ARCHIVE_CORRUPT', 'Kaynak belge kapsamı doğrulanamadı.', 503);
        const lines = await page(context, { ...options, family: document.documentFamily, headerSourceId: document.sourceId, partySourceId: null, search: null }, 'line');
        const products = await relationCandidates(context, options, 'product', lines.data.map(line => sourceInteger(line.payload.STOKNO)).filter(Boolean));
        const parties = await relationCandidates(context, options, 'account', document.partySourceId ? [document.partySourceId] : []);
        return { ...lines, data: { document, lines: lines.data }, relations: [resolveHistoryRelation(document, parties, 'account'), ...lines.data.map(line => resolveHistoryRelation(line, products, 'product'))] };
      });
    },
  };
}
const defaultService = createVegaHistoryService();
export const listVegaHistoryParties = query => defaultService.listParties(query);
export const listVegaHistoryDocuments = query => defaultService.listDocuments(query);
export const getVegaHistoryDocument = query => defaultService.documentDetail(query);
export const listVegaHistoryLedger = query => defaultService.listLedger(query);
export const getVegaHistoryAccountLink = query => defaultService.accountLink(query);
