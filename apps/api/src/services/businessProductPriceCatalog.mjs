import {assertIsolatedCopyContext,assertIsolatedCopyIdentity,isolatedCopyUUID} from './isolatedOperationCopyContext.mjs';
import {businessProductPriceContext} from './businessProductPriceModel.mjs';
import {getRegisteredBusinessProductPriceRevision} from '../../../../scripts/canonical/shared-business-product-price-bootstrap.mjs';
import {BUSINESS_PRICE_GET} from '../../../../scripts/canonical/shared-business-product-price-revision-contract.mjs';

const check=value=>{if(!value)throw Object.assign(Error('Katalog satış fiyatı doğrulanamadı.'),{code:'BUSINESS_PRICE_CATALOG_UNAVAILABLE',statusCode:503});};
const keys=(v,n)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===n.toSorted().join();
const hash=v=>typeof v==='string'&&/^[A-F0-9]{64}$/.test(v);
const exact=v=>v===null||typeof v==='string'&&/^(0|[1-9]\d{0,19})\.\d{8}$/.test(v);
const parse=v=>{check(typeof v==='string');try{return JSON.parse(v);}catch{check(false);}};

// Pure projection validation. The native caller below supplies identity, actor,
// installed-definition and same-transaction proof before using this result.
export function projectBusinessCatalogPrices(copy,rows,raw){
  assertIsolatedCopyContext(copy);
  check(keys(raw,['schemaVersion','copyId','sealHash','operationOrigin','products'])&&raw.schemaVersion==='melisa-business-product-price-catalog.v1'&&raw.copyId===copy.copyId&&raw.sealHash===copy.sealHash&&raw.operationOrigin===copy.operationOrigin&&Array.isArray(raw.products)&&raw.products.length===rows.length&&new Set(raw.products.map(p=>p.productId)).size===rows.length);
  return rows.map(row=>{
    const overlay=raw.products.find(p=>p.productId===row.id),source=copy.products.find(p=>p.id===row.id);
    check(keys(overlay,['productId','overlayEligible','prices'])&&typeof overlay.overlayEligible==='boolean'&&Array.isArray(overlay.prices));
    if(!source){check(!overlay.overlayEligible&&overlay.prices.length===0);return row;}
    check(overlay.overlayEligible&&!row.hold.blocked&&row.stockCode===source.stockCode&&row.provenance.verified===true&&row.provenance.kind==='accepted-opening');
    // Catalog lineage and native SOURCE keys use different namespaces. Their
    // independent SQL proofs bind the same native product and quote IDs.
    // Reuse the strict tuple/source validator, with a synthetic read envelope
    // that grants no edit authority and is never returned as a native context.
    const validated=businessProductPriceContext(copy,{schemaVersion:'melisa-business-product-prices.v1',productId:row.id,copyId:copy.copyId,sealHash:copy.sealHash,operationOrigin:copy.operationOrigin,revision:'0'.repeat(64),canEdit:false,prices:overlay.prices.map(({manual,...p})=>p),recentChanges:[]});
    for(const price of overlay.prices){
      check(keys(price,['priceId','tuple','priceExact','currentVersionId','source','manual']));
      if(price.currentVersionId===null)check(price.manual===null);
      else{const m=price.manual;check(keys(m,['requestId','actorId','payloadHash','beforePriceExact','reason','createdAt','versionProofHash'])&&isolatedCopyUUID(m.requestId)&&m.actorId==='16'&&hash(m.payloadHash)&&hash(m.versionProofHash)&&exact(m.beforePriceExact)&&typeof m.reason==='string'&&m.reason.trim().length>=3&&m.reason.length<=500&&typeof m.createdAt==='string'&&Number.isFinite(Date.parse(m.createdAt)));}
    }
    const salePrices=row.salePrices.map(price=>{
      const current=validated.prices.find(p=>p.priceId===price.id);
      if(!current)return price;
      check(price.type===current.tuple.type&&price.unitSourceId===current.tuple.unitId&&price.tier===current.tuple.tier&&price.currency===current.tuple.currency&&price.priceExact===current.source.priceExact8&&price.isMainUnit===true);
      return {...price,priceExact:current.priceExact,...(current.currentVersionId===null?{}:{pricing:{origin:'MANUAL',versionId:current.currentVersionId,sourcePriceExact:current.source.priceExact8}})};
    });
    check(validated.prices.every(p=>salePrices.some(s=>s.id===p.priceId)));
    return {...row,salePrices};
  });
}

