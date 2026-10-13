import {operationCopyFromMeta,operationCopyDailySelection} from './isolatedOperationCopyModel.mjs';
export {moneyDisplay} from './moneyDisplay.mjs';
const fail=()=>{throw Error('İş sırası şu anda okunamıyor. Yeniden deneyin.');};
const statuses=['available','forbidden','unavailable'];
const number=v=>Number.isSafeInteger(v)&&v>=0;
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v));
const exact=v=>v===null||typeof v==='string'&&/^-?(?:0|[1-9]\d{0,33})\.\d{4}$/.test(v);
export const homeTargets=['goods','purchases','sales','receipts','finance','customers','suppliers','count-test','count-cancel','return-sales','return-purchase'].map(x=>'/is-akisi-taslagi.html#'+x);
export const homeShortcuts=[{id:'goods',capability:'goods',label:'Mal Kabul',icon:'⇩',screen:'goods'},{id:'sales',capability:'sales',label:'Satış',icon:'▣',screen:'sales'},{id:'collections',capability:'collection',label:'Tahsilat',icon:'₺',screen:'collections'},{id:'stock',capability:'product',label:'Ürün & Stok',icon:'▦',screen:'stock'},{id:'customers',capability:'customer',label:'Müşteriler',icon:'♙',screen:'customers'},{id:'suppliers',capability:'supplier',label:'Tedarikçiler',icon:'▧',screen:'suppliers'}];
export function homeAmount(value){if(!exact(value))fail();if(value===null)return 'Bilinmiyor';const [whole,fraction]=value.split('.'),trimmed=fraction.replace(/0+$/,'');return whole.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(trimmed?','+trimmed:'');}
export function homeCount(value){return value===null?'Bilinmiyor':number(value)?value.toLocaleString('tr-TR'):fail();}
export function homeWorkday(data,now=new Date()){
 validateWorkHome(data);
 const copy=operationCopyFromMeta(data.meta),today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul'}).format(now);
 const dated=!!copy&&data.meta.date!==today;
 const dailyFlow=copy?.scopeKind==='VERIFIED_BUSINESS_TEST'&&data.meta.dailySelectionReady===true&&!!operationCopyDailySelection(copy);
 return {dailyFlow,scopeLabel:dailyFlow?'Günlük akış özeti':null,scopeNote:dailyFlow?'Bu özet kayıtlı günlük akıştaki işlemleri gösterir. Diğer kayıtları Raporlar bölümünden inceleyebilirsiniz.':null,date:data.meta.date,workdayText:copy?'İş günü: '+data.meta.date.split('-').reverse().join('.'):null,prefix:dailyFlow?'Günlük akış':dated?'İş günündeki':'Bugünkü',tasksLabel:dated?'İş gününün işleri':'Bugünkü işler',subtitle:dated?'İş gününün işlerini görün; yapmak istediğiniz işlemi açın.':'Bugünkü işleri görün; yapmak istediğiniz işlemi açın.'};
}
function totals(rows){if(!Array.isArray(rows)||rows.length>3||new Set(rows.map(r=>r.currency)).size!==rows.length)fail();for(const r of rows)if(!['TRY','USD','EUR'].includes(r.currency)||!exact(r.amountExact4)||!number(r.knownCount)||!number(r.unknownCount))fail();}
export function validateWorkHome(data){
 operationCopyFromMeta(data?.meta);
 const m=data?.meta;if(m?.schemaVersion!=='melisa-home.v1'||!day(m.date)||m.timeZone!=='Europe/Istanbul'||m.readOnly!==true||typeof m.readAt!=='string'||!Number.isFinite(Date.parse(m.readAt))||m.source!=='native-test')fail();
 if(m.dailySelectionReady!==undefined&&typeof m.dailySelectionReady!=='boolean')fail();
 const rights=['goods','purchase','sales','collection','product','customer','supplier','finance','payment','count','returns','approval'];
 if(!data.capabilities||!rights.every(k=>typeof data.capabilities[k]==='boolean')||!data.navigationReady||!rights.filter(k=>!['finance','payment'].includes(k)).every(k=>typeof data.navigationReady[k]==='boolean'&&(!data.navigationReady[k]||data.capabilities[k])))fail();
 const definitions={sales:['count','cancelledCount'],goods:['pendingCount'],finance:[],refunds:['salesCount','purchaseCount','cancelledCount'],counts:['pendingCount'],approvals:['pendingCount']};
 for(const [key,fields] of Object.entries(definitions)){const s=data.sections?.[key];if(!s||!statuses.includes(s.status)||fields.some(k=>s[k]!==null&&!number(s[k]))||s.status!=='available'&&fields.some(k=>s[k]!==null))fail();}
 totals(data.sections.sales.currencyTotals);for(const k of ['collections','payments','reversals'])totals(data.sections.finance[k]);
 for(const [s,keys] of [[data.sections.sales,['currencyTotals']],[data.sections.finance,['collections','payments','reversals']]])if(s.status!=='available'&&keys.some(k=>s[k].length))fail();
 const cash=data.sections.finance.cash;if(!cash||!statuses.includes(cash.status))fail();totals(cash.currencyTotals);if(cash.status!=='available'&&cash.currencyTotals.length)fail();
 if(!Array.isArray(data.tasks)||data.tasks.length>5||new Set(data.tasks.map(t=>t.id)).size!==data.tasks.length)fail();
 for(const t of data.tasks)if(typeof t.id!=='string'||!t.id||typeof t.kind!=='string'||!t.kind||typeof t.label!=='string'||!t.label||typeof t.state!=='string'||!t.state||typeof t.ready!=='boolean'||!(t.date===null||day(t.date))||!homeTargets.includes(t.target))fail();
 for(const t of data.tasks)if(t.recordLinkStatus!==undefined&&(t.recordLinkStatus!=='unverified'||t.ready||!['goods','purchase-draft'].includes(t.kind)))fail();
 return data;
}
export function homeReportsReady(data,user){
 validateWorkHome(data);const p=user?.permissions;if(!Array.isArray(p))return false;
 const has=k=>p.includes(k),ready=k=>data.capabilities[k]===true&&data.navigationReady[k]===true;
 return has('sales.view')&&ready('sales')||has('purchase.view')&&ready('purchase')||has('product.view')&&ready('product')||has('finance.view')&&data.capabilities.finance===true&&(has('customer.view')&&ready('customer')||has('supplier.view')&&ready('supplier'));
}
export function homeTaskUnavailable(task){return task.recordLinkStatus==='unverified'?'Bu kayıt için işlem bağlantısı henüz doğrulanmadı':'İşlem ekranı henüz hazır değil';}
export function homeUnavailable(status){return status==='forbidden'?'Görüntüleme yetkiniz yok':'Henüz bağlı değil';}
export function orderedHomeShortcuts(capabilities,user){
 const order=capabilities.purchase||capabilities.payment||capabilities.finance?['goods','collections','suppliers','stock','customers','sales']:capabilities.sales?['customers','stock','sales','goods','collections','suppliers']:homeShortcuts.map(s=>s.id);
 return order.map(id=>homeShortcuts.find(s=>s.id===id));
}
export function orderedHomeTasks(tasks,user){return user?.role?.code==='admin'?[...tasks].sort((a,b)=>Number(b.kind==='approval')-Number(a.kind==='approval')||Number(b.state==='pending')-Number(a.state==='pending')):tasks;}

