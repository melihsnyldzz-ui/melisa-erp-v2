import { closeSqlPool, getSqlDriver, getSqlPool } from '../src/config/database.js';
import { closeVegaSqlPool, getVegaSqlPool } from '../src/config/vegaDatabase.js';
import { assertMelisaWriteEnabled } from '../src/services/writeGuardService.js';

const APPLY = process.argv.includes('--apply');
const SKIP_VEGA_CHECK = process.argv.includes('--skip-vega-check');
const SOURCE_DOCUMENT_NO = 'AHM10350';
const SOURCE_HEADER_ID = 2321;

const classifications = [
  [160789, '2004 MELİSA', '6111.20.90.00.00', 'medium', 'Genel ürün bilgisi: pamuk; örme bebek seti adayı'],
  [160655, '8051 MELİSA', '6301.30.10.00.00', 'low', 'Genel ürün bilgisi: pamuk; örme battaniye varsayımı'],
  [160656, '8052 MELİSA', '6301.30.10.00.00', 'low', 'Genel ürün bilgisi: pamuk; örme battaniye varsayımı'],
  [160657, '8050 MELİSA', '6301.30.10.00.00', 'low', 'Genel ürün bilgisi: pamuk; örme battaniye varsayımı'],
  [161039, '4556 MİOMİNİ', '6111.20.90.00.00', 'medium', 'Genel ürün bilgisi: pamuk; örme bebek tulumu adayı'],
  [160949, '4607 MY MİO', '6111.20.90.00.00', 'medium', 'Görselde 0-9 ay; genel ürün bilgisi: pamuk'],
  [160921, '056 PAKEL', '6111.20.90.00.00', 'medium', 'Genel ürün bilgisi: pamuk; örme bebek tulumu adayı'],
  [160649, '9245 DEMİRDAĞ', '6111.20.90.00.00', 'medium', 'Genel ürün bilgisi: pamuk; hastane çıkışı seti'],
  [160905, '1330 PERA BABY', '6111.20.90.00.00', 'medium', 'Genel ürün bilgisi: pamuk; örme bebek tulumu adayı'],
  [160812, '2020 MİNİDAY BABY', '6111.20.90.00.00', 'medium', 'Genel ürün bilgisi: pamuk; örme romper adayı'],
  [160893, '10410 MURAT BABY', '6111.20.90.00.00', 'medium', 'Görselde 3-12 ay; genel ürün bilgisi: pamuk'],
  [160897, '10806 MURAT BABY', '6111.20.90.00.00', 'medium', 'Görselde 0-3 ay; genel ürün bilgisi: pamuk'],
  [152852, '9998 MURAT BABY', '6111.20.90.00.00', 'low', 'Görselde 0-6 ay kadife; ana elyaf pamuk varsayımı'],
  [160895, '9889 MURAT BABY', '6111.20.90.00.00', 'low', 'Görselde 3-9 ay kadife; ana elyaf pamuk varsayımı'],
  [151829, '10057 MURAT BABY', '6111.20.90.00.00', 'low', 'Görselde 0-6 ay kadife; ana elyaf pamuk varsayımı'],
  [150628, '7994 BUUDE KİDS', '6301.30.10.00.00', 'low', 'Genel ürün bilgisi: pamuk; örme battaniye varsayımı'],
  [161043, '261062 BOM-BİBO BABY', '6111.20.90.00.00', 'medium', 'Genel ürün bilgisi: pamuk; örme bebek takımı adayı'],
  [161044, '261141 BOM-BİBO BABY', '6111.20.90.00.00', 'medium', 'Prematüre bebek tulumu; genel ürün bilgisi: pamuk'],
  [161041, '7104 NEHAD', '6111.30.90.00.00', 'high', 'Velsoft kumaş; sentetik örme bebek tulumu'],
  [161042, '7090 NEHAD', '6111.30.90.00.00', 'high', 'Velsoft kumaş; sentetik örme bebek tulumu'],
].map(([sourceId, stockCode, gtipCode, confidence, materialBasis]) => ({
  sourceId,
  stockCode,
  gtipCode,
  confidence,
  materialBasis,
}));

function normalized(value) {
  return String(value || '').trim().toLocaleUpperCase('tr-TR');
}

