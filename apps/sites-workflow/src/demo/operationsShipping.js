import { assert, quantity, today, validDate } from './operationsShared.js';

export function fulfillment(order) { return order.fulfillment || { pendingBoxes:[], shipments:[] }; }
export function shippedQuantity(order, productId) {
  return fulfillment(order).shipments.filter(s=>s.status!=='VOID').flatMap(s=>s.items).filter(i=>i.productId===productId).reduce((sum,i)=>sum+i.quantity,0);
}
export function remainingToShip(state, order) {
  const corrected=state.documents.filter(d=>d.status==='APPROVED'&&d.referenceId===order.saleDocumentId&&['sales-return','delivery-correction'].includes(d.kind));
  return order.items.map(line=>({productId:line.productId,ordered:line.quantity,corrected:corrected.flatMap(d=>d.items).filter(i=>i.productId===line.productId).reduce((sum,i)=>sum+i.quantity,0),shipped:shippedQuantity(order,line.productId)})).map(line=>({...line,remaining:Math.max(0,line.ordered-line.corrected-line.shipped)}));
}
const clean=value=>String(value||'').trim();
const groupItems=boxes=>{const map=new Map();for(const box of boxes)for(const line of box.items)map.set(line.productId,(map.get(line.productId)||0)+line.quantity);return [...map].map(([productId,quantity])=>({productId,quantity}));};

