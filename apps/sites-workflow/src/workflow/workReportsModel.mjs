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
function scope(value){if(!value||typeof value.label!=='string'||!value.label||value.timeZone!=='Europe/Istanbul'||!reportDate(value.fromDate)||!reportDate(value.toDateInclusive)||value.fromDate>value.toDateInclusive||!Number.isFinite(Date.parse(value.fromUtc))||!Number.isFinite(Date.parse(value.toUtcExclusive))||Date.parse(value.fromUtc)>=Date.parse(value.toUtcExclusive)||value.historyLimited!==true||!Array.isArray(value.limitations)||value.limitations.some(v=>typeof v!=='string'))fail();const next=new Date(Date.parse(value.toDateInclusive+'T00:00:00Z')+86400000).toISOString().slice(0,10);if(value.fromUtc!==new Date(value.fromDate+'T00:00:00+03:00').toISOString()||value.toUtcExclusive!==new Date(next+'T00:00:00+03:00').toISOString())fail();}
function matchingFilters(data,expectedFilters,expectedOffset){
 const actual=data?.filters;
 if(!actual||typeof actual!=='object')fail();
 for(const key of ['kind','period','currency','brand','type','groupBy','from','to'])if(!Object.hasOwn(actual,key))fail();
 for(const key of ['kind','period','groupBy'])if(actual[key]!==expectedFilters[key])fail();
 for(const key of ['currency','brand','type'])if(actual[key]!== (expectedFilters[key]||null))fail();
 if(!reportDate(actual.from)||!reportDate(actual.to)||actual.from!==data.scope.fromDate||actual.to!==data.scope.toDateInclusive)fail();
 if(expectedFilters.period==='custom'&&(actual.from!==expectedFilters.from||actual.to!==expectedFilters.to))fail();
 if(expectedOffset!==undefined&&(actual.offset!==expectedOffset||actual.limit!==50))fail();
}
function reportRowContract(row,filters,reportScope){
 const date=row.date??'',currency=row.currency??'';
 if(filters.groupBy==='none'?(!reportDate(date)||date<reportScope.fromDate||date>reportScope.toDateInclusive):date!=='')fail();
 if(filters.currency?currency!==filters.currency:currency!==''&&!['TRY','USD','EUR'].includes(currency)||currency===''&&filters.kind!=='stock-movements')fail();
 if(filters.brand&&(filters.groupBy==='none'||filters.groupBy==='brand')&&row.brand!==filters.brand)fail();
 if(filters.type&&(filters.groupBy==='none'||filters.groupBy==='type')&&row.type!==filters.type)fail();
}
export function validateReportContext(data){if(!data?.capabilities||typeof data.capabilities.canViewReports!=='boolean'||typeof data.capabilities.canViewCost!=='boolean'||typeof data.sourceScope!=='string'||!Array.isArray(data.brands)||!Array.isArray(data.types)||[...data.brands,...data.types].some(v=>typeof v!=='string'||!v||v.length>200)||!Array.isArray(data.kinds)||data.kinds.some(v=>!reportKinds.some(([k])=>k===v))||!Array.isArray(data.currencies)||data.currencies.some(v=>!['TRY','USD','EUR'].includes(v)))fail();return data;}
export function validateReportPage(data,{canViewCost=false,expectedFilters,expectedOffset}={}){
 scope(data?.scope);totals(data.currencyTotals);const p=data.pagination;
 if(!p||!count(p.offset)||!count(p.total)||p.limit!==50||typeof p.hasMore!=='boolean'||!Array.isArray(data.rows)||data.rows.length>50||p.offset>p.total||data.rows.length>p.total-p.offset||p.total>p.offset&&data.rows.length===0||p.hasMore!==(p.offset+data.rows.length<p.total))fail();
 if(expectedFilters){matchingFilters(data,expectedFilters,expectedOffset);if(p.offset!==expectedOffset)fail();}
 for(const row of data.rows){if(!row||typeof row!=='object'||!['amount','debit','credit','quantity'].every(k=>row[k]===undefined||exact(row[k]))||!['TRY','USD','EUR'].includes(row.currency)&&!(data.filters?.kind==='stock-movements'&&row.currency===null))fail();reportRowContract(row,data.filters,data.scope);}
 if(!canViewCost&&data.costCoverage!==undefined)fail();
 if(data.costCoverage!==undefined){const c=data.costCoverage;if(!count(c.knownLineCount)||!count(c.unknownLineCount)||c.profitAvailable!==false||typeof c.reason!=='string')fail();}
 return data;
}
function csvRows(content,maxRows){
 if(typeof content!=='string'||!content.startsWith('\uFEFF')||content.length>50_000_000)fail();
 const rows=[];let at=1;
 while(at<content.length){
  if(content.slice(at,at+2)==='\r\n'){rows.push([]);at+=2;}
  else{
   const row=[];let done=false;
   while(!done){
    if(content[at]!=='"')fail();at++;let cell='',closed=false;
    while(at<content.length){const char=content[at++];if(char==='"'){if(content[at]==='"'){cell+='"';at++;}else{closed=true;break;}}else cell+=char;}
    if(!closed)fail();row.push(cell);
    if(content[at]===';')at++;
    else if(content.slice(at,at+2)==='\r\n'){at+=2;done=true;}
    else fail();
   }
   rows.push(row);
  }
  if(rows.length>maxRows)fail();
 }
 return rows;
}
const csvText=value=>{const s=value==null?'':String(value);return /^[\s\uFEFF]*[=+@-]/.test(s)?"'"+s:s;};
function validateCsv(data){
 const f=data.filters,s=data.scope,expected=[['Kapsam',s.label],['Başlangıç',f?.from],['Bitiş (dahil)',f?.to],['Rapor',f?.kind],['Para birimi',f?.currency||'TRY / USD / EUR ayrı'],['Marka',f?.brand],['Ürün türü',f?.type],['Gruplama',f?.groupBy],...s.limitations.map(line=>['Açıklama',line])];
 const columns=['id','date','reference','party','stockCode','brand','type','quantity','unit','currency','amount','debit','credit','status'];
 const rows=csvRows(data.content,expected.length+1+data.rowCount+1+data.currencyTotals.length);let at=0;
 for(const pair of expected){const row=rows[at++];if(row?.length!==2||row[0]!==pair[0]||row[1]!==csvText(pair[1]))fail();}
 if(JSON.stringify(rows[at++])!==JSON.stringify(columns))fail();
 for(let i=0;i<data.rowCount;i++){
  const row=rows[at++],numeric=[7,10,11,12];
  if(row?.length!==columns.length||numeric.some(k=>row[k]!==''&&!/^-?\d+(?:\.\d+)?$/.test(row[k]))||row.some((cell,k)=>!numeric.includes(k)&&/^[\s\uFEFF]*[=+@-]/.test(cell)))fail();
  reportRowContract({date:row[1],currency:row[9],brand:row[5],type:row[6]},f,s);
 }
 if(rows[at++]?.length!==0)fail();
 for(const total of data.currencyTotals){const row=rows[at++],values=['TOPLAM',total.currency,total.amount,total.debit,total.credit,total.recordCount].map(csvText);if(JSON.stringify(row)!==JSON.stringify(values))fail();}
 if(at!==rows.length)fail();
}
export function validateReportExport(data,{expectedFilters}={}){scope(data?.scope);totals(data.currencyTotals);if(expectedFilters)matchingFilters(data,expectedFilters);if(typeof data.content!=='string'||!count(data.rowCount)||data.rowCount>10000||typeof data.fileName!=='string'||!/^[a-zA-Z0-9_-]{1,120}\.csv$/.test(data.fileName))fail();validateCsv(data);return data;}