async function verifyVegaScope() {
  const pool = await getVegaSqlPool();
  const result = await pool.request()
    .input('headerId', SOURCE_HEADER_ID)
    .input('documentNo', SOURCE_DOCUMENT_NO)
    .query(`
      SELECT DISTINCT
        h.STOKNO AS source_id,
        s.STOKKODU AS stock_code
      FROM dbo.F0102D0007TBLSTOKHAREKETLERI h
      INNER JOIN dbo.F0102TBLSTOKLAR s ON s.IND = h.STOKNO
      WHERE h.BELGENO = @headerId
        AND h.EVRAKNO = @documentNo;
    `);

  const sourceRows = new Map((result.recordset || []).map((row) => [
    Number(row.source_id),
    normalized(row.stock_code),
  ]));
  if (sourceRows.size !== classifications.length) {
    throw new Error(`Vega scope mismatch: expected ${classifications.length}, found ${sourceRows.size}`);
  }
  classifications.forEach((item) => {
    if (sourceRows.get(item.sourceId) !== normalized(item.stockCode)) {
      throw new Error(`Vega product mismatch for source ${item.sourceId}`);
    }
  });
}

async function applyClassifications() {
  assertMelisaWriteEnabled();
  const pool = await getSqlPool();
  const driver = getSqlDriver();
  const transaction = new driver.Transaction(pool);
  await transaction.begin();

  try {
    for (const item of classifications) {
      await new driver.Request(transaction)
        .input('sourceId', driver.BigInt, item.sourceId)
        .input('stockCode', driver.NVarChar(120), item.stockCode)
        .input('gtipCode', driver.NVarChar(20), item.gtipCode)
        .input('confidence', driver.NVarChar(20), item.confidence)
        .input('materialBasis', driver.NVarChar(120), item.materialBasis)
        .input('note', driver.NVarChar(500), 'Taslak sınıflandırma; ürün etiketi ve gümrük müşaviri doğrulaması gerekir.')
        .input('sourceDocumentNo', driver.NVarChar(60), SOURCE_DOCUMENT_NO)
        .input('sourceHeaderId', driver.BigInt, SOURCE_HEADER_ID)
        .query(`
          MERGE dbo.vega_product_customs AS target
          USING (SELECT @sourceId AS vega_source_id) AS source
            ON source.vega_source_id = target.vega_source_id
          WHEN MATCHED THEN UPDATE SET
            stock_code = @stockCode,
            gtip_code = @gtipCode,
            classification_status = N'draft',
            confidence = @confidence,
            material_basis = @materialBasis,
            classification_note = @note,
            source_document_no = @sourceDocumentNo,
            source_header_id = @sourceHeaderId,
            updated_at = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT (
            vega_source_id, stock_code, gtip_code, classification_status,
            confidence, material_basis, classification_note,
            source_document_no, source_header_id
          ) VALUES (
            @sourceId, @stockCode, @gtipCode, N'draft',
            @confidence, @materialBasis, @note,
            @sourceDocumentNo, @sourceHeaderId
          );
        `);
    }

    await new driver.Request(transaction)
      .input('entityId', driver.BigInt, SOURCE_HEADER_ID)
      .input('afterJson', driver.NVarChar(driver.MAX), JSON.stringify({
        documentNo: SOURCE_DOCUMENT_NO,
        headerId: SOURCE_HEADER_ID,
        productCount: classifications.length,
        status: 'draft',
        codes: [...new Set(classifications.map((item) => item.gtipCode))],
      }))
      .query(`
        INSERT INTO dbo.audit_logs (
          actor_user_id, action, entity_type, entity_id,
          before_json, after_json, reason, source, created_at
        ) VALUES (
          NULL, N'vega_product_gtip_batch_saved', N'vega_product_customs_batch', @entityId,
          NULL, @afterJson, N'User-approved AHM10350 GTIP draft assignment', N'codex-approved-run', SYSUTCDATETIME()
        );
      `);

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

try {
  if (!SKIP_VEGA_CHECK) {
    await verifyVegaScope();
  }
  if (!APPLY) {
    console.log(JSON.stringify({ ok: true, mode: 'preview', documentNo: SOURCE_DOCUMENT_NO, headerId: SOURCE_HEADER_ID, productCount: classifications.length, vegaCheckSkipped: SKIP_VEGA_CHECK }));
  } else {
    await applyClassifications();
    console.log(JSON.stringify({ ok: true, mode: 'apply', documentNo: SOURCE_DOCUMENT_NO, headerId: SOURCE_HEADER_ID, productCount: classifications.length, vegaCheckSkipped: SKIP_VEGA_CHECK }));
  }
} finally {
  await Promise.allSettled([closeVegaSqlPool(), closeSqlPool()]);
}