export const BUSINESS_PRICE_CATALOG_METADATA_SQL=`SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess,@@SPID sessionId,CONVERT(varchar(30),CURRENT_TRANSACTION_ID()) transactionId,@@TRANCOUNT transactionCount,XACT_STATE() transactionState,(SELECT transaction_isolation_level FROM sys.dm_exec_sessions WHERE session_id=@@SPID) isolationLevel,APPLOCK_MODE(N'public',N'melisa-stage4-copy:'+LOWER(CONVERT(varchar(36),@copy_id)),N'Transaction') copyLockMode,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${BUSINESS_PRICE_GET}',N'P'))),2) readerDefinitionHash;`;

// Called inside the catalog's existing SERIALIZABLE transaction, after its
// source rows have been validated. One bounded native request, never N+1 reads.
export async function readBusinessCatalogPrices({copy,sql,transaction,actorId,rows}){
  const registration=copy&&getRegisteredBusinessProductPriceRevision(copy);
  if(!registration||rows.length===0)return rows;
  check(Array.isArray(rows)&&rows.length<=50&&new Set(rows.map(p=>p.id)).size===rows.length);
  // Only sealed copy products can own manual-price metadata. Catalog source
  // validation already covers every original row; native overlay proof remains
  // fresh for the exact copy intersection, with no business-data cache.
  const copyIds=new Set(copy.products.map(p=>p.id)),eligibleRows=rows.filter(row=>copyIds.has(row.id));
  if(eligibleRows.length===0)return rows;
  const pin=registration.revision.modules.find(m=>m.name===BUSINESS_PRICE_GET)?.afterHash;
  check(hash(pin));
  const req=()=>{const r=new sql.Request(transaction);check(r.parent===transaction);return r;};
  const frame=async()=>{
    const result=(await req().input('copy_id',sql.UniqueIdentifier,copy.copyId).query(BUSINESS_PRICE_CATALOG_METADATA_SQL)).recordset;
    check(result?.length===1);const m=result[0];assertIsolatedCopyIdentity(copy,m);
    check(m.readerDefinitionHash===pin&&m.transactionCount===1&&m.transactionState===1&&m.isolationLevel===4&&['Shared','Exclusive'].includes(m.copyLockMode)&&Number.isSafeInteger(m.sessionId)&&m.sessionId>0&&typeof m.transactionId==='string'&&/^[1-9]\d*$/.test(m.transactionId));return m;
  };
  const before=await frame(),ids=eligibleRows.map(p=>p.id).toSorted((a,b)=>BigInt(a)<BigInt(b)?-1:1);
  const result=await req().input('copy_id',sql.UniqueIdentifier,copy.copyId).input('product_id',sql.BigInt,null).input('actor_id',sql.BigInt,actorId).input('catalog_ids_json',sql.NVarChar(sql.MAX),JSON.stringify(ids)).execute(BUSINESS_PRICE_GET);
  check(result.recordsets?.length===1&&result.recordsets[0].length===1);
  const row=result.recordsets[0][0],after=await frame();
  check(keys(row,['catalog_json','actor_json','sessionId','transactionId','readerDefinitionHash'])&&row.readerDefinitionHash===pin&&row.sessionId===before.sessionId&&after.sessionId===before.sessionId&&String(row.transactionId)===before.transactionId&&after.transactionId===before.transactionId&&before.copyLockMode===after.copyLockMode);
  const actor=parse(row.actor_json);check(String(actor.id)===actorId&&actor.active===true&&typeof actor.role==='string'&&Array.isArray(actor.permissions)&&['product.view','sales.view'].every(p=>actor.permissions.includes(p)));
  const projected=projectBusinessCatalogPrices(copy,eligibleRows,parse(row.catalog_json));
  const byId=new Map(projected.map(value=>[value.id,value]));
  return rows.map(value=>byId.get(value.id)??value);
}
