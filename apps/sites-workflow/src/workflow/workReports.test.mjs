import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {reportDate,reportAmount,reportQuery,validateReportPage,validateReportExport} from './workReportsModel.mjs';
import {reportCsv} from '../../../api/src/services/workReportsModel.mjs';
const scope=()=>({label:'Kaynak kapsamı: 30 Eylül açılış verisi + Melisa ERP deneme hareketleri',timeZone:'Europe/Istanbul',fromDate:'2026-10-06',toDateInclusive:'2026-10-06',fromUtc:'2026-10-05T21:00:00.000Z',toUtcExclusive:'2026-10-06T21:00:00.000Z',historyLimited:true,limitations:['Önceki Vega satış geçmişi bu rapora dahil değildir.']});
const filters=()=>({kind:'sales',period:'today',from:'',to:'',currency:'',brand:'',type:'',groupBy:'none'});
const context=()=>({sourceScope:scope().label,capabilities:{canViewReports:true,canViewCost:false},brands:['CONCEPT'],types:['TAKIM'],kinds:['sales','collections','purchases','supplier-payments','stock-movements','customer-movements','supplier-movements'],currencies:['TRY','USD','EUR']});
const page=()=>({filters:{...filters(),from:'2026-10-06',to:'2026-10-06',currency:null,brand:null,type:null,offset:0,limit:50},scope:scope(),rows:[],pagination:{offset:0,limit:50,total:0,hasMore:false},currencyTotals:[{currency:'USD',amount:null,debit:null,credit:null,recordCount:0}]});
async function controller(){const source=(await readFile(new URL('./workReports.js',import.meta.url),'utf8')).replace("import './workReports.css';",'').replace("'./workReportsModel.mjs'",JSON.stringify(new URL('./workReportsModel.mjs',import.meta.url).href));return (await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).createWorkReports;}
function root(){const nodes=new Map();return {isConnected:true,innerHTML:'',querySelector(key){if(!nodes.has(key))nodes.set(key,{querySelector:()=>({})});return nodes.get(key);},querySelectorAll(){return [];}};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('period inputs preserve Turkey server half-open range and reject empty, inverse, impossible custom dates',()=>{const f=filters();assert.equal(new URLSearchParams(reportQuery(f)).get('limit'),'50');assert.equal(reportDate('2026-02-30'),false);assert.equal(reportDate('2026-10-06'),true);for(const [from,to] of [['',''],['2026-10-07','2026-10-06'],['2026-02-30','2026-03-01']])assert.throws(()=>reportQuery({...f,period:'custom',from,to}));const q=new URLSearchParams(reportQuery({...f,period:'custom',from:'2026-10-01',to:'2026-10-06',brand:'BABY AURA'}));assert.equal(q.get('brand'),'BABY AURA');assert.equal(q.get('to'),'2026-10-06');assert.equal(validateReportPage(page()).scope.fromUtc,'2026-10-05T21:00:00.000Z');});
test('exact values preserve NULL, leading zeros in product code and separate currencies without float rounding',()=>{assert.equal(reportAmount(null),'Bilinmiyor');assert.equal(reportAmount('0.0000'),'0');assert.equal(reportAmount('9007199254740993.1234'),'9.007.199.254.740.993,1234');assert.throws(()=>reportAmount(1));const p=page();p.rows=[{id:'1',date:'2026-10-06',stockCode:'0161 MOLLY',currency:'USD',amount:'9.6600',quantity:'1.0000'}];p.pagination.total=1;p.currencyTotals=[{currency:'TRY',amount:'100.0000',debit:null,credit:null,recordCount:1},{currency:'USD',amount:'9.6600',debit:null,credit:null,recordCount:1}];assert.equal(validateReportPage(p).rows[0].stockCode,'0161 MOLLY');assert.equal(p.currencyTotals.length,2);});
test('personnel cannot accept a cost-bearing response; authorized coverage has no fabricated profit',()=>{const p=page();p.costCoverage={knownLineCount:1,unknownLineCount:10552,profitAvailable:false,reason:'Kanıtlanmayan maliyet kâra çevrilmez.'};assert.throws(()=>validateReportPage(p));assert.equal(validateReportPage(p,{canViewCost:true}).costCoverage.profitAvailable,false);p.costCoverage.profitAvailable=true;assert.throws(()=>validateReportPage(p,{canViewCost:true}));});
test('stock movement may have no currency, without becoming a financial zero or leaking an unknown money bucket',()=>{const p=page();p.filters.kind='stock-movements';p.rows=[{id:'1',date:'2026-10-06',stockCode:'0161 MOLLY',currency:null,quantity:'-1.0000',amount:null,debit:null,credit:null}];p.pagination.total=1;p.currencyTotals=[];assert.equal(validateReportPage(p),p);p.filters.kind='sales';assert.throws(()=>validateReportPage(p));});
test('unbounded rows, duplicate currency totals and malicious export names are rejected',()=>{const p=page();p.rows=Array.from({length:51},()=>({currency:'USD'}));assert.throws(()=>validateReportPage(p));const p2=page();p2.currencyTotals.push({...p2.currencyTotals[0]});assert.throws(()=>validateReportPage(p2));const exported={scope:p2.scope,filters:p2.filters,currencyTotals:[],fileName:'sales_today.csv',content:reportCsv({...p2,rows:[],currencyTotals:[]}),rowCount:0};assert.equal(validateReportExport(exported),exported);for(const name of ['../../bad.csv','bad.html','javascript:bad.csv'])assert.throws(()=>validateReportExport({...exported,fileName:name}));assert.equal(new URLSearchParams(reportQuery(filters(),{exporting:true})).has('offset'),false);});
test('normal report empty state does not invent money and exact USD amount cannot become combined turnover',async()=>{const create=await controller(),r=root();const ui=create({root:r,session:{reports:async path=>path.endsWith('/context')?context():page()}});ui.mount();await tick();await tick();assert.match(r.innerHTML,/Seçilen dönemde ve filtrelerde kayıt bulunamadı/);assert.match(r.innerHTML,/Bilinmiyor/);assert.match(r.innerHTML,/Önceki Vega satış geçmişi/);assert.doesNotMatch(r.innerHTML,/Toplam ciro|Maliyet kapsamı|DEBUG/);ui.dispose();});
test('supplier movement renders native purchase return cancellation as a reversal in document and status cells',async()=>{
 const create=await controller(),r=root(),p=page(),c=context();c.kinds=['supplier-movements'];p.filters.kind='supplier-movements';
 p.rows=[{id:'1',date:'2026-10-06',reference:'purchase_return_cancel',party:'Deneme tedarikçisi',currency:'USD',debit:'12.3400',credit:'0.0000',status:'purchase_return_cancel'}];p.pagination.total=1;
 p.currencyTotals=[{currency:'USD',amount:'12.3400',debit:'12.3400',credit:'0.0000',recordCount:1}];
 const ui=create({root:r,session:{reports:async path=>path.endsWith('/context')?c:p}});ui.mount();await tick();await tick();
 const body=r.innerHTML.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1]??'';
 assert.equal((body.match(/Alış iadesi ters kaydı/g)??[]).length,2);assert.doesNotMatch(body,/purchase_return_cancel|Kayıtlı işlem/);
 assert.match(body,/<td class="numeric">12,34<\/td><td class="numeric">0,00<\/td>/);ui.dispose();
});
test('403 report access is a clean error, stale completion after dispose does not repaint',async()=>{const create=await controller(),r=root();const ui=create({root:r,session:{reports:async()=>{throw Object.assign(new Error(),{status:403});}}});ui.mount();await tick();assert.match(r.innerHTML,/görüntüleme yetkiniz yok/);ui.dispose();let resolve;const r2=root(),u2=create({root:r2,session:{reports:()=>new Promise(r=>resolve=r)}});u2.mount();const original=r2.innerHTML;u2.dispose();resolve(context());await tick();assert.equal(r2.innerHTML,original);});
test('recorded cost coverage is labelled as record presence without declaring verified cost or calculated profit',async()=>{
 const create=await controller();for(const unknownLineCount of [0,1]){const r=root(),c=context(),p=page();c.capabilities.canViewCost=true;p.rows=[{id:'1',date:'2026-10-06',reference:'SALE-FIXTURE',party:'Anonim müşteri',currency:'TRY',amount:'10.0000'}];p.pagination.total=1;p.currencyTotals=[{currency:'TRY',amount:'10.0000',debit:null,credit:null,recordCount:1}];p.costCoverage={knownLineCount:2,unknownLineCount,profitAvailable:false,reason:'İşlem maliyeti kaydı olan ve olmayan satırlar ayrıdır. Doğrulanmamış maliyetten kâr hesaplanmaz.'};const before=JSON.stringify(p),calls=[],ui=create({root:r,session:{reports:async path=>{calls.push(path);return path.endsWith('/context')?c:p;}}});ui.mount();await tick();await tick();assert.match(r.innerHTML,/Maliyet kaydı olan: 2 satır/);assert.ok(r.innerHTML.includes('Maliyet kaydı olmayan: '+unknownLineCount+' satır'));assert.match(r.innerHTML,/Doğrulanmamış maliyetten kâr hesaplanmaz/);assert.doesNotMatch(r.innerHTML,/Maliyeti kanıtlı|Maliyeti bilinmiyor|Kâr toplamı|Kâr oranı/);assert.match(r.innerHTML,/10,00/);assert.equal(p.costCoverage.profitAvailable,false);assert.equal(JSON.stringify(p),before);assert.deepEqual(calls,['/api/work-reports/context','/api/work-reports?'+reportQuery(filters())]);ui.dispose();}
});

