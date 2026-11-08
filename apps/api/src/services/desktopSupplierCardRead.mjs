import {desktopSupplierCardId,isDesktopSupplierCard} from '../../../../packages/shared/src/desktopSupplierCard.mjs';
const fail=()=>{throw Error('DESKTOP_LIST_UNAVAILABLE');};
// Caller owns the admitted V7 SERIALIZABLE transaction and the authenticated lease.
export const DESKTOP_SUPPLIER_CARD_HEADER_SQL=`SELECT CONVERT(varchar(20),s.id) id,s.supplier_code supplierCode,s.name,s.phone,s.city,s.country,s.currency_code currency,CONVERT(varchar(40),s.purchase_discount_rate) purchaseDiscountRateExact4,s.is_active isActive,s.is_deleted isDeleted,CONVERT(varchar(20),s.party_entity_id) entityId,CONVERT(varchar(20),e.id) actualEntityId,e.role entityRole,e.identity_rule identityRule FROM dbo.suppliers s WITH(HOLDLOCK) LEFT JOIN dbo.party_entities e WITH(HOLDLOCK) ON e.id=s.party_entity_id WHERE s.id=TRY_CONVERT(bigint,@supplierId);`;
// Include every account linked by either identity: never hide inconsistent rows.
export const DESKTOP_SUPPLIER_CARD_ACCOUNTS_SQL=`SELECT TOP(4) CONVERT(varchar(20),id) id,CONVERT(varchar(20),supplier_id) supplierId,CONVERT(varchar(20),customer_id) customerId,CONVERT(varchar(20),party_entity_id) entityId,currency_code currency,CONVERT(varchar(40),current_balance) currentBalanceExact8,balance_status balanceStatus FROM dbo.party_currency_accounts WITH(HOLDLOCK) WHERE supplier_id=TRY_CONVERT(bigint,@supplierId) OR party_entity_id=TRY_CONVERT(bigint,@entityId) ORDER BY id;`;
export async function readDesktopSupplierCard({sql,transaction,supplierId}={}){
 if(!transaction||!desktopSupplierCardId(supplierId))fail();const request=()=>new sql.Request(transaction).input('supplierId',sql.NVarChar(20),supplierId);
 const headers=(await request().query(DESKTOP_SUPPLIER_CARD_HEADER_SQL))?.recordset;if(!Array.isArray(headers)||headers.length>1)fail();if(!headers.length)return null;const h=headers[0];
 if(h.id!==supplierId||!desktopSupplierCardId(h.entityId)||h.actualEntityId!==h.entityId||h.entityRole!=='supplier'||h.identityRule!=='desktop-local'||h.isDeleted!==false)fail();
 const rows=(await request().input('entityId',sql.NVarChar(20),h.entityId).query(DESKTOP_SUPPLIER_CARD_ACCOUNTS_SQL))?.recordset;
 if(!Array.isArray(rows)||rows.length<1||rows.length>3)fail();const accounts=rows.map(r=>{if(r.customerId!==null||r.supplierId!==supplierId||r.entityId!==h.entityId||r.balanceStatus!=='local')fail();return {id:r.id,supplierId:r.supplierId,entityId:r.entityId,currency:r.currency,currentBalanceExact8:r.currentBalanceExact8};});
 const result={id:h.id,supplierCode:h.supplierCode,name:h.name,phone:h.phone,city:h.city,country:h.country,currency:h.currency,purchaseDiscountRateExact4:h.purchaseDiscountRateExact4,isActive:h.isActive,entityId:h.entityId,accounts};if(!isDesktopSupplierCard(result,supplierId))fail();return result;
}
