// Local example operations only. No network or production writes.
const check=(ok,message)=>{if(!ok)throw new Error(message)};
const qty=n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000;
const office=actor=>check(['İlker','Semih'].includes(actor),'Bu işlemi İlker veya Semih yapabilir.');
export function initialOperations(products){return {version:1,products:structuredClone(products),goods:[{id:'MK-00418',supplier:'Concept',code:'M-100',qty:120,state:'pending',note:'Sabah sevkiyatı · örnek',at:'2026-09-28T04:12:00Z'}],counts:[],purchases:[],sequence:418,audit:[]}}
export function stockQuantity(state,code,receipts=[]){
 const p=state.products.find(p=>p[0]===code);check(p,'Ürün bulunamadı.');
 const received=state.goods.filter(g=>g.code===code&&g.state==='accepted').reduce((n,g)=>n+g.qty,0);
 const corrected=state.counts.filter(c=>c.code===code&&c.state==='accepted').reduce((n,c)=>n+c.difference,0);
 const sold=receipts.filter(r=>!r.cancelled).flatMap(r=>(r.items||[]).map((item,index)=>({...item,qty:item.qty-(r.returns||[]).filter(x=>x.state==='approved'&&x.index===index).reduce((n,x)=>n+x.qty,0)}))).filter(i=>i.code===code).reduce((n,i)=>n+i.qty,0);
 const supplierReturned=(state.supplierReturns||[]).filter(r=>r.code===code&&r.state==='approved').reduce((n,r)=>n+r.qty,0);
 return p[3]+received+corrected-sold-supplierReturned;
}
function log(s,type,id,actor){s.audit.push({type,id,actor,at:new Date().toISOString()})}
export function addGoods(s,{supplier,code,quantity,note},actor){check(s.products.some(p=>p[0]===code),'Ürünü seçin.');check(supplier?.trim(),'Tedarikçiyi girin.');check(qty(quantity)&&quantity>0,'Pozitif tam adet girin.');const g={id:`MK-${String(++s.sequence).padStart(5,'0')}`,supplier:supplier.trim(),code,qty:quantity,note:note?.trim()||'',state:'pending',createdBy:actor,at:new Date().toISOString()};s.goods.push(g);log(s,'Mal kabulü taslağı',g.id,actor);return g;}
export function addGoodsBatch(s,{supplier,lines,note},actor){
 check(supplier?.trim(),'Tedarikçiyi girin.');check(Array.isArray(lines)&&lines.length>0&&lines.length<=100,'1–100 ürün satırı ekleyin.');
 const codes=new Set();for(const line of lines){check(s.products.some(p=>p[0]===line.code),'Her satırı kayıtlı bir ürünle eşleyin.');check(!codes.has(line.code),'Aynı ürünü tek satırda toplam adetle girin.');codes.add(line.code);check(qty(line.quantity)&&line.quantity>0,'Her satıra pozitif tam adet girin.');}
 // Validate the entire delivery before mutating sequence, goods or audit.
 const batchId=`MK-${String(s.sequence+1).padStart(5,'0')}`;
 const rows=lines.map(line=>addGoods(s,{supplier,note,...line},actor));
 for(const row of rows)row.batchId=batchId;return rows;
}
export function acceptGoods(s,id,actor){office(actor);const g=s.goods.find(g=>g.id===id);check(g,'Kabul bulunamadı.');const rows=g.batchId?s.goods.filter(x=>x.batchId===g.batchId):[g];check(rows.every(x=>x.state==='pending'),'Bu kabul zaten tamamlandı.');for(const row of rows){row.state='accepted';row.actor=actor;row.decidedAt=new Date().toISOString();log(s,'Mal kabulü tamamlandı',row.id,actor)}return g;}
export function rejectGoods(s,id,reason,actor){office(actor);check(reason?.trim().length>=3,'Ret nedenini yazın.');const g=s.goods.find(g=>g.id===id);check(g,'Kabul bulunamadı.');const rows=g.batchId?s.goods.filter(x=>x.batchId===g.batchId):[g];check(rows.every(x=>x.state==='pending'),'Bu kabul artık onay beklemiyor.');for(const row of rows){row.state='rejected';row.rejection={reason:reason.trim(),actor,at:new Date().toISOString()};log(s,'Mal kabulü reddedildi',row.id,actor)}return g;}
export function addCount(s,{code,physical,reason},actor,receipts=[]){check(qty(physical),'Sıfır veya pozitif tam adet girin.');check(reason?.trim(),'Sayım açıklamasını girin.');const system=stockQuantity(s,code,receipts);const c={id:`SY-${String(++s.sequence).padStart(5,'0')}`,code,physical,system,difference:physical-system,reason:reason.trim(),state:'pending',at:new Date().toISOString()};s.counts.push(c);log(s,'Sayım kaydedildi',c.id,actor);return c;}
export function acceptCount(s,id,actor,receipts=[]){office(actor);const c=s.counts.find(c=>c.id===id);check(c,'Sayım bulunamadı.');check(!c.batchId,'Toplu sayım bütün satırlarıyla onaylanmalı.');check(c.state==='pending','Sayım zaten kabul edildi.');check(stockQuantity(s,c.code,receipts)===c.system,'Bu üründe sayımdan sonra hareket var. Yeniden sayım açın.');c.state='accepted';c.actor=actor;log(s,'Sayım farkı uygulandı',id,actor);return c;}
export function productBarcode(p){return p[7]?.barcode??({'M-100':'8690000000101','M-142':'8690000000149'}[p[0]]||'')}
export function findGoodsProduct(s,input){const q=String(input||'').trim();check(q,'Barkod veya model kodu girin.');const matches=s.products.filter(p=>productBarcode(p)===q||p[0].toLocaleLowerCase('tr-TR')===q.toLocaleLowerCase('tr-TR'));check(matches.length===1,matches.length?'Birden fazla kart eşleşti; ürün kartını elle seçin.':'Ürün bulunamadı. İlker veya Semih eksik kartı açabilir.');return matches[0]}
export function addProduct(s,{name,brand,sizes,category,barcode,note},actor){office(actor);barcode=String(barcode||'').trim();check(name?.trim()&&brand?.trim(),'Ürün adı ve marka zorunlu.');check(!barcode||!s.products.some(p=>productBarcode(p)===barcode),'Barkod başka bir örnek ürüne bağlı.');const code=`Y-${String(++s.sequence).padStart(5,'0')}`;s.products.push([code,name.trim(),sizes||'Beden belirtilmedi',0,0,'Aktif',category||'Türü belirtilmemiş',{brand,barcode,note}]);log(s,'Ürün kartı açıldı',code,actor);return code;}
export function addPurchase(s,{goodsId,number,date,currency,quantity,priceCents,vatCents},actor){
 office(actor);const g=s.goods.find(g=>g.id===goodsId);check(g?.state==='accepted','Tamamlanmış bir mal kabulü seçin.');check(number?.trim(),'Fatura numarasını girin.');check(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date,'Belge tarihini girin.');check(['USD','EUR','TRY'].includes(currency),'Dövizi seçin.');
 check(!s.purchases.some(p=>p.supplier===g.supplier&&p.number===number.trim()),'Bu tedarikçide aynı fatura numarası zaten var.');
 check(qty(quantity)&&quantity>0&&quantity<=invoiceableQuantity(s,goodsId),'Miktar, kabulün faturasız kalan miktarını aşamaz.');check(Number.isSafeInteger(priceCents)&&priceCents>=0&&Number.isSafeInteger(vatCents)&&vatCents>=0,'Fiyat ve KDV tutarını kontrol edin.');const total=quantity*priceCents+vatCents;check(Number.isSafeInteger(total),'Fatura tutarı sınırı aşıldı.');
 const p={id:`AF-${String(++s.sequence).padStart(5,'0')}`,goodsId,supplier:g.supplier,code:g.code,number:number.trim(),date,currency,qty:quantity,priceCents,vatCents,total,actor};s.purchases.push(p);log(s,'Alış faturası kaydedildi',p.id,actor);return p;
}
export function invoicedQuantity(s,goodsId){return s.purchases.flatMap(p=>p.lines||[p]).filter(p=>p.goodsId===goodsId).reduce((n,p)=>n+p.qty,0)}
// Pending returns reserve unbilled goods until an authorized decision releases or consumes them.
export function uninvoicedReturnQuantity(s,goodsId,includePending=false){return(s.supplierReturns||[]).filter(r=>r.kind==='uninvoiced'&&r.goodsId===goodsId&&(r.state==='approved'||includePending&&r.state==='pending')).reduce((n,r)=>n+r.qty,0)}
export function invoiceableQuantity(s,goodsId){const g=s.goods.find(g=>g.id===goodsId);return g?.state==='accepted'?g.qty-invoicedQuantity(s,goodsId)-uninvoicedReturnQuantity(s,goodsId,true):0}
export function requestUninvoicedReturn(s,{goodsId,quantity,reason},actor){
 const g=s.goods.find(g=>g.id===goodsId);check(g?.state==='accepted','Tamamlanmış bir mal kabulü seçin.');check(qty(quantity)&&quantity>0&&quantity<=invoiceableQuantity(s,goodsId),'İade adedi, faturalanmamış ve iadeye ayrılmamış miktarı aşamaz.');check(reason?.trim().length>=3,'İade nedenini yazın.');
 const r={id:`TI-${String(++s.sequence).padStart(5,'0')}`,kind:'uninvoiced',goodsId,code:g.code,supplier:g.supplier,qty:quantity,reason:reason.trim(),state:'pending',actor,at:new Date().toISOString()};(s.supplierReturns||=[]).push(r);log(s,'Faturasız mal iadesi kontrol bekliyor',r.id,actor);return r;
}
export function savePurchaseDraft(s,d,actor){
 office(actor);check(d.supplier?.trim()&&d.reference?.trim(),'Tedarikçi ve alış referansını girin.');check(['USD','EUR','TRY'].includes(d.currency),'Dövizi seçin.');
 check(Array.isArray(d.lines)&&d.lines.length>0,'En az bir ürün satırı ekleyin.');
 check(d.lines.every(l=>s.products.some(p=>p[0]===l.code)&&qty(l.qty)&&l.qty>0&&Number.isSafeInteger(l.priceCents)&&l.priceCents>=0),'Ürün satırlarını kontrol edin.');
 check(Number.isSafeInteger(d.discountBps)&&d.discountBps>=0&&d.discountBps<=10000,'İskonto geçersiz.');
 for(const field of ['vatCents','documentTotalCents'])check(d[field]===null||(Number.isSafeInteger(d[field])&&d[field]>=0),'Belge tutarını kontrol edin.');
 const subtotal=d.lines.reduce((n,l)=>n+l.qty*l.priceCents,0);check(Number.isSafeInteger(subtotal),'Toplam tutar sınırı aşıldı.');
 const previous=(s.purchaseDrafts||[]).find(x=>x.id===d.id);check(!previous||previous.state==='draft','Kaydedilmiş fatura taslağı değiştirilemez.');
 const draft={...structuredClone(d),id:previous?.id||`AT-${String(++s.sequence).padStart(5,'0')}`,state:'draft',subtotal,discountCents:Math.round(subtotal*d.discountBps/10000),actor,at:new Date().toISOString()};
 if(previous)s.purchaseDrafts[s.purchaseDrafts.indexOf(previous)]=draft;else(s.purchaseDrafts||=[]).push(draft);log(s,'Ayrıntılı alış taslağı kaydedildi',draft.id,actor);return draft;
}
export function finalizePurchaseDraft(s,id,allocations,actor){
 office(actor);const d=(s.purchaseDrafts||[]).find(x=>x.id===id);check(d?.state==='draft','Faturalanabilecek taslak bulunamadı.');
 check(d.documentNumber?.trim(),'Belge ve KDV sekmesinden fatura numarasını girin.');check(/^\d{4}-\d{2}-\d{2}$/.test(d.documentDate)&&Number.isFinite(Date.parse(d.documentDate))&&new Date(d.documentDate).toISOString().slice(0,10)===d.documentDate,'Belge tarihini girin.');
 check(d.documentCurrency===d.currency,'Belge ve mal bedeli dövizleri aynı olmalı.');check(d.vatCents!==null&&d.documentTotalCents!==null,'KDV ve belge toplamını açıkça girin; KDV yoksa 0 yazın.');
 const total=d.subtotal-d.discountCents+d.vatCents;check(total===d.documentTotalCents,'Belge toplamı, iskonto sonrası mal bedeli + KDV ile eşleşmiyor.');
 check(!s.purchases.some(p=>p.supplier===d.supplier&&p.number===d.documentNumber.trim()),'Aynı tedarikçinin bu faturası zaten kayıtlı.');check(Array.isArray(allocations)&&allocations.length===d.lines.length,'Her satır için mal kabulü seçin.');
 const used=new Map(),lines=d.lines.map((l,i)=>{const g=s.goods.find(g=>g.id===allocations[i]);check(g?.state==='accepted'&&g.supplier===d.supplier&&g.code===l.code,'Satırın tedarikçi ve ürünü kabul kaydıyla eşleşmeli.');const assigned=(used.get(g.id)||0)+l.qty;check(assigned<=invoiceableQuantity(s,g.id),'Fatura miktarı kabulün kalanını aşıyor.');used.set(g.id,assigned);return {...l,goodsId:g.id}});
 const p={id:`AF-${String(++s.sequence).padStart(5,'0')}`,draftId:id,supplier:d.supplier,number:d.documentNumber.trim(),date:d.documentDate,currency:d.currency,lines,goodsId:[...used.keys()].join(', '),code:lines.length+' satır',qty:lines.reduce((n,l)=>n+l.qty,0),vatCents:d.vatCents,total,discountCents:d.discountCents,actor};
 s.purchases.push(p);d.state='finalized';d.invoiceId=p.id;log(s,'Ayrıntılı alış faturası kaydedildi',p.id,actor);return p;
}

