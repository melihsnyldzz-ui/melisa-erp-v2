const origin='ISOLATED_TEST_COPY';
const id=v=>typeof v==='string'&&/^[1-9]\d*$/.test(v);
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const hash=v=>typeof v==='string'&&/^[A-Fa-f0-9]{64}$/.test(v);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=()=>{throw Error('İşlem bağlantısı doğrulanamadı. Yenileyerek tekrar deneyin.');};
const copyPage=location=>location?.protocol==='http:'&&(location.port==='5204'&&['127.0.0.1','localhost'].includes(location.hostname)||location.port==='5224'&&['127.0.0.1','localhost','192.168.1.46'].includes(location.hostname));
const copyIdentity=location=>location?.port==='5224'?{database:'MELISA_ERP_CRM_SHARED_TEST_20261009_01',date:'2026-10-09'}:{database:'MELISA_ERP_STAGE04_COPY_TEST_20261008_01',date:'2026-10-08'};
const rows=(value,minimum=1)=>Array.isArray(value)&&value.length>=minimum&&value.every(x=>object(x)&&id(x.id))&&new Set(value.map(x=>x.id)).size===value.length;

export function validateOperationCopyBootstrap(profile,location){
 const expected=copyIdentity(location);
 if(!copyPage(location)||!object(profile)||profile.schemaVersion!=='melisa-stage4-isolated-operation-copy.v1'||profile.operationOrigin!==origin||!uuid(profile.copyId)||!hash(profile.sealHash)||!hash(profile.backupSHA)||profile.sourceDatabase!=='MELISA_ERP_SIRKET_TEST_20260929_01'||profile.target?.server!=='Semih\\MELISADEV'||profile.target.database!==expected.database||profile.date!==expected.date||!rows(profile.actors)||profile.actors.some(a=>!['15','16'].includes(a.id)||a.role!==(a.id==='15'?'isolated_test_sales':'isolated_test_ilker'))||!rows(profile.products,2)||!rows(profile.customers)||!rows(profile.suppliers)||!rows(profile.financeAccounts))fail();
 for(const p of profile.products)if(typeof p.sourceKey!=='string'||!/^VEGA2026\/F0102TBLSTOKLAR\/[1-9]\d*$/.test(p.sourceKey)||typeof p.stockCode!=='string'||!p.stockCode||p.unit!=='ADET'||p.unitFactorExact8!=='1.00000000'||!Array.isArray(p.priceIds)||!p.priceIds.length||p.priceIds.some(x=>!id(x))||new Set(p.priceIds).size!==p.priceIds.length||!Array.isArray(p.barcodes)||p.barcodes.some(x=>typeof x!=='string'||!x)||new Set(p.barcodes).size!==p.barcodes.length)fail();
 for(const kind of ['customers','suppliers'])for(const p of profile[kind])if(!id(p.partyId)||!id(p.accountId)||p.currency!=='TRY'||typeof p.sourceKey!=='string'||!new RegExp('^VEGA2026/'+(kind==='customers'?'F0102':'F0103')+'TBLCARI/[1-9]\\d*$').test(p.sourceKey))fail();
 for(const p of profile.financeAccounts)if(p.currency!=='TRY')fail();
 return profile;
}

export function operationCopyFromMeta(meta,{profile=globalThis.window?.__MELISA_OPERATION_COPY__??globalThis.__MELISA_OPERATION_COPY__,location=globalThis.window?.location??globalThis.location}={}){
 const marked=meta?.operationOrigin!==undefined||meta?.copyId!==undefined||meta?.sealHash!==undefined;
 if(!marked){if(copyPage(location))fail();return null;}
 const trusted=validateOperationCopyBootstrap(profile,location);
 if(meta.operationOrigin!==origin||meta.copyId!==trusted.copyId||meta.sealHash!==trusted.sealHash||meta.date!==trusted.date||meta.testProfile!==undefined)fail();
 return trusted;
}

export function operationCopyEntity(entity,kind,profile){
 const expected=profile?.[kind]?.find(x=>x.id===entity?.id);
 if(!expected||entity.synthetic!==false||entity.operationOrigin!==origin)fail();
 if(kind==='products'){
  if(entity.stockCode!==expected.stockCode||entity.unit?.label!==expected.unit||entity.unit.factorExact8!==expected.unitFactorExact8||entity.barcode!==undefined&&entity.barcode!==null&&!expected.barcodes.includes(entity.barcode))fail();
 }else if(entity.currency!==expected.currency)fail();
 return entity;
}

export function operationCopyQuote(quote,productId,profile){
 const p=profile.products.find(x=>x.id===productId);
 if(!p||!p.priceIds.includes(quote?.quoteId)||quote.currency!=='TRY'||quote.source?.kind!=='isolated-test-copy'||quote.source.copyId!==profile.copyId||quote.source.sealHash!==profile.sealHash)fail();
 return quote;
}