test('page and CSV responses must echo the exact requested filters before use',()=>{
 const requested={...filters(),period:'custom',from:'2026-10-01',to:'2026-10-06',currency:'USD',brand:'CONCEPT',type:'TAKIM',groupBy:'brand'};
 const p=page();p.filters={...requested,offset:50,limit:50};p.scope={...scope(),fromDate:requested.from,fromUtc:'2026-09-30T21:00:00.000Z'};p.pagination={offset:50,limit:50,total:50,hasMore:false};
 assert.equal(validateReportPage(p,{expectedFilters:requested,expectedOffset:50}),p);
 for(const change of [{kind:'purchases'},{period:'today'},{from:'2026-10-02'},{to:'2026-10-05'},{currency:'TRY'},{brand:'OTHER'},{type:'OTHER'},{groupBy:'none'},{offset:0},{limit:25}]){
  const wrong=structuredClone(p);Object.assign(wrong.filters,change);assert.throws(()=>validateReportPage(wrong,{expectedFilters:requested,expectedOffset:50}),JSON.stringify(change));
 }
 const wrongPage=structuredClone(p);wrongPage.pagination.offset=0;
 assert.throws(()=>validateReportPage(wrongPage,{expectedFilters:requested,expectedOffset:50}));
 const exported={scope:p.scope,currencyTotals:[],fileName:'sales_today.csv',content:reportCsv({...p,rows:[],currencyTotals:[]}),rowCount:0,filters:{...requested,offset:0,limit:1}};
 assert.equal(validateReportExport(exported,{expectedFilters:requested}),exported);
 for(const change of [{kind:'purchases'},{period:'today'},{currency:'TRY'},{from:'2026-10-02'},{groupBy:'none'}]){
  const wrong=structuredClone(exported);Object.assign(wrong.filters,change);assert.throws(()=>validateReportExport(wrong,{expectedFilters:requested}),JSON.stringify(change));
 }
});

