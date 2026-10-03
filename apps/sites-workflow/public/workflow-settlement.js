/* Isolated preview receipts: no ERP, stock, receivable or bank writes. */
(() => {
  const require = (ok, message) => { if (!ok) throw Error(message); };
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const actorCheck = actor => require(['İlker','Angela','Semih'].includes(actor), 'Bu işlemi İlker, Angela veya Semih yapabilir.');
  const financeCheck = actor => require(['İlker','Semih'].includes(actor), 'Bu işlemi İlker veya Semih yapabilir.');
  const gross = receipt => receipt.items.reduce((sum,item) => sum + item.priceCents * item.qty, 0);
  const discountBps = r => r.discount?.state==='approved'?r.discount.bps:(r.discount?.previousBps||0);
  const discounted = r => gross(r)-Math.round(gross(r)*discountBps(r)/10000);
  const returned = (r,index) => (r.returns||[]).filter(x=>x.state==='approved'&&x.index===index).reduce((n,x)=>n+x.qty,0);
  const total = r => r.cancelled?0:discounted(r)-(r.returns||[]).filter(x=>x.state==='approved').reduce((n,x)=>n+x.amount,0);
  const collected = r => r.payments.reduce((sum,row) => sum + row.amount, 0);
  const paid = r => collected(r)-(r.refunds||[]).reduce((n,x)=>n+x.amount,0);
  const remaining = r => Math.max(0,total(r)-paid(r));
  const credit = r => Math.max(0,paid(r)-total(r));
  const ready = r => !r.cancelled&&!r.shipment&&total(r)>0&&r.discount?.state!=='pending'&&!(r.returns||[]).some(x=>x.state==='pending')&&(remaining(r)===0||(r.approval&&r.approval.amount>=remaining(r)&&r.approval.dueDate>=today()));
  const audit=(r,type,actor,details)=>{(r.history||=[]).push({type,actor,at:new Date().toISOString(),details})};
  const active=r=>require(!r.cancelled,'İptal edilen fişte işlem yapılamaz.');
  const reasonCheck=reason=>require(typeof reason==='string'&&reason.trim().length>=3,'En az üç karakterlik bir neden yazın.');
  function priceInCurrency(usdCents,rate){
    require(Number.isSafeInteger(usdCents)&&usdCents>=0,'USD fiyatını kontrol edin.');
    require(typeof rate==='string'&&/^\d{1,6}(?:[.,]\d{1,6})?$/.test(rate),'Kuru en fazla altı ondalık basamakla girin.');
    const [whole,fraction='']=rate.replace(',','.').split('.'),scaled=BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,'0'));
    require(scaled>0n,'Kur sıfırdan büyük olmalı.');const result=Number((BigInt(usdCents)*scaled+500000n)/1000000n);
    require(Number.isSafeInteger(result),'Çevrilen tutar sınırı aşıldı.');return result;
  }
  function currencyTotals(receipts,metric){const out={};for(const r of receipts){const c=r.currency||'USD';out[c]=(out[c]||0)+metric(r)}return out;}
  function create(id, customer, items, currency='USD') {
    require(['USD','EUR','TRY'].includes(currency),'Fiş dövizini seçin.');
    require(items.length > 0, 'Fişe ürün ekleyin.');
    const lines = items.map(item => ({code:item.code,name:item.name,category:item.category || 'Türü belirtilmemiş',qty:Number(item.qty),priceCents:item.priceCents ?? Math.round(Number(item.price)*100)}));
    require(lines.every(item => Number.isSafeInteger(item.qty) && item.qty > 0 && Number.isSafeInteger(item.priceCents) && item.priceCents >= 0), 'Ürün miktarını ve fiyatını kontrol edin.');
    const receipt = {id,customer,currency,items:lines,payments:[],approval:null,shipment:null,createdAt:new Date().toISOString()};
    require(Number.isSafeInteger(total(receipt)), 'Fiş tutarı sınırı aşıldı.');
    return receipt;
  }
  function collect(receipt, amount, method, actor) {
    financeCheck(actor); active(receipt);
    require(Number.isSafeInteger(amount) && amount > 0, 'Sıfırdan büyük bir tutar girin.');
    require(amount <= remaining(receipt), 'Tahsilat kalan borçtan fazla olamaz.');
    require(['Nakit','Banka','Kart'].includes(method), 'Ödeme yöntemini seçin.');
    receipt.payments.push({amount,method,actor,at:new Date().toISOString()});
  }
  function approve(receipt, dueDate, actor) {
    financeCheck(actor); active(receipt); require(!receipt.shipment && remaining(receipt) > 0, 'Gönderilmemiş, açık bakiyeli bir fiş seçin.');
    require(/^\d{4}-\d{2}-\d{2}$/.test(dueDate) && !Number.isNaN(Date.parse(dueDate)) && new Date(dueDate).toISOString().slice(0,10)===dueDate && dueDate >= today(), 'Bugün veya sonraki bir vade seçin.');
    receipt.approval = {amount:remaining(receipt),dueDate,actor,at:new Date().toISOString()};
  }
  function ship(receipt, actor) {
    financeCheck(actor); active(receipt); require(!receipt.shipment, 'Gönderim zaten kaydedildi.');
    require(ready(receipt), 'Gönderim için ödemeyi tamamlayın veya vadeyi onaylayın.');
    receipt.shipment={actor,at:new Date().toISOString()};
  }
  function transferCustomer(receipt, customer, actor, choices=['Peşin Dolar','Alfa Kids · USD']) {
    financeCheck(actor); active(receipt);
    require(choices.includes(customer), 'Örnek müşteri kartını seçin.');
    require(customer !== receipt.customer, 'Fiş zaten bu müşteriye bağlı.');
    const previous = receipt.customer;
    receipt.customer = customer;
    (receipt.customerHistory ||= []).push({from:previous,to:customer,actor,at:new Date().toISOString()});
  }
  function requestDiscount(r,bps,reason,actor){
    active(r);reasonCheck(reason);require(!r.shipment,'Gönderilmiş fişte indirim değiştirilemez.');
    require(!(r.returns||[]).some(x=>x.state!=='rejected'),'İade açılmış fişte indirim değiştirilemez.');
    require(['İlker','Angela','Semih','Satış'].includes(actor),'Kullanıcı görünümünü seçin.');
    require(Number.isSafeInteger(bps)&&bps>=0&&bps<=500,'İndirim %0–%5 arasında olmalı.');
    require(r.discount?.state!=='pending','Önce bekleyen indirim talebini sonuçlandırın.');
    r.discount={previousBps:discountBps(r),bps,reason:reason.trim(),actor,state:bps>300?'pending':'approved',at:new Date().toISOString()};r.approval=null;
    audit(r,bps>300?'İndirim onaya gönderildi':'İndirim uygulandı',actor,{bps,reason:reason.trim()});
  }
  function decideDiscount(r,approve,actor){
    active(r);require(['Angela','Semih'].includes(actor),'%3 üzeri indirimi Angela veya Semih onaylar.');
    require(r.discount?.state==='pending','Bekleyen indirim yok.');r.discount.state=approve?'approved':'rejected';r.discount.decidedBy=actor;r.discount.decidedAt=new Date().toISOString();r.approval=null;
    audit(r,approve?'İndirim onaylandı':'İndirim reddedildi',actor,{bps:r.discount.bps,reason:r.discount.reason});
  }
  function requestReturn(r,index,quantity,reason,actor){
    active(r);reasonCheck(reason);require(r.discount?.state!=='pending','Önce indirim talebini sonuçlandırın.');
    const item=r.items[index];require(item,'Ürün satırını seçin.');
    const reserved=(r.returns||[]).filter(x=>x.index===index&&x.state!=='rejected').reduce((n,x)=>n+x.qty,0);
    require(Number.isSafeInteger(quantity)&&quantity>0&&quantity<=item.qty-reserved,'İade miktarı, satılana ait kalan miktarı aşamaz.');
    const row={id:`${r.id}-IA-${(r.returns||[]).length+1}`,index,code:item.code,qty:quantity,reason:reason.trim(),state:'pending',actor,at:new Date().toISOString()};(r.returns||=[]).push(row);audit(r,'İade kontrol bekliyor',actor,{id:row.id});return row;
  }
  function decideReturn(r,id,approve,actor){
    active(r);financeCheck(actor);const row=(r.returns||[]).find(x=>x.id===id);require(row?.state==='pending','Bekleyen iade bulunamadı.');
    if(approve){const item=r.items[row.index],before=returned(r,row.index);require(before+row.qty<=item.qty,'Toplam iade satılan miktarı aşamaz.');
      const prefix=r.items.slice(0,row.index).reduce((n,i)=>n+i.qty*i.priceCents,0),line=item.qty*item.priceCents;
      const netLine=(prefix+line-Math.round((prefix+line)*discountBps(r)/10000))-(prefix-Math.round(prefix*discountBps(r)/10000));
      row.amount=Math.round(netLine*(before+row.qty)/item.qty)-Math.round(netLine*before/item.qty);
    }
    row.state=approve?'approved':'rejected';row.decidedBy=actor;row.decidedAt=new Date().toISOString();r.approval=null;audit(r,approve?'Müşteri iadesi kabul edildi':'Müşteri iadesi reddedildi',actor,{id,amount:row.amount||0,reason:row.reason});
  }
  function correctLine(r,index,quantity,priceCents,reason,actor){
    active(r);financeCheck(actor);reasonCheck(reason);require(!r.shipment,'Gönderilmiş fişte düzeltme yerine iade kaydı açın.');
    require(!(r.returns||[]).some(x=>x.state!=='rejected')&&r.discount?.state!=='pending','Bekleyen onay/iade bulunan fiş düzeltilemez.');
    const item=r.items[index];require(item,'Ürün satırını seçin.');require(Number.isSafeInteger(quantity)&&quantity>0&&quantity<=1000000&&Number.isSafeInteger(priceCents)&&priceCents>=0,'Miktar ve fiyatı kontrol edin.');
    const nextGross=gross(r)-item.qty*item.priceCents+quantity*priceCents;require(Number.isSafeInteger(nextGross),'Fiş tutarı sınırı aşıldı.');
    const before={...item};item.qty=quantity;item.priceCents=priceCents;r.approval=null;audit(r,'Fiş satırı düzeltildi',actor,{index,before,after:{...item},reason:reason.trim()});
  }
  function cancel(r,reason,actor){active(r);financeCheck(actor);reasonCheck(reason);require(!r.shipment,'Gönderilmiş fişte iptal yerine iade kaydı açın.');require(!(r.returns||[]).some(x=>x.state!=='rejected'),'İade açılmış fiş iptal edilemez.');r.cancelled={reason:reason.trim(),actor,at:new Date().toISOString()};r.approval=null;if(r.discount?.state==='pending')r.discount.state='rejected';audit(r,'Fiş iptal edildi',actor,{reason:reason.trim()});}
  function refund(r,amount,method,actor){financeCheck(actor);require(Number.isSafeInteger(amount)&&amount>0&&amount<=credit(r),'İade tutarı müşteri alacağını aşamaz.');require(['Nakit','Banka','Kart'].includes(method),'Ödeme yöntemi seçin.');(r.refunds||=[]).push({amount,method,actor,at:new Date().toISOString()});audit(r,'Müşteriye para iadesi',actor,{amount,method});}
  function summary(receipt) {
    const groups = new Map();
    for (const [index,item] of receipt.items.entries()) groups.set(item.category,(groups.get(item.category)||0)+(receipt.cancelled?0:item.qty-returned(receipt,index)));
    return [...groups];
  }
  function sample() {
    const names=['Triko bebek takımı','Kapüşonlu tulum','Pamuklu body seti','Kadife elbise takımı','Desenli pijama takımı','Örgü hırka','Pamuklu zıbın','İkili bebek takımı','Müslin battaniye','Patikli tulum','Yenidoğan seti','Triko yelek','Uzun kollu body','Bebek elbisesi','Pamuklu pantolon'];
    const types=['Takım','Tulum','Body','Elbise','Pijama','Üst giyim','Body','Takım','Battaniye','Tulum','Takım','Üst giyim','Body','Elbise','Alt giyim'];
    return create('SF-02659','Peşin Dolar',names.map((name,i)=>({name,code:`D-${String(i+1).padStart(3,'0')}`,category:types[i],qty:[6,6,8,6,12][i%5],price:[10.5,12,8.2,15.8,11.4][i%5]})));
  }
  globalThis.MelisaReceiptPreview={priceInCurrency,currencyTotals,today,total,paid,collected,remaining,credit,returned,gross,discounted,ready,create,collect,approve,ship,transferCustomer,summary,sample,requestDiscount,decideDiscount,requestReturn,decideReturn,correctLine,cancel,refund};
})();
