export {moneyDisplay} from './moneyDisplay.mjs';
export const reportKinds=[['sales','Satışlar'],['collections','Tahsilatlar'],['purchases','Alışlar'],['supplier-payments','Tedarikçi ödemeleri'],['stock-movements','Stok hareketleri'],['customer-movements','Müşteri hareketleri'],['supplier-movements','Tedarikçi hareketleri']];
export const reportPeriods=[['today','Bugün'],['yesterday','Dün'],['last7','Son 7 gün'],['month','Bu ay'],['previous-month','Önceki ay'],['custom','Özel tarih aralığı']];
const fail=()=>{throw Error('Rapor bilgileri doğrulanamadı. Yenileyerek tekrar deneyin.');};
const exact=v=>v===null||typeof v==='string'&&/^-?\d{1,34}(?:\.\d{1,8})?$/.test(v);
const count=v=>Number.isSafeInteger(v)&&v>=0;
export function reportDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const stamp=Date.parse(value+'T00:00:00Z');return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value;}
export function reportAmount(value){if(value===null||value===undefined)return 'Bilinmiyor';if(!exact(value))fail();let [whole,fraction='']=value.split('.');fraction=fraction.replace(/0+$/,'');return whole.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(fraction?','+fraction:'');}
export function reportQuery(filters,{offset=0,exporting=false}={}){
 if(!reportKinds.some(([key])=>key===filters.kind)||!reportPeriods.some(([key])=>key===filters.period)||!['none','brand','type','product'].includes(filters.groupBy)||!['','TRY','USD','EUR'].includes(filters.currency)||!count(offset))fail();
 if(filters.kind!=='sales'&&filters.groupBy!=='none')fail();
 if(filters.period==='custom'&&(!reportDate(filters.from)||!reportDate(filters.to)||filters.from>filters.to||Date.parse(filters.to)-Date.parse(filters.from)>365*86400000))throw Error('Başlangıç ve bitiş tarihlerini kontrol edin. Tarih aralığı bir yılı aşmamalı.');
 const query=new URLSearchParams({kind:filters.kind,period:filters.period,groupBy:filters.groupBy});
 for(const key of ['currency','brand','type'])if(filters[key]){if(typeof filters[key]!=='string'||filters[key].length>200)fail();query.set(key,filters[key]);}
 if(filters.period==='custom'){query.set('from',filters.from);query.set('to',filters.to);}
 if(!exporting){query.set('offset',String(offset));query.set('limit','50');}
 return query.toString();
}
function totals(rows){if(!Array.isArray(rows)||rows.length>3||new Set(rows.map(r=>r.currency)).size!==rows.length)fail();for(const row of rows)if(!['TRY','USD','EUR'].includes(row.currency)||!['amount','debit','credit'].every(key=>exact(row[key]))||!count(row.recordCount))fail();}
function scope(value){if(!value||typeof value.label!=='string'||!value.label||value.timeZone!=='Europe/Istanbul'||!reportDate(value.fromDate)||!reportDate(value.toDateInclusive)||value.fromDate>value.toDateInclusive||!Number.isFinite(Date.parse(value.fromUtc))||!Number.isFinite(Date.parse(value.toUtcExclusive))||Date.parse(value.fromUtc)>=Date.parse(value.toUtcExclusive)||value.historyLimited!==true||!Array.isArray(value.limitations)||value.limitations.some(v=>typeof v!=='string'))fail();}
export function validateReportContext(data){if(!data?.capabilities||typeof data.capabilities.canViewReports!=='boolean'||typeof data.capabilities.canViewCost!=='boolean'||typeof data.sourceScope!=='string'||!Array.isArray(data.brands)||!Array.isArray(data.types)||[...data.brands,...data.types].some(v=>typeof v!=='string'||!v||v.length>200)||!Array.isArray(data.kinds)||data.kinds.some(v=>!reportKinds.some(([k])=>k===v))||!Array.isArray(data.currencies)||data.currencies.some(v=>!['TRY','USD','EUR'].includes(v)))fail();return data;}
export function validateReportPage(data,{canViewCost=false}={}){
 scope(data?.scope);totals(data.currencyTotals);const p=data.pagination;
 if(!p||!count(p.offset)||!count(p.total)||p.limit!==50||typeof p.hasMore!=='boolean'||!Array.isArray(data.rows)||data.rows.length>50||p.offset>p.total||p.hasMore!==(p.offset+data.rows.length<p.total))fail();
 for(const row of data.rows){if(!row||typeof row!=='object'||!['amount','debit','credit','quantity'].every(k=>row[k]===undefined||exact(row[k]))||!['TRY','USD','EUR'].includes(row.currency)&&!(data.filters?.kind==='stock-movements'&&row.currency===null))fail();}
 if(!canViewCost&&data.costCoverage!==undefined)fail();
 if(data.costCoverage!==undefined){const c=data.costCoverage;if(!count(c.knownLineCount)||!count(c.unknownLineCount)||c.profitAvailable!==false||typeof c.reason!=='string')fail();}
 return data;
}
export function validateReportExport(data){scope(data?.scope);totals(data.currencyTotals);if(typeof data.content!=='string'||!count(data.rowCount)||data.rowCount>10000||typeof data.fileName!=='string'||!/^[a-zA-Z0-9_-]{1,120}\.csv$/.test(data.fileName))fail();return data;}