test('wrong response kind is not rendered and wrong CSV filters cannot trigger a download',async()=>{
 const create=await controller(),r=root(),p=page(),downloads=[];p.filters.kind='purchases';
 const ui=create({root:r,session:{reports:async path=>path.endsWith('/context')?context():p},download:(...args)=>downloads.push(args)});
 ui.mount();await tick();await tick();
 assert.match(r.innerHTML,/Rapor şu anda okunamıyor/);assert.doesNotMatch(r.innerHTML,/Seçilen dönemde ve filtrelerde kayıt bulunamadı/);
 ui.dispose();
 const r2=root(),valid=page(),exported={scope:scope(),currencyTotals:[],fileName:'sales_today.csv',content:'test',rowCount:1,filters:{...valid.filters,kind:'purchases'}};
 const ui2=create({root:r2,session:{reports:async path=>path.endsWith('/context')?context():path.includes('/export?')?exported:valid},download:(...args)=>downloads.push(args)});
 ui2.mount();await tick();await tick();r2.querySelector('[data-report-export]').onclick();await tick();
 assert.equal(downloads.length,0);assert.match(r2.innerHTML,/CSV şu anda hazırlanamadı/);ui2.dispose();
});

test('wrong period, currency or next-page offset leaves a visible refresh path',async()=>{
 const create=await controller();
 for(const changed of [{period:'yesterday'},{currency:'USD'}]){
  const r=root(),p=page();Object.assign(p.filters,changed);
  const ui=create({root:r,session:{reports:async path=>path.endsWith('/context')?context():p}});ui.mount();await tick();await tick();
  assert.match(r.innerHTML,/Rapor şu anda okunamıyor/);assert.match(r.innerHTML,/data-report-refresh >Yenile/);ui.dispose();
 }
 const r=root(),first=page(),wrong=page();first.rows=[{id:'1',date:'2026-10-06',currency:'USD',amount:null}];first.pagination={offset:0,limit:50,total:51,hasMore:true};
 wrong.rows=[{id:'2',date:'2026-10-06',currency:'USD',amount:null}];wrong.pagination={offset:0,limit:50,total:51,hasMore:true};
 const ui=create({root:r,session:{reports:async path=>path.endsWith('/context')?context():path.includes('offset=50')?wrong:first}});
 ui.mount();await tick();await tick();assert.match(r.innerHTML,/data-report-next >/);
 r.querySelector('[data-report-next]').onclick();await tick();
 assert.match(r.innerHTML,/Rapor şu anda okunamıyor/);assert.match(r.innerHTML,/data-report-refresh >Yenile/);ui.dispose();
});

