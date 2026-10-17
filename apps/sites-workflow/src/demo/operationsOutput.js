import { assert, kinds } from './operationsShared.js';

const value=minor=>(minor/100).toFixed(2);
const demo='Bağlı demo çıktısı · Resmi e-belge değildir';
const product=(state,id)=>state.products.find(p=>p.id===id);
const itemColumns=[{label:'Stok kodu',key:'code'},{label:'Ürün',key:'name'},{label:'Paket',key:'quantity'},{label:'Birim fiyat',key:'unitPrice'},{label:'İskonto %',key:'discount'},{label:'Net tutar',key:'net'},{label:'Para birimi',key:'currency'}];
const itemRows=(state,items,currency)=>items.map(l=>({code:product(state,l.productId)?.code||'',name:product(state,l.productId)?.name||'',quantity:l.quantity,unitPrice:value(l.unitPrice),discount:l.discount,net:value(l.total),currency}));

export function orderOutput(state,order){
 const customer=state.customers.find(c=>c.id===order.customerId)?.name||'';
 return {title:`Proforma · ${order.number}`,subtitle:`${customer} · ${order.date} · sürüm ${order.quoteVersion} · net ${value(order.net)} + KDV ${value(order.tax)} = ${value(order.amount)} ${order.currency} · ${demo}`,filename:`proforma-${order.number}`,columns:itemColumns,rows:itemRows(state,order.items,order.currency)};
}
export function saleOutput(state,doc){
 assert(doc?.kind==='sale'&&doc.status==='APPROVED','Onaylı satış belgesi seçin.');
 return {title:`Satış fişi · ${doc.number}`,subtitle:`${state.customers.find(c=>c.id===doc.partyId)?.name||''} · ${doc.date} · net ${value(doc.net)} + KDV ${value(doc.tax)} = ${value(doc.amount)} ${doc.currency} · ${demo}`,filename:`satis-fisi-${doc.number}`,columns:itemColumns,rows:itemRows(state,doc.items,doc.currency)};
}
export function shipmentOutput(state,order,shipment){
 assert(shipment&&shipment.orderId===order.id,'Sevk kaydı bulunamadı.');
 return {title:`Paket listesi · ${shipment.number}`,subtitle:`${order.number} / ${state.documents.find(d=>d.id===shipment.saleDocumentId)?.number} · ${shipment.shipDate} · ${shipment.carrier} ${shipment.trackingNumber} · ${shipment.address} · ${value(shipment.amount)} ${shipment.currency} · ${demo}`,filename:`paket-listesi-${shipment.number}`,columns:[{label:'Koli',key:'box'},{label:'Stok kodu',key:'code'},{label:'Ürün',key:'name'},{label:'Paket',key:'quantity'},{label:'Para birimi',key:'currency'}],rows:shipment.boxes.flatMap(b=>b.items.map(l=>({box:b.code,code:product(state,l.productId)?.code||'',name:product(state,l.productId)?.name||'',quantity:l.quantity,currency:shipment.currency})))};
}
export function statementOutput(state,partyId,currency){
 const party=[...state.customers,...state.suppliers].find(p=>p.id===partyId);assert(party,'Cari seçin.');
 let balance=0;
 const rows=state.movements.filter(m=>m.partyId===partyId&&m.currency===currency&&m.partyDelta).map(m=>{balance+=m.partyDelta;return {date:m.date,document:state.documents.find(d=>d.id===m.documentId)?.number||'',kind:m.kind==='cancel'?'İptal':kinds[m.kind]||m.kind,debit:value(Math.max(m.partyDelta,0)),credit:value(Math.max(-m.partyDelta,0)),balance:value(balance),currency};});
 return {title:`Cari ekstre · ${party.name}`,subtitle:`${currency} · son bakiye ${value(balance)} ${currency} · ${demo}`,filename:`cari-ekstre-${partyId}-${currency}`,columns:[{label:'Tarih',key:'date'},{label:'Belge',key:'document'},{label:'İşlem',key:'kind'},{label:'Borç',key:'debit'},{label:'Alacak',key:'credit'},{label:'Bakiye',key:'balance'},{label:'Döviz',key:'currency'}],rows};
}
export function receiptOutput(state,doc){
 assert(doc?.status==='APPROVED'&&['collection','payment','order-payment','customer-refund','supplier-refund'].includes(doc.kind),'Onaylı ödeme belgesi seçin.');
 const party=[...state.customers,...state.suppliers].find(p=>p.id===doc.partyId)?.name||'';
 return {title:`Ödeme makbuzu · ${doc.number}`,subtitle:`${party} · ${doc.date} · ${doc.channel||''} · ${value(doc.amount)} ${doc.currency} · ${demo}`,filename:`odeme-makbuzu-${doc.number}`,columns:[{label:'Belge',key:'number'},{label:'Tür',key:'kind'},{label:'Bağlı fatura',key:'settlement'},{label:'Tutar',key:'amount'},{label:'Döviz',key:'currency'}],rows:[{number:doc.number,kind:kinds[doc.kind],settlement:state.documents.find(d=>d.id===doc.settlementDocumentId)?.number||'',amount:value(doc.amount),currency:doc.currency}]};
}
