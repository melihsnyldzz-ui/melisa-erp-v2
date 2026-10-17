import { assert } from './operationsShared.js';
import { resolveProductBarcode } from './operationsCards.js';

// Scanner input is held in the form until one full package has been observed.
// A unit barcode always identifies one piece of a specific size, never a stock row.
export function scanPackage(state, pending, value){
 const match=resolveProductBarcode(state,value);assert(match,'Barkod kayıtlı bir ürüne ait değil.');
 const product=state.products.find(item=>item.id===match.productId);
 assert(product.active!==false,'Pasif ürün yeni işleme eklenemez.');
 assert(!pending?.scans?.length||pending.productId===product.id,'Önce açık serinin eksik bedenlerini tamamlayın veya taramayı temizleyin.');
 if(match.kind==='PACKAGE'){
  assert(!pending?.scans?.length,'Eksik seri varken paket barkodu eklenemez.');
  return {product,complete:true,barcode:match.barcode,unitScans:null,pending:null};
 }
 const series=product.series||[];
 assert(series.length&&product.unitBarcodes?.length===series.length,'Parça barkodları serinin tüm bedenlerine tanımlanmalı.');
 const scans=[...(pending?.scans||[]),match.barcode];
 const counts=Object.fromEntries(series.map(part=>[part.size,0]));
 for(const barcode of scans){const item=product.unitBarcodes.find(part=>part.barcode===barcode);counts[item.size]++;}
 assert(series.every(part=>counts[part.size]<=part.quantity),'Bu bedenden seride gereken sayı zaten okutuldu.');
 const complete=series.every(part=>counts[part.size]===part.quantity);
 return {product,complete,barcode:null,unitScans:complete?scans:null,pending:complete?null:{productId:product.id,scans,counts}};
}
export function appendScannedPackage(items,scan,defaults={}){
 assert(scan.complete,'Seri tamamlanmadan ürün satırı eklenemez.');
 const current=items.find(item=>item.productId===scan.product.id);
 const evidence=scan.barcode?{barcode:scan.barcode}:{unitScans:scan.unitScans};
 if(!current)return [...items,{productId:scan.product.id,quantity:'1',discount:'0',...defaults,...evidence}];
 assert((scan.barcode&&current.barcode===scan.barcode)||(scan.unitScans&&Array.isArray(current.unitScans)),'Bu satırda elle girilen miktar veya farklı barkod var. Önce satırı çıkarın.');
 const next={...current,quantity:String(Number(current.quantity)+1)};
 if(scan.unitScans)next.unitScans=[...current.unitScans,...scan.unitScans];
 return items.map(item=>item===current?next:item);
}