test('matching CSV response reaches the download callback with its exact content',async()=>{
 const create=await controller(),r=root(),p=page(),downloads=[];
 const rows=[{id:'1',date:'2026-10-06',currency:'USD',amount:'1.2500'}];
 const exported={scope:scope(),currencyTotals:[],fileName:'sales_today.csv',content:reportCsv({...p,rows,currencyTotals:[]}),rowCount:1,filters:{...p.filters}};
 const ui=create({root:r,session:{reports:async path=>path.endsWith('/context')?context():path.includes('/export?')?exported:p},download:(...args)=>downloads.push(args)});
 ui.mount();await tick();await tick();r.querySelector('[data-report-export]').onclick();await tick();
 assert.deepEqual(downloads,[[exported.fileName,exported.content]]);assert.match(r.innerHTML,/Aktif filtreler ve döviz ayrımı korundu/);ui.dispose();
});

test('scope half-open UTC boundaries must equal the returned Istanbul calendar days',()=>{
 const p=page(),request=filters();assert.equal(validateReportPage(p,{expectedFilters:request,expectedOffset:0}),p);
 for(const changed of [{fromUtc:'2026-10-06T00:00:00Z'},{toUtcExclusive:'2026-10-07T00:00:00Z'},{fromUtc:'2026-10-05T21:00:01Z'}]){
  const wrong=structuredClone(p);Object.assign(wrong.scope,changed);assert.throws(()=>validateReportPage(wrong,{expectedFilters:request,expectedOffset:0}),JSON.stringify(changed));
 }
});