export function homeNormalScreen(target){return {'/is-akisi-taslagi.html#goods':'goods','/is-akisi-taslagi.html#purchases':'purchases','/is-akisi-taslagi.html#suppliers':'suppliers','/is-akisi-taslagi.html#sales':'sales','/is-akisi-taslagi.html#receipts':'receipts','/is-akisi-taslagi.html#finance':'collections','/is-akisi-taslagi.html#customers':'customers','/is-akisi-taslagi.html#count-test':'count','/is-akisi-taslagi.html#return-purchase':'returns'}[target]??null;}

export function mergeInboundHome(data,inbound){
 const c=inbound?.capabilities;if(!c||!['canView','canViewPurchase','canViewSupplier'].every(k=>typeof c[k]==='boolean'))fail();
 const definitions={countDrafts:['draft','needs_review','submitted','cancelled'],receipts:['pending','accepted','rejected'],drafts:['draft','finalized','cancelled']};
 for(const [key,states] of Object.entries(definitions)){const rows=inbound[key];if(!Array.isArray(rows)||rows.length>500||new Set(rows.map(r=>r.id)).size!==rows.length||rows.some(r=>typeof r.id!=='string'||!/^[1-9]\d{0,15}$/.test(r.id)||!states.includes(r.state??r.status)))fail();}
 if(!c.canView||!c.canViewPurchase&&inbound.drafts.length)fail();
 const capabilities={...data.capabilities,purchase:data.capabilities.purchase&&c.canViewPurchase};
 const navigationReady={...data.navigationReady,goods:data.capabilities.goods&&c.canView,purchase:capabilities.purchase,supplier:data.capabilities.supplier&&c.canViewSupplier};
 const jobs=[...inbound.countDrafts.filter(r=>['draft','needs_review'].includes(r.state)).map(r=>({id:'inbound-count:'+r.id,kind:'goods',label:r.state==='needs_review'?'Stok kartı gerekli · Sayımı inceleyin':'Mal kabulü sayımına devam edin',state:'draft',date:null,target:'/is-akisi-taslagi.html#goods',ready:navigationReady.goods})),...inbound.receipts.filter(r=>r.state==='pending').map(r=>({id:'goods-batch:'+r.id,kind:'goods',label:'Mal kabulünü kontrol edin',state:'pending',date:null,target:'/is-akisi-taslagi.html#goods',ready:navigationReady.goods})),...inbound.drafts.filter(r=>r.status==='draft').map(r=>({id:'inbound-purchase:'+r.id,kind:'purchase-draft',label:'Alış faturasını tamamlayın',state:'draft',date:null,target:'/is-akisi-taslagi.html#purchases',ready:navigationReady.purchase}))];
 const currentIds=new Set(jobs.map(r=>r.id));const other=data.tasks.filter(t=>!currentIds.has(t.id)).map(t=>['goods','purchase-draft'].includes(t.kind)?{...t,ready:false,recordLinkStatus:'unverified'}:t);
 return {...data,capabilities,navigationReady,tasks:[...jobs,...other].slice(0,5)};
}