export function ensureCustomers(s){
 s.customers||=[{id:'cash',name:'Peşin Dolar',aliases:['Peşin Dolar'],currency:'USD',country:'',phone:'',note:'',active:true},{id:'alfa',name:'Alfa Kids · USD',aliases:['Alfa Kids · USD'],currency:'USD',country:'',phone:'',note:'',active:true}];return s.customers;
}
export function customerForReceipt(s,r){return ensureCustomers(s).find(c=>r.customerId?c.id===r.customerId:c.aliases.includes(r.customer))}
export function saveCustomer(s,d,actor){
 office(actor);const customers=ensureCustomers(s),old=customers.find(c=>c.id===d.id),name=String(d.name||'').trim();
 check(name.length>=2&&name.length<=120,'Cari adı 2–120 karakter olmalı.');check(['USD','EUR','TRY'].includes(d.currency),'Dövizi seçin.');
 const norm=n=>n.toLocaleLowerCase('tr-TR');check(!customers.some(c=>c.id!==old?.id&&c.aliases.some(n=>norm(n)===norm(name))),'Bu cari adı zaten kullanılıyor.');
 check(!old||old.currency===d.currency,'Mevcut kartın dövizi değiştirilemez; ayrı döviz için yeni kart açın.');
 const c={id:old?.id||`C-${String(++s.sequence).padStart(5,'0')}`,name,currency:d.currency,country:String(d.country||'').trim().slice(0,100),phone:String(d.phone||'').trim().slice(0,60),note:String(d.note||'').trim().slice(0,500),active:d.active!==false,aliases:[...new Set([...(old?.aliases||[]),name])]};
 check(c.id!=='cash'||c.active,'Peşin Dolar kartı açık kalmalı.');if(old)customers[customers.indexOf(old)]=c;else customers.push(c);log(s,old?'Cari kartı güncellendi':'Cari kartı açıldı',c.id,actor);return c;
}
export function updateProduct(s,code,d,actor){
 check(['İlker','Angela','Semih'].includes(actor),'Ürün ve fiyatı İlker, Angela veya Semih düzenleyebilir.');const p=s.products.find(p=>p[0]===code);check(p,'Ürün bulunamadı.');
 check(d.name?.trim()&&d.reason?.trim().length>=3,'Ürün adı ve değişiklik nedeni gerekli.');check(Number.isSafeInteger(d.priceCents)&&d.priceCents>=0&&d.priceCents<=100000000,'Satış fiyatını kontrol edin.');
 const barcode=String(d.barcode||'').trim();check(!barcode||!s.products.some(x=>x[0]!==code&&(x[7]?.barcode||({'M-100':'8690000000101','M-142':'8690000000149'}[x[0]]))===barcode),'Barkod başka üründe kayıtlı.');
 const before={name:p[1],priceCents:Math.round(p[4]*100),metadata:structuredClone(p[7]||{})};
 p[1]=d.name.trim().slice(0,160);p[2]=String(d.sizes||p[2]).trim();p[4]=d.priceCents/100;p[6]=String(d.category||p[6]).trim();p[7]={...p[7],barcode,priceHistory:[...(p[7]?.priceHistory||[]),{before,priceCents:d.priceCents,reason:d.reason.trim(),actor,at:new Date().toISOString()}]};log(s,'Ürün / satış fiyatı güncellendi',code,actor);return p;
}
export function purchaseLines(p){return p.lines||[{code:p.code,qty:p.qty,priceCents:p.priceCents,goodsId:p.goodsId}]}
export function supplierReturnQuantity(s,purchaseId,index,includePending=false){return(s.supplierReturns||[]).filter(r=>r.purchaseId===purchaseId&&r.index===index&&(r.state==='approved'||includePending&&r.state==='pending')).reduce((n,r)=>n+r.qty,0)}
export function requestSupplierReturn(s,{purchaseId,index,quantity,reason},actor){
 const p=s.purchases.find(p=>p.id===purchaseId),line=p&&purchaseLines(p)[index];check(line,'Kaynak alış faturası satırını seçin.');check(qty(quantity)&&quantity>0&&quantity<=line.qty-supplierReturnQuantity(s,purchaseId,index,true),'İade adedi faturanın kalan miktarını aşamaz.');check(reason?.trim().length>=3,'İade nedenini yazın.');
 const r={id:`TI-${String(++s.sequence).padStart(5,'0')}`,purchaseId,index,code:line.code,supplier:p.supplier,currency:p.currency,qty:quantity,reason:reason.trim(),state:'pending',actor,at:new Date().toISOString()};(s.supplierReturns||=[]).push(r);log(s,'Tedarikçi iadesi kontrol bekliyor',r.id,actor);return r;
}
export function decideSupplierReturn(s,id,approve,actor,receipts=[]){
 office(actor);const r=(s.supplierReturns||[]).find(r=>r.id===id);check(r?.state==='pending','Bekleyen iade bulunamadı.');
 if(approve&&r.kind==='uninvoiced'){check(invoiceableQuantity(s,r.goodsId)>=0,'Kabulün faturalanmamış miktarı iadeye yetmiyor.');check(stockQuantity(s,r.code,receipts)>=r.qty,'Mevcut stok iadeye yetmiyor.');r.amount=0;}
 else if(approve){const p=s.purchases.find(p=>p.id===r.purchaseId),lines=purchaseLines(p),line=lines[r.index];check(stockQuantity(s,r.code,receipts)>=r.qty,'Mevcut stok iadeye yetmiyor.');
 const gross=lines.reduce((n,l)=>n+l.qty*l.priceCents,0),before=lines.slice(0,r.index).reduce((n,l)=>n+l.qty*l.priceCents,0);check(gross>0||p.total===0,'Sıfır mal bedelinde KDV dağılımı belirlenemiyor.');
 const lineAmount=gross?Math.round((before+line.qty*line.priceCents)*p.total/gross)-Math.round(before*p.total/gross):0,returned=supplierReturnQuantity(s,p.id,r.index);check(returned+r.qty<=line.qty,'İade miktarı kaynak satırı aşıyor.');
 r.amount=Math.round((returned+r.qty)*lineAmount/line.qty)-Math.round(returned*lineAmount/line.qty);
 }r.state=approve?'approved':'rejected';r.decidedBy=actor;r.decidedAt=new Date().toISOString();log(s,approve?'Tedarikçi iadesi kabul edildi':'Tedarikçi iadesi reddedildi',id,actor);return r;
}
export function supplierBalance(s,supplier,currency){return s.purchases.filter(p=>p.supplier===supplier&&p.currency===currency).reduce((n,p)=>n+purchaseBalance(s,p.id),0)}