export function transitionShipping(state,order,command) {
  assert(order.saleDocumentId&&state.documents.some(d=>d.id===order.saleDocumentId&&d.status==='APPROVED'),'Onaylı satış belgesi bulunamadı.');
  const flow=order.fulfillment ||= {pendingBoxes:[],shipments:[]};
  if(command.type==='pack-order') {
    assert(['PAID','ON_ACCOUNT','PACKING','SHIPPED'].includes(order.status),'Yalnız satışa dönüşen sipariş paketlenebilir.');
    assert(!flow.pendingBoxes.length||clean(command.correctionReason),'Açık koli hazırlığını değiştirmek için düzeltme gerekçesi yazın.');
    const checkedBy=clean(command.checkedBy),note=clean(command.note),differenceReason=clean(command.differenceReason);
    assert(checkedBy&&note,'Paketleyen kişi ve kontrol notu zorunlu.');
    assert(Array.isArray(command.boxes)&&command.boxes.length>0&&command.boxes.length<=100,'En az bir koli oluşturun.');
    const usedCodes=new Set(flow.shipments.flatMap(s=>s.boxes.map(b=>b.code.toLocaleLowerCase('tr'))));
    const available=new Map(remainingToShip(state,order).map(l=>[l.productId,l.remaining]));
    const boxes=command.boxes.map(box=>{
      const code=clean(box.code),key=code.toLocaleLowerCase('tr');
      assert(code&&code.length<=60&&!usedCodes.has(key),'Koli kodu boş, çok uzun veya daha önce kullanılmış.');usedCodes.add(key);
      assert(Array.isArray(box.items)&&box.items.length,'Her kolide ürün sayılmalı.');
      const seen=new Set();const items=box.items.map(item=>{const productId=String(item.productId),q=quantity(item.quantity);assert(available.has(productId)&&!seen.has(productId),'Koli yalnız sipariş ürününü bir kez içerebilir.');seen.add(productId);return {productId,quantity:q};});
      return {code,items};
    });
    const packed=groupItems(boxes),checked=command.checked||{};
    for(const [productId,remaining] of available){const counted=quantity(checked[productId]??0,true),inBoxes=packed.find(i=>i.productId===productId)?.quantity||0;assert(counted===inBoxes,'Kolilerdeki adet ile kontrol edilen adet uyuşmuyor.');assert(counted<=remaining,'Paket adedi siparişin kalan sevk adedini aşıyor.');if(counted<remaining)assert(differenceReason,'Eksik paketlenen miktar için fark nedenini yazın.');}
    flow.pendingBoxes=boxes;flow.packCheck={checkedBy,note,differenceReason,expected:Object.fromEntries(available),checked:Object.fromEntries([...available.keys()].map(id=>[id,Number(checked[id]||0)])),at:new Date().toISOString(),correctionReason:clean(command.correctionReason)};
    order.status='PACKING';state.revision++;return state;
  }
  if(command.type==='ship-order') {
    assert(order.status==='PACKING'&&flow.pendingBoxes.length,'Önce koli içeriğini kontrol edip kaydedin.');
    const address=clean(command.address),carrier=clean(command.carrier),trackingNumber=clean(command.trackingNumber),shipDate=String(command.shipDate||'');
    assert(address&&carrier&&trackingNumber,'Teslimat adresi, taşıyıcı ve takip numarası zorunlu.');validDate(shipDate);
    assert(shipDate>=state.documents.find(d=>d.id===order.saleDocumentId).date&&shipDate<=today(),'Sevk tarihi satıştan önce veya gelecek tarih olamaz.');
    assert(!flow.shipments.some(s=>s.carrier.toLocaleLowerCase('tr')===carrier.toLocaleLowerCase('tr')&&s.trackingNumber===trackingNumber),'Taşıyıcı ve takip numarası daha önce kaydedildi.');
    assert(order.paymentTerms!=='OPEN_ACCOUNT'||(order.creditDecision&&order.dueDate),'Vadeli sevk için kredi kararı ve vade zorunlu.');
    assert(order.paymentTerms==='OPEN_ACCOUNT'||order.paidAmount===order.amount,'Peşin sipariş tam ödenmeden sevk edilemez.');
    const items=groupItems(flow.pendingBoxes),available=new Map(remainingToShip(state,order).map(l=>[l.productId,l.remaining]));
    for(const item of items)assert(item.quantity<=available.get(item.productId),'İade veya düzeltme sonrası koli adedi kalan sevki aşıyor. Kolileri yeniden sayın.');
    const previousNet=order.items.reduce((sum,l)=>sum+Math.round(l.total*shippedQuantity(order,l.productId)/l.quantity),0);
    const afterNet=order.items.reduce((sum,l)=>sum+Math.round(l.total*(shippedQuantity(order,l.productId)+(items.find(i=>i.productId===l.productId)?.quantity||0))/l.quantity),0);
    const net=afterNet-previousNet,tax=Math.round(afterNet*order.taxRate/100)-Math.round(previousNet*order.taxRate/100);
    const index=flow.shipments.length+1,shipment={id:index,number:`SEVK-${String(order.id).padStart(5,'0')}-${String(index).padStart(2,'0')}`,orderId:order.id,saleDocumentId:order.saleDocumentId,customerId:order.customerId,currency:order.currency,shipDate,address,carrier,trackingNumber,boxes:flow.pendingBoxes,items,net,tax,amount:net+tax,status:'IN_TRANSIT',checkedBy:flow.packCheck.checkedBy,packNote:flow.packCheck.note,differenceReason:flow.packCheck.differenceReason,createdAt:new Date().toISOString()};
    flow.shipments.push(shipment);flow.pendingBoxes=[];flow.packCheck=null;order.status='SHIPPED';order.shippedAt=new Date().toISOString();state.revision++;return state;
  }
  if(command.type==='confirm-delivery') {
    const shipment=flow.shipments.find(s=>s.id===Number(command.shipmentId));
    assert(shipment?.status==='IN_TRANSIT','Teslim teyidi bekleyen sevk bulunamadı.');
    const deliveredDate=String(command.deliveredDate||''),receivedBy=clean(command.receivedBy);validDate(deliveredDate);
    assert(deliveredDate>=shipment.shipDate&&deliveredDate<=today()&&receivedBy,'Teslim tarihi ve teslim alan kişi zorunlu.');
    shipment.status='DELIVERED';shipment.deliveredDate=deliveredDate;shipment.receivedBy=receivedBy;shipment.deliveryNote=clean(command.note);shipment.deliveredAt=new Date().toISOString();
    if(!flow.pendingBoxes.length&&flow.shipments.filter(s=>s.status!=='VOID').every(s=>s.status==='DELIVERED')&&remainingToShip(state,order).every(l=>l.remaining===0)){order.status='COMPLETED';order.completedAt=shipment.deliveredAt;}
    state.revision++;return state;
  }
  if(command.type==='void-shipment') {
    const shipment=flow.shipments.find(s=>s.id===Number(command.shipmentId)),reason=clean(command.reason);
    assert(shipment?.status==='IN_TRANSIT'&&reason,'Yalnız teslim edilmemiş sevk gerekçeyle iptal edilebilir.');
    shipment.status='VOID';shipment.voidReason=reason;shipment.voidedAt=new Date().toISOString();
    order.status=flow.pendingBoxes.length?'PACKING':flow.shipments.some(s=>s.status!=='VOID')?'SHIPPED':order.paymentTerms==='OPEN_ACCOUNT'?'ON_ACCOUNT':'PAID';state.revision++;return state;
  }
  throw Error('Desteklenmeyen sevk komutu.');
}

export function microExportContract(state,order) {
  const shipments=fulfillment(order).shipments.filter(s=>s.status!=='VOID');
  assert(shipments.length,'Aktarılacak kayıtlı sevk bulunamadı.');
  return {schema:'melisa.micro-export.v1',source:'melisa-erp-demo',orderNumber:order.number,saleDocumentNumber:state.documents.find(d=>d.id===order.saleDocumentId)?.number,customer:{id:order.customerId,name:state.customers.find(c=>c.id===order.customerId)?.name||''},currency:order.currency,paymentTerms:order.paymentTerms,shipments:shipments.map(s=>({number:s.number,date:s.shipDate,address:s.address,carrier:s.carrier,trackingNumber:s.trackingNumber,amountMinor:s.amount,boxes:s.boxes.map(b=>({code:b.code,items:b.items.map(i=>({productCode:state.products.find(p=>p.id===i.productId)?.code,quantity:i.quantity}))}))}))};
}
