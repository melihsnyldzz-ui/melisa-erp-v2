const fail=()=>{throw Error('İş sırası şu anda okunamıyor. Yeniden deneyin.');};
const statuses=['available','forbidden','unavailable'];
const number=v=>Number.isSafeInteger(v)&&v>=0;
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v));
const exact=v=>v===null||typeof v==='string'&&/^-?(?:0|[1-9]\d{0,33})\.\d{4}$/.test(v);
export const homeTargets=['goods','purchases','sales','receipts','finance','customers','suppliers','count-test','count-cancel','return-sales','return-purchase'].map(x=>'/is-akisi-taslagi.html#'+x);
export const homeShortcuts=[{id:'goods',capability:'goods',label:'Mal Kabul',icon:'⇩',href:'/is-akisi-taslagi.html#goods'},{id:'sales',capability:'sales',label:'Satış',icon:'▣',screen:'sales'},{id:'collections',capability:'collection',label:'Tahsilat',icon:'₺',screen:'collections'},{id:'stock',capability:'product',label:'Ürün & Stok',icon:'▦',screen:'stock'},{id:'customers',capability:'customer',label:'Müşteriler',icon:'♙',screen:'customers'},{id:'suppliers',capability:'supplier',label:'Tedarikçiler',icon:'▧',href:'/is-akisi-taslagi.html#suppliers'}];
export function homeAmount(value){if(!exact(value))fail();if(value===null)return 'Bilinmiyor';const [whole,fraction]=value.split('.'),trimmed=fraction.replace(/0+$/,'');return whole.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(trimmed?','+trimmed:'');}
export function homeCount(value){return value===null?'Bilinmiyor':number(value)?value.toLocaleString('tr-TR'):fail();}
function totals(rows){if(!Array.isArray(rows)||rows.length>3||new Set(rows.map(r=>r.currency)).size!==rows.length)fail();for(const r of rows)if(!['TRY','USD','EUR'].includes(r.currency)||!exact(r.amountExact4)||!number(r.knownCount)||!number(r.unknownCount))fail();}
export function validateWorkHome(data){
 const m=data?.meta;if(m?.schemaVersion!=='melisa-home.v1'||!day(m.date)||m.timeZone!=='Europe/Istanbul'||m.readOnly!==true||typeof m.readAt!=='string'||!Number.isFinite(Date.parse(m.readAt))||m.source!=='native-test')fail();
 const rights=['goods','purchase','sales','collection','product','customer','supplier','finance','payment','count','returns','approval'];
 if(!data.capabilities||!rights.every(k=>typeof data.capabilities[k]==='boolean')||!data.navigationReady||!rights.filter(k=>!['finance','payment'].includes(k)).every(k=>typeof data.navigationReady[k]==='boolean'&&(!data.navigationReady[k]||data.capabilities[k])))fail();
 const definitions={sales:['count','cancelledCount'],goods:['pendingCount'],finance:[],refunds:['salesCount','purchaseCount','cancelledCount'],counts:['pendingCount'],approvals:['pendingCount']};
 for(const [key,fields] of Object.entries(definitions)){const s=data.sections?.[key];if(!s||!statuses.includes(s.status)||fields.some(k=>s[k]!==null&&!number(s[k]))||s.status!=='available'&&fields.some(k=>s[k]!==null))fail();}
 totals(data.sections.sales.currencyTotals);for(const k of ['collections','payments','reversals'])totals(data.sections.finance[k]);
 for(const [s,keys] of [[data.sections.sales,['currencyTotals']],[data.sections.finance,['collections','payments','reversals']]])if(s.status!=='available'&&keys.some(k=>s[k].length))fail();
 const cash=data.sections.finance.cash;if(!cash||!statuses.includes(cash.status))fail();totals(cash.currencyTotals);if(cash.status!=='available'&&cash.currencyTotals.length)fail();
 if(!Array.isArray(data.tasks)||data.tasks.length>5||new Set(data.tasks.map(t=>t.id)).size!==data.tasks.length)fail();
 for(const t of data.tasks)if(typeof t.id!=='string'||!t.id||typeof t.kind!=='string'||!t.kind||typeof t.label!=='string'||!t.label||typeof t.state!=='string'||!t.state||typeof t.ready!=='boolean'||!(t.date===null||day(t.date))||!homeTargets.includes(t.target))fail();
 return data;
}
export function homeUnavailable(status){return status==='forbidden'?'Görüntüleme yetkiniz yok':'Henüz bağlı değil';}
export function orderedHomeShortcuts(capabilities,user){
 const order=capabilities.purchase||capabilities.payment||capabilities.finance?['goods','collections','suppliers','stock','customers','sales']:capabilities.sales?['customers','stock','sales','goods','collections','suppliers']:homeShortcuts.map(s=>s.id);
 return order.map(id=>homeShortcuts.find(s=>s.id===id));
}
export function orderedHomeTasks(tasks,user){return user?.role?.code==='admin'?[...tasks].sort((a,b)=>Number(b.kind==='approval')-Number(a.kind==='approval')||Number(b.state==='pending')-Number(a.state==='pending')):tasks;}

export function homeNormalScreen(target){return {'/is-akisi-taslagi.html#sales':'sales','/is-akisi-taslagi.html#receipts':'receipts','/is-akisi-taslagi.html#finance':'collections','/is-akisi-taslagi.html#customers':'customers'}[target]??null;}