export function validateSaleStock(s,items,receipts=[]){
 check(Array.isArray(items)&&items.length>0,'Fişe ürün ekleyin.');const used=new Map();
 for(const item of items){check(qty(item.qty)&&item.qty>0,'Pozitif tam adet girin.');const total=(used.get(item.code)||0)+item.qty;check(total<=stockQuantity(s,item.code,receipts),item.code+' için mevcut stok yetersiz.');used.set(item.code,total)}
}

export function purchasePaid(s,purchaseId){return(s.supplierPayments||[]).filter(p=>p.purchaseId===purchaseId&&!p.cancelled).reduce((n,p)=>n+p.amount,0)}
export function purchaseReturned(s,purchaseId){return(s.supplierReturns||[]).filter(r=>r.purchaseId===purchaseId&&r.state==='approved').reduce((n,r)=>n+r.amount,0)}
export function purchaseBalance(s,purchaseId){const p=s.purchases.find(p=>p.id===purchaseId);check(p,'Alış faturası bulunamadı.');return p.total-purchaseReturned(s,purchaseId)-purchasePaid(s,purchaseId)}
export function recordSupplierPayment(s,{purchaseId,amount,currency,method,date,note,requestId},actor){
 office(actor);check(typeof requestId==='string'&&requestId.length>=8,'Ödeme işlem kimliği gerekli.');
 const previous=(s.supplierPayments||[]).find(p=>p.requestId===requestId);
 if(previous){check(previous.purchaseId===purchaseId&&previous.amount===amount&&previous.currency===currency&&previous.method===method&&previous.date===date&&previous.note===(note?.trim()||''),'Aynı işlem kimliği farklı ödeme için kullanılamaz.');return previous;}
 const invoice=s.purchases.find(p=>p.id===purchaseId);check(invoice,'Alış faturası seçin.');check(currency===invoice.currency,'Ödeme dövizi fatura döviziyle aynı olmalı.');check(['Nakit','Banka','Kart'].includes(method),'Ödeme yöntemini seçin.');
 check(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date,'Geçerli ödeme tarihi girin.');check(Number.isSafeInteger(amount)&&amount>0&&amount<=purchaseBalance(s,purchaseId),'Ödeme, faturanın kalan borcunu aşamaz.');
 const p={id:`TO-${String(++s.sequence).padStart(5,'0')}`,requestId,purchaseId,supplier:invoice.supplier,currency,amount,method,date,note:note?.trim()||'',actor,at:new Date().toISOString()};(s.supplierPayments||=[]).push(p);log(s,'Tedarikçi ödemesi kaydedildi',p.id,actor);return p;
}
export function cancelSupplierPayment(s,id,reason,actor){office(actor);const p=(s.supplierPayments||[]).find(p=>p.id===id);check(p&&!p.cancelled,'İptal edilebilecek ödeme bulunamadı.');check(reason?.trim().length>=3,'İptal nedenini yazın.');p.cancelled={reason:reason.trim(),actor,at:new Date().toISOString()};log(s,'Tedarikçi ödemesi iptal edildi',id,actor);return p;}
// Net merchandise cost, excluding document VAT. Keep source currency and never rewrite sale prices.
export function purchaseCostRows(p){const lines=purchaseLines(p),gross=lines.reduce((n,l)=>n+l.qty*l.priceCents,0),net=p.total-p.vatCents;check(Number.isSafeInteger(gross)&&Number.isSafeInteger(net)&&net>=0,'Fatura maliyeti hesaplanamıyor.');let before=0;const share=n=>gross?Number((BigInt(n)*BigInt(net)*2n+BigInt(gross))/(BigInt(gross)*2n)):0;
 return lines.map((line,index)=>{const start=before;before+=line.qty*line.priceCents;const netCents=share(before)-share(start);return {...line,index,netCents,unitCostCents:netCents/line.qty,currency:p.currency}});
}
export function productPurchaseCosts(s,code){return s.purchases.flatMap(p=>purchaseCostRows(p).filter(l=>l.code===code).map(l=>({...l,purchaseId:p.id,number:p.number,date:p.date,supplier:p.supplier}))).reverse()}
