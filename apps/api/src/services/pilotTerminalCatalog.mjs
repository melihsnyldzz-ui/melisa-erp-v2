import {pilotProductScopeSql} from './pilotProductScope.mjs';
import {createHmac,timingSafeEqual,createHash} from 'node:crypto';
import {getSqlPool,getSqlDriver} from '../config/database.js';
import {getCurrencyRates} from './currencyRateService.js';
import {getTerminalOperatorContext} from './terminalService.js';
import {pilotCashSql} from './pilotCashPolicy.mjs';

export const pilotScope={source:'melisa',database:'MELISA_ERP_V2',company:'MELISA',period:'PILOT-20260913'};
export const pilotCatalogScope='melisa:MELISA_ERP_V2:PILOT-20260913:terminal-catalog-v1';
export function pilotError(code,message,statusCode=409){throw Object.assign(new Error(message),{code,statusCode});}
function canonical(value){return Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;}
export const pilotDigest=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function signature(value){const key=process.env.PILOT_SIGNING_KEY;if(!/^[a-f0-9]{64}$/.test(key||''))pilotError('PILOT_KEY_REQUIRED','Pilot imza ayarı eksik.',503);return createHmac('sha256',Buffer.from(key,'hex')).update('melisa-pilot-v1\n'+JSON.stringify(canonical(value))).digest('hex');}
export function issuePilotCard(kind,data){const value={version:1,kind,company:pilotScope.company,period:pilotScope.period,issuedAt:new Date().toISOString(),data};return {...value,signature:signature(value)};}
export function verifyPilotCard(card,kind){
 if(card?.version!==1||card.kind!==kind||card.company!==pilotScope.company||card.period!==pilotScope.period||!card.data||typeof card.data!=='object'||!Number.isFinite(Date.parse(card.issuedAt))||Date.parse(card.issuedAt)>Date.now()+300000)pilotError('PILOT_SNAPSHOT_INVALID','Fişin Melisa kaynak kaydı geçersiz. Verileri güncelleyin.');
 const {signature:sig,...value}=card;
 if(!/^[a-f0-9]{64}$/.test(sig||'')||!timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(signature(value),'hex')))pilotError('PILOT_SNAPSHOT_UNTRUSTED','Fişin kaynak verisi doğrulanamadı.');
 return card.data;
}
export async function pilotRates(){const rates=await getCurrencyRates({});return {...rates,rateSnapshot:issuePilotCard('rates',rates)};}
export async function pilotContext(terminalCode,actor){
 const rateSet=await pilotRates();
 const permissions=actor?.permissions||[];
 if(!permissions.includes('terminal.sales.create')&&!(permissions.includes('sales.create')&&permissions.includes('sales.finalize')))return {offlineContext:null,rateSet,capability:{enabled:false,temporary:false,code:'TERMINAL_SALE_PERMISSION_REQUIRED',message:'Fiş gönderme yetkisi gerekli.'}};
 try {
  const operator=await getTerminalOperatorContext(terminalCode,actor?.id);
  const approved=process.env.PILOT_RATE_APPROVED==='true';
  return {offlineContext:issuePilotCard('context',{terminalCode,username:actor.username.toLowerCase(),actorUserId:Number(actor.id),operator}),rateSet,capability:{enabled:approved,temporary:!approved,code:approved?'MELISA_PILOT_READY':'PILOT_RATE_APPROVAL_REQUIRED',message:approved?'Melisa satış bağlantısı hazır.':'Pilot kur onayı bekleniyor; taslak korunuyor.'}};
 }catch(e){if(e.statusCode===403||e.statusCode===409)return {offlineContext:null,rateSet,capability:{enabled:false,temporary:false,code:e.code,message:e.message}};throw e;}
}
export async function pilotCatalog(kind,query={}){
 if(!['product','customer'].includes(kind))pilotError('PILOT_CATALOG_KIND','Geçersiz katalog.',400);
 for(const [k,v] of Object.entries(pilotScope))if(query[k]!==undefined&&query[k]!==v)pilotError('PILOT_SOURCE_MISMATCH','Bu bağlantı yalnız Melisa pilot verisini kullanır.',400);
 const pool=await getSqlPool(),sql=getSqlDriver();
 const q=String(query.q||query.search||'').trim().toLocaleLowerCase('tr-TR'),barcode=String(query.barcode||'').trim();
 const page=Number(query.page||1),limit=Math.min(500,Number(query.limit||30));
 if(!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(limit)||limit<1)pilotError('PILOT_PAGE_INVALID','Geçersiz sayfa.',400);
 let rows;
 if(kind==='product'){
  rows=(await pool.request().query(`SELECT p.id,p.stock_code AS stockCode,p.name AS productName,p.brand,p.category,p.unit,p.currency_code AS currency,p.sales_price AS salePrice,p.current_stock_qty AS stockQuantity,b.barcode,b.id AS unitId,
   (SELECT x.barcode FROM dbo.product_barcodes x WHERE x.product_id=p.id AND x.is_active=1 ORDER BY x.is_primary DESC,x.id FOR JSON PATH) AS barcodeRows
   FROM dbo.products p OUTER APPLY(SELECT TOP(1) x.id,x.barcode FROM dbo.product_barcodes x WHERE x.product_id=p.id AND x.is_active=1 ORDER BY x.is_primary DESC,x.id)b
   WHERE p.is_active=1 AND p.is_deleted=0 AND ${pilotProductScopeSql('p.id')} ORDER BY p.stock_code,p.id`)).recordset;
  rows=rows.map(({barcodeRows,...row})=>({...row,barcode:row.barcode||'',barcodes:JSON.parse(barcodeRows||'[]').map(b=>b.barcode)}));
 }else rows=(await pool.request().query(`SELECT id,customer_code AS customerCode,name AS customerName,currency_code AS currency,balance,phone FROM dbo.customers WHERE is_active=1 AND is_deleted=0 AND customer_code IN (${pilotCashSql}) ORDER BY customer_code,id`)).recordset;
 rows=rows.filter(row=>(!barcode||(row.barcodes||[]).includes(barcode))&&(!q||[row.stockCode,row.productName,row.barcode,...(row.barcodes||[]),row.customerCode,row.customerName].some(v=>String(v||'').toLocaleLowerCase('tr-TR').includes(q))));
 const total=rows.length;
 const data=rows.slice((page-1)*limit,page*limit).map(row=>{
  const id=Number(row.id),base={...row,id:String(id),...pilotScope,sourceId:id,sourceContext:{...pilotScope}};
  if(kind==='product')return {...base,unitId:Number(row.unitId),matchedBarcode:barcode||row.barcode,barcodeMasked:row.barcode,saleWritable:true,offlineCard:issuePilotCard('product',{id,stockId:id,unitId:Number(row.unitId),barcode:row.barcode,barcodes:row.barcodes,stockCode:row.stockCode,unit:row.unit,factor:1,taxRate:0,price:Number(row.salePrice),currency:row.currency})};
  return {...base,offlineCard:issuePilotCard('customer',{id,code:row.customerCode,customerName:row.customerName,currency:row.currency})};
 });
 return {data,meta:{source:'melisa-pilot-sql',sourceContext:pilotScope,page,limit,total,totalPages:Math.max(1,Math.ceil(total/limit)),hasNextPage:page*limit<total,saleWriteEnabled:true}};
}
