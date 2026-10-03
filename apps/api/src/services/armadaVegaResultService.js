import sql from 'mssql/tedious.js';
import { env } from '../config/env.js';
import { getVegaSqlPool } from '../config/vegaDatabase.js';
import { matchArmadaVegaResult } from './armadaVegaResultMatcher.mjs';

// Internal read adapter. The caller must load expected from its protected
// operation snapshot and authorize its actor; never expose arbitrary lookups.
export async function readArmadaVegaResult(expected) {
  if (env.vega.companyCode !== 'F0102' || env.vega.periodCode !== 'D0007'
    || expected?.company !== 'F0102' || expected?.period !== 'D0007'
    || typeof expected?.documentNumber !== 'string'
      || !/^[A-Za-z0-9-]{1,30}$/.test(expected.documentNumber)) {
    return { state: 'REVIEW_REQUIRED', reason: 'UNSUPPORTED_SOURCE_SCOPE', mayResend: false };
  }
  // The ID must come from the protected journal or a trusted Armada UID lookup,
  // never from an HTTP client or a number parsed from the handler response.
  const documentId = expected.vegaDocumentId ?? null;
  if (documentId !== null && (!Number.isSafeInteger(documentId) || documentId < 1)) {
    return { state: 'REVIEW_REQUIRED', reason: 'LINKED_DOCUMENT_INVALID', mayResend: false };
  }
  const pool = await getVegaSqlPool();
  const result = await pool.request()
    .input('documentNumber', sql.NVarChar(30), expected.documentNumber)
    .input('documentId', sql.Int, documentId)
    .query(`
      SELECT TOP (2) IND AS id, BELGENO AS documentNumber, FIRMANO AS customerId,
        CONVERT(varchar(10), TARIH, 23) AS date, PARABIRIMI AS currency,
        IPTAL AS cancelled, IADE AS returned
      FROM dbo.F0102D0007TBLSTKCIKBASLIK
      WHERE (@documentId IS NOT NULL AND IND=@documentId)
         OR (@documentId IS NULL AND BELGENO=@documentNumber) ORDER BY IND;

      SELECT TOP (501) l.IND AS id, l.EVRAKNO AS documentId, l.FIRMANO AS customerId,
        l.STOKNO AS stockId, l.BIRIMEX AS unitId, l.BIRIM AS unit, l.BARKOD AS barcode,
        CONVERT(varchar(64), l.MIKTAR) AS quantity, CONVERT(varchar(64), l.FIYATI) AS unitPrice,
        CONVERT(varchar(64), l.GERCEKTOPLAM) AS total, CONVERT(varchar(64), l.KDVTUTARI) AS taxAmount,
        l.PARABIRIMI AS currency, CONVERT(varchar(64), l.KUR) AS exchangeRate,
        l.DEPO AS depotId, l.PERSONEL AS personnelId
      FROM dbo.F0102D0007TBLSTKCIKHAREKET l
      WHERE EXISTS (SELECT 1 FROM dbo.F0102D0007TBLSTKCIKBASLIK h WHERE h.IND=l.EVRAKNO
        AND ((@documentId IS NOT NULL AND h.IND=@documentId) OR (@documentId IS NULL AND h.BELGENO=@documentNumber)))
      ORDER BY l.IND;

      SELECT TOP (501) IND AS id, BELGENO AS documentId, EVRAKNO AS documentNumber,
        CONVERT(varchar(10), TARIH, 23) AS date, STOKNO AS stockId, BIRIMEX AS unitId,
        CONVERT(varchar(64), GIREN) AS incoming, CONVERT(varchar(64), CIKAN) AS outgoing,
        IZAHAT AS code, IADE AS returned, PARABIRIMI AS currency, CONVERT(varchar(64), KUR) AS exchangeRate
      FROM dbo.F0102D0007TBLSTOKHAREKETLERI m
      WHERE EXISTS (SELECT 1 FROM dbo.F0102D0007TBLSTKCIKBASLIK h WHERE h.IND=m.BELGENO
        AND ((@documentId IS NOT NULL AND h.IND=@documentId) OR (@documentId IS NULL AND h.BELGENO=@documentNumber))) ORDER BY IND;

      SELECT TOP (2) IND AS id, FIRMANO AS customerId, EVRAKNO AS documentNumber,
        CONVERT(varchar(10), TARIH, 23) AS date, IZAHAT AS code, IADE AS returned,
        CONVERT(varchar(64), BORC) AS debit, CONVERT(varchar(64), ALACAK) AS credit,
        PARABIRIMI AS currency, CONVERT(varchar(64), KUR) AS exchangeRate
      FROM dbo.F0102D0007TBLCARIHAREKETLERI c
      WHERE EXISTS (SELECT 1 FROM dbo.F0102D0007TBLSTKCIKBASLIK h WHERE h.BELGENO=c.EVRAKNO
        AND ((@documentId IS NOT NULL AND h.IND=@documentId) OR (@documentId IS NULL AND h.BELGENO=@documentNumber))) ORDER BY IND;
    `);
  const [headers, lines, movements, ledger] = result.recordsets || [];
  const complete = Array.isArray(headers) && Array.isArray(lines) && Array.isArray(movements)
    && Array.isArray(ledger) && headers.length < 2 && lines.length < 501 && movements.length < 501 && ledger.length < 2;
  return matchArmadaVegaResult(expected, {
    database: 'VEGA2026', company: 'F0102', period: 'D0007', complete,
    headers, lines, movements, ledger,
  });
}
