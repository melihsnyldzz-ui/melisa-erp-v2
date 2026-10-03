import {createHash} from 'node:crypto';
import {ARMADA_HEADER_FIELDS,ARMADA_LINE_FIELDS} from './armadaDocumentCodec.mjs';
import {ARMADA_SALE_ENDPOINT} from './armadaSaleSubmission.mjs';
import {amount,amountText,dailyDocumentNumber,currencyCode} from './armadaDailyCompiler.mjs';
export const exportError=(code,message,statusCode=409)=>Object.assign(new Error(message),{code,statusCode});
const fail=(code,message)=>{throw exportError(code,message);};
export const exportDigest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const S=100000000n, mul=(a,b)=>(a*b+S/2n)/S, text=v=>String(v??'').trim();
const blank=fields=>Object.fromEntries(fields.map(k=>[k,'']));
const sym=c=>({TRY:'TL',USD:'$',EUR:'€'})[c];
const off=v=>v===false||v===0||v===null;
const clean=v=>text(v).replace(/[|\u0000-\u001f\u007f]/g,' ').slice(0,450);
export function invoiceExportSource(invoice) {
  const date=invoice.documentDate instanceof Date?invoice.documentDate.toISOString().slice(0,10):String(invoice.documentDate||'').slice(0,10);
  return {id:Number(invoice.id),documentNo:text(invoice.documentNo),status:invoice.status,documentDate:date,
    customerId:Number(invoice.customerId),customerCode:text(invoice.customerCode),customerName:text(invoice.customerName),
    employeeId:invoice.employeeId??null,employeeName:text(invoice.employeeName),terminalCode:text(invoice.terminalCode),
    currency:invoice.documentCurrency,exchangeRate:String(invoice.exchangeRate),subtotal:String(invoice.subtotal),
    discountTotal:String(invoice.discountTotal),grandTotal:String(invoice.grandTotal),amountTry:String(invoice.amountTry),
    items:(invoice.items||[]).map(i=>({id:Number(i.id),productId:Number(i.productId),stockCode:text(i.stockCode),
      productName:text(i.productName),barcode:text(i.barcode),quantity:String(i.quantity),unitPrice:String(i.unitPrice),
      lineTotal:String(i.lineTotal),currency:i.currency}))};
}
export function validateExportSource(source) {
  if(!Number.isSafeInteger(source.id)||source.id<1||source.status!=='FINALIZED')fail('EXPORT_FINALIZED_REQUIRED','Yalnız kesinleşmiş fişler Vega’ya gönderilebilir.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(source.documentDate)||!source.documentDate.startsWith('2026-'))fail('EXPORT_PERIOD_INVALID','Fiş tarihi 2026 Vega dönemiyle eşleşmiyor.');
  if(!['TRY','USD','EUR'].includes(source.currency)||amount(source.exchangeRate)<=0n||(source.currency==='TRY'&&amount(source.exchangeRate)!==S))fail('EXPORT_RATE_INVALID','Fişin kayıtlı para birimi/kur bilgisi geçersiz.');
  if(amount(source.discountTotal)!==0n)fail('EXPORT_DISCOUNT_UNSUPPORTED','İskontolu fiş aktarımı henüz doğrulanmadı; fişin tutarı değiştirilmedi.');
  if(!source.items.length||source.items.length>100)fail('EXPORT_LINES_INVALID','Aktarımda fiş başına 1–100 satır destekleniyor.');
  const missingBarcodes=source.items.filter(i=>!i.barcode).map(i=>i.stockCode||String(i.productId));
  if(missingBarcodes.length)fail('EXPORT_BARCODE_MISSING','Fişte barkod kaydı boş: '+missingBarcodes.join(', ')+'. Vega birimi doğrulanmadan gönderilemez.');
  let total=0n;
  for(const i of source.items) {
    if(!i.barcode||!i.stockCode||i.currency!==source.currency||amount(i.quantity)<=0n||amount(i.quantity)%S!==0n||amount(i.unitPrice)<0n)fail('EXPORT_LINE_INVALID','Satır barkodu, para birimi, miktarı veya fiyatı aktarım için uygun değil.');
    const line=mul(amount(i.quantity),amount(i.unitPrice));
    if(line!==amount(i.lineTotal))fail('EXPORT_LINE_TOTAL_MISMATCH','Kayıtlı satır toplamı miktar × fiyat ile eşleşmiyor.');
    total+=line;
  }
  if(total!==amount(source.subtotal)||total!==amount(source.grandTotal)||total<=0n)fail('EXPORT_TOTAL_MISMATCH','Fiş toplamları satırlarla eşleşmiyor.');
  const delta=mul(total,amount(source.exchangeRate))-amount(source.amountTry);
  if(delta>10000n||delta< -10000n)fail('EXPORT_BASE_TOTAL_MISMATCH','Kayıtlı TL karşılığı fiş kuruyla eşleşmiyor.');
  return source;
}
export function exportNumber(source) {
  return dailyDocumentNumber({company:'F0102',period:'D0007',terminalCode:'MELISA-ERP-EXPORT',clientEventId:'sales-invoice-'+source.id});
}
export function compileInvoiceExport(source,mapping,bridge,profile,{uid,actor,now=new Date().toISOString()}) {
  validateExportSource(source);
  if(mapping.scope!=='VEGA2026/F0102/D0007'||mapping.collisions?.length)fail('EXPORT_COLLISION','Vega kaynak kapsamı geçersiz veya bu aktarım numarası zaten mevcut.');
  const t=bridge?.recordsets?.[0]?.[0];
  if(bridge?.ok!==true||bridge.recordsets[0].length!==1||t.terminalId!==profile.terminalId||t.personnelId!==profile.personnelId||t.personnelCode!==profile.personnelCode||t.depotId!==1||t.depotCode!==profile.depotCode)fail('EXPORT_TERMINAL_MISMATCH','Armada terminal/personel/depo eşleştirmesi doğrulanamadı.');
  const c=mapping.customers?.[0];
  if(mapping.customers?.length!==1||text(c.code)!==source.customerCode||currencyCode(c.currency)!==source.currency||c.status!==1||!off(c.deleted)||!off(c.saleProhibited))fail('EXPORT_CUSTOMER_MISMATCH','Cari kodu ve para birimi Vega’da tekil ve satışa açık bir kayda bağlanamadı.');
  const used=[],quantities=new Map();let baseTotal=0n;
  const lines=source.items.map((i,index)=>{
    const candidates=mapping.units.filter(u=>u.localProductId===i.productId&&text(u.stockCode)===i.stockCode&&text(u.barcode)===i.barcode);
    if(candidates.length!==1)fail('EXPORT_PRODUCT_MAPPING','Ürün/barkod Vega birimine tekil bağlanamadı: '+i.stockCode);
    const u=candidates[0];
    if(u.stockId!==u.mappedStockId||u.unit!=='ADET'||amount(u.factor)!==S||amount(u.taxRate)!==0n||u.status!==1||!off(u.cancelled)||!off(u.deleted)||!off(u.saleProhibited))fail('EXPORT_UNIT_UNSUPPORTED','Ürün kimliği, ADET/çarpan veya sıfır KDV sözleşmesi uygun değil: '+i.stockCode);
    const basePrice=mul(amount(i.unitPrice),amount(source.exchangeRate)),baseLine=mul(amount(i.quantity),basePrice);
    baseTotal+=baseLine;quantities.set(u.stockId,(quantities.get(u.stockId)||0n)+amount(i.quantity));
    used.push({stockId:u.stockId,unitId:u.unitId,unit:'ADET',barcode:i.barcode,quantity:i.quantity,unitPrice:amountText(basePrice),total:amountText(baseLine),taxAmount:'0'});
    return Object.assign(blank(ARMADA_LINE_FIELDS),{Id:String(index+1),Stok:i.barcode,Barcode:i.barcode,Miktar:i.quantity,
      Fiyat:i.unitPrice,Tutar:i.lineTotal,Isk1:'0',Isk2:'0',Isk3:'0',Isk4:'0',AltIskonto:'0',IskToplam:'0',SatirToplam:i.lineTotal,
      KDV:'0',KDVTutar:'0',StokExtId:String(u.unitId),SatirSayisi:String(index+1),Parabirimi:sym(source.currency),Kur:source.exchangeRate,
      RBMiktar:'0',MiktarBos:'0',Kampanya:'0',Otv:'0',OtvTutar:'0'});
  });
  for(const [stockId,qty] of quantities){
    const s=mapping.stocks.filter(x=>x.stockId===stockId),r=mapping.reservations.filter(x=>x.stockId===stockId);
    if(s.length!==1||r.length!==1)fail('EXPORT_STOCK_UNKNOWN','Vega stok/rezerv miktarı doğrulanamadı.');
    const stock=amount(s[0].quantity),reserved=amount(r[0].quantity),card=amount(mapping.units.find(u=>u.stockId===stockId).cardReserved);
    if(qty>stock)fail('EXPORT_STOCK_INSUFFICIENT','Vega stoğu yetersiz; bu yeni aktarım akışında eksi stok izni verilmedi.');
    if(qty>stock-(reserved>card?reserved:card))fail('EXPORT_RESERVED_STOCK','Fiş Vega’daki rezerve stoğa giriyor.');
  }
  const [y,m,d]=source.documentDate.split('-'),number=exportNumber(source);
  const note=clean('Melisa fiş: '+source.documentNo+'; Personel: '+(source.employeeName||'-')+'; Terminal: '+(source.terminalCode||'-'));
  const enteredAt=new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(now)).replace(',','');
  const header=Object.assign(blank(ARMADA_HEADER_FIELDS),{Id:'1',Cari:c.code,CariExtId:String(c.id),BelgeNo:number,
    BelgeKod:uid.replaceAll('-',''),Tarih:d+'.'+m+'.'+y,BelgeTutar:source.grandTotal,AraToplam:source.subtotal,
    BelgeKDV:'0',NetToplam:source.grandTotal,BelgeTip:'33',IskontoTop:'0',AIsk1:'0',AIsk2:'0',AIsk3:'0',AIsk4:'0',Vade:source.documentDate,
    Parabirimi:sym(source.currency),Kur:source.exchangeRate,VgFatInd:'0',Terminal:String(t.terminalId),Kapali:'0',BelgeNot:note,
    Depo:t.depotCode,KayitTarihi:enteredAt,CikanDepo:t.depotCode,UID:uid,Personel:t.personnelCode,
    OtvToplam:'0',OdemeTutar:'0',SonBakiye:'0'});
  return {endpoint:ARMADA_SALE_ENDPOINT,armadaUserId:String(t.terminalId),document:{header,lines},source,sourceHash:exportDigest(source),
    exporter:{id:actor.id,username:actor.username},preparedAt:now,
    target:{terminalId:t.terminalId,terminalName:t.terminalName||String(t.terminalId),personnelCode:t.personnelCode,depot:t.depotCode},
    expected:{company:'F0102',period:'D0007',uid,armadaTerminalId:t.terminalId,customerId:c.id,personnelId:t.personnelId,
      depotId:1,documentNumber:number,date:source.documentDate,currency:sym(source.currency),exchangeRate:source.exchangeRate,
      exchangeRateSource:'melisa-invoice',total:amountText(baseTotal),lines:used}};
}
