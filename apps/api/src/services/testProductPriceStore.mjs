import {getCanonicalBusinessSaleDefinitionHash} from './canonicalBusinessSessionContext.mjs';
import {assertProductPriceId, productPriceContext, productPriceError} from './testProductPriceModel.mjs';
import {PRODUCT_PRICE_SQL_PROOF} from './testProductPriceSqlProof.mjs';
export const PRODUCT_PRICE_GET_PROC = 'dbo.usp_get_test_product_prices';
export const PRODUCT_PRICE_SET_PROC = 'dbo.usp_set_test_product_price';
const unavailable = () => productPriceError('TEST_PRODUCT_PRICE_UNAVAILABLE', 'Kayıtlı TEST fiyatları şu anda doğrulanamıyor.', 503);
async function defaultRuntime() {
  const db = await import('../config/database.js');
  if (!db.isCanonicalTest()) throw unavailable();
  return {pool: await db.getSqlPool(), sql: db.getSqlDriver()};
}
export function createTestProductPriceStore({getRuntime = defaultRuntime} = {}) {
  const execute = async (productId, actorId, payloadJson = null) => {
    assertProductPriceId(productId);
    if (typeof actorId !== 'string' || !/^[1-9]\d*$/.test(actorId) || BigInt(actorId) > 9223372036854775807n
        || (payloadJson !== null && (actorId !== '16' || typeof payloadJson !== 'string' || payloadJson.length > 8192))) throw unavailable();
    let tx;
    try {
      const {pool, sql} = await getRuntime(); tx = new sql.Transaction(pool); await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      const identity = (await new sql.Request(tx).query("SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server")).recordset?.[0];
      if (identity?.db !== 'MELISA_ERP_SIRKET_TEST_20260929_01' || identity.server !== 'Semih\\MELISADEV') throw unavailable();
      const request = new sql.Request(tx).input('product_id', sql.BigInt, productId).input('actor_id', sql.BigInt, actorId);
      if (payloadJson !== null) request.input('payload_json', sql.NVarChar(sql.MAX), payloadJson);
      const rows = (await request.execute(payloadJson === null ? PRODUCT_PRICE_GET_PROC : PRODUCT_PRICE_SET_PROC)).recordset;
      if (!Array.isArray(rows) || rows.length !== 1 || typeof rows[0].context_json !== 'string' || typeof rows[0].replayed !== 'boolean') throw unavailable();
      if (Object.entries({...PRODUCT_PRICE_SQL_PROOF,getterHash:getCanonicalBusinessSaleDefinitionHash(PRODUCT_PRICE_GET_PROC,PRODUCT_PRICE_SQL_PROOF.getterHash),setterHash:getCanonicalBusinessSaleDefinitionHash(PRODUCT_PRICE_SET_PROC,PRODUCT_PRICE_SQL_PROOF.setterHash)}).some(([key, expected]) => rows[0][key] !== expected)) throw unavailable();
      const context = productPriceContext(JSON.parse(rows[0].context_json)); await tx.commit();
      return payloadJson === null ? context : {...context, replayed: rows[0].replayed};
    } catch (error) {
      if (tx) try { await tx.rollback(); } catch {}
      const numbers = [error?.number, error?.originalError?.info?.number, ...(error?.precedingErrors ?? []).map(e => e.number)];
      if (numbers.includes(51098)) throw productPriceError('TEST_PRODUCT_PRICE_STALE', 'Fiyat değişti. Güncel fiyatı yükleyip yeniden deneyin.', 409);
      if (numbers.includes(51099)) throw productPriceError('TEST_PRODUCT_PRICE_REQUEST_CONFLICT', 'Bu istek kimliği başka bir fiyat düzenlemesine ait.', 409);
      throw unavailable();
    }
  };
  return {readTestProductPrices: (productId, actorId) => execute(productId, actorId), setTestProductPrice: execute};
}
const store = createTestProductPriceStore();
export const readTestProductPrices = store.readTestProductPrices;
export const setTestProductPrice = store.setTestProductPrice;