test('page rejects impossible row counts and an empty nonzero page',()=>{
 const p=page();p.rows=[{id:'1',currency:'USD'}];p.pagination.total=0;assert.throws(()=>validateReportPage(p));
 const empty=page();empty.pagination.total=51;empty.pagination.hasMore=true;assert.throws(()=>validateReportPage(empty));
 const beyond=page();beyond.pagination={offset:50,limit:50,total:51,hasMore:false};beyond.rows=[{currency:'USD'},{currency:'USD'}];assert.throws(()=>validateReportPage(beyond));
});

test('CSV body must bind to metadata, exact rowCount and safely escaped cells',()=>{
 const p=page(),request=filters(),rows=[{id:'1',date:'2026-10-06',reference:'A;"B"\r\nC',currency:'USD',amount:'1.2500'}];
 const valid={scope:p.scope,filters:p.filters,currencyTotals:p.currencyTotals,fileName:'sales_today.csv',content:reportCsv({...p,rows}),rowCount:1};
 assert.equal(validateReportExport(valid,{expectedFilters:request}),valid);
 for(const changed of [
  {content:'test'},
  {content:valid.content.replace('"sales"','"purchases"')},
  {content:valid.content.replace('"2026-10-06"','"2026-10-05"')},
  {content:valid.content.replace('"A;""B""\r\nC"','"A;"B"\r\nC"')},
  {rowCount:2},
  {content:valid.content.replace('"TOPLAM";"USD"','"TOPLAM";"EUR"')},
 ])assert.throws(()=>validateReportExport({...valid,...changed},{expectedFilters:request}),JSON.stringify(Object.keys(changed)));
});

test('CSV data rows stay within selected day, currency and projected product filters',()=>{
 const p=page(),requested={...filters(),currency:'USD',brand:'CONCEPT',type:'TAKIM'};
 Object.assign(p.filters,{currency:'USD',brand:'CONCEPT',type:'TAKIM'});
 const row={id:'1',date:'2026-10-06',reference:'S-1',brand:'CONCEPT',type:'TAKIM',currency:'USD',amount:'-1.2500'};
 const exportedFor=changed=>({scope:p.scope,filters:p.filters,currencyTotals:[],fileName:'sales_today.csv',rowCount:1,content:reportCsv({...p,rows:[{...row,...changed}],currencyTotals:[]})});
 assert.equal(validateReportExport(exportedFor({}),{expectedFilters:requested}).rowCount,1);
 for(const changed of [{date:'2026-10-05'},{date:'2026-10-07'},{date:null},{currency:'EUR'},{currency:null},{brand:'OTHER'},{type:'OTHER'}])assert.throws(()=>validateReportExport(exportedFor(changed),{expectedFilters:requested}),JSON.stringify(changed));
});

test('grouped CSV has no row date and can omit nonprojected filter dimensions',()=>{
 const p=page(),requested={...filters(),groupBy:'brand',currency:'USD',brand:'CONCEPT',type:'TAKIM'};
 Object.assign(p.filters,{groupBy:'brand',currency:'USD',brand:'CONCEPT',type:'TAKIM'});
 const rows=[{id:'group:CONCEPT:USD',date:null,brand:'CONCEPT',type:null,currency:'USD',quantity:'2.0000',amount:'10.0000'}];
 const result={scope:p.scope,filters:p.filters,currencyTotals:[],fileName:'sales_today.csv',rowCount:1,content:reportCsv({...p,rows,currencyTotals:[]})};
 assert.equal(validateReportExport(result,{expectedFilters:requested}),result);
});

test('stock CSV keeps unknown currency only without a currency selection',()=>{
 const p=page(),requested={...filters(),kind:'stock-movements'};p.filters.kind='stock-movements';
 const rows=[{id:'1',date:'2026-10-06',currency:null,quantity:'-1.0000'}];
 const result={scope:p.scope,filters:p.filters,currencyTotals:[],fileName:'stock_today.csv',rowCount:1,content:reportCsv({...p,rows,currencyTotals:[]})};
 assert.equal(validateReportExport(result,{expectedFilters:requested}),result);
 const selected=structuredClone(result);selected.filters.currency='USD';selected.content=reportCsv({...selected,rows,currencyTotals:[]});
 assert.throws(()=>validateReportExport(selected,{expectedFilters:{...requested,currency:'USD'}}));
});

test('CSV text cells reject unescaped spreadsheet formulas while numeric negatives remain valid',()=>{
 const p=page(),rows=[{id:'1',date:'2026-10-06',reference:'  =SUM(1)',currency:'USD',amount:'-1.2500'}];
 const result={scope:p.scope,filters:p.filters,currencyTotals:[],fileName:'sales_today.csv',rowCount:1,content:reportCsv({...p,rows,currencyTotals:[]})};
 assert.equal(validateReportExport(result,{expectedFilters:filters()}),result);
 const unsafe={...result,content:result.content.replace('"\'  =SUM(1)"','"  =SUM(1)"')};
 assert.throws(()=>validateReportExport(unsafe,{expectedFilters:filters()}));
});

test('page rows must agree with requested day, currency and projected brand/type',()=>{
 const p=page(),requested={...filters(),period:'custom',from:'2026-10-06',to:'2026-10-06',currency:'USD',brand:'CONCEPT',type:'TAKIM'};
 Object.assign(p.filters,requested);p.rows=[{id:'1',date:'2026-10-06',currency:'USD',brand:'CONCEPT',type:'TAKIM',amount:'1.2500'}];p.pagination.total=1;
 assert.equal(validateReportPage(p,{expectedFilters:requested,expectedOffset:0}),p);
 for(const changed of [{date:'2026-10-01'},{date:null},{currency:'TRY'},{currency:null},{brand:'OTHER'},{type:'OTHER'}]){
  const wrong=structuredClone(p);Object.assign(wrong.rows[0],changed);
  assert.throws(()=>validateReportPage(wrong,{expectedFilters:requested,expectedOffset:0}),JSON.stringify(changed));
 }
});

test('wrong page row is hidden with a visible retry state',async()=>{
 const create=await controller(),r=root(),p=page();p.rows=[{id:'1',date:'2026-10-01',currency:'TRY',amount:'9.0000'}];p.pagination.total=1;
 const ui=create({root:r,session:{reports:async path=>path.endsWith('/context')?context():p}});
 ui.mount();await tick();await tick();
 assert.match(r.innerHTML,/Rapor şu anda okunamıyor/);assert.match(r.innerHTML,/data-report-refresh >Yenile/);assert.doesNotMatch(r.innerHTML,/9,00/);ui.dispose();
});

test('grouped page permits omitted date and nonprojected type but checks projected brand',()=>{
 const p=page(),requested={...filters(),groupBy:'brand',currency:'USD',brand:'CONCEPT',type:'TAKIM'};
 Object.assign(p.filters,{groupBy:'brand',currency:'USD',brand:'CONCEPT',type:'TAKIM'});p.rows=[{id:'group:CONCEPT:USD',date:null,brand:'CONCEPT',type:null,currency:'USD',quantity:'2.0000',amount:'10.0000'}];p.pagination.total=1;
 assert.equal(validateReportPage(p,{expectedFilters:requested,expectedOffset:0}),p);
 p.rows[0].brand='OTHER';assert.throws(()=>validateReportPage(p,{expectedFilters:requested,expectedOffset:0}));
});
