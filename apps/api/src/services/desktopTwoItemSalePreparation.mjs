// Source-only admission before creating the first reservation. Callers must
// obtain these snapshots and all active reservation totals under the same
// serializable SQL tx. Do not reuse after this draft already owns a reservation:
// dispatch needs a separate locked check which accounts for its own reservation.
// This module creates no draft, reservation, stock movement or permission.
import {createHash} from 'node:crypto';
import {desktopSaleSelectionRevision,prepareDesktopSale} from './desktopSalePreparation.mjs';
import {isDesktopSeriesSelection,desktopSeriesPieces} from '../../../../packages/shared/src/desktopSeriesUnits.mjs';

const fail=()=>{throw Error('DESKTOP_TWO_ITEM_SELECTION_INVALID');};
const scaled3=value=>{
 if(typeof value!=='string'||!/^(?:0|[1-9]\d{0,12})\.\d{3}$/.test(value))fail();
 return BigInt(value.replace('.',''));
};
const scaled4=value=>BigInt(value.replace('.',''));
const fixed=(value,scale)=>{const sign=value<0n?'-':'';if(value<0n)value=-value;const unit=10n**BigInt(scale);return `${sign}${value/unit}.${String(value%unit).padStart(scale,'0')}`;};
export function desktopTwoItemRevision(locked){
 return createHash('sha256').update(JSON.stringify(locked),'utf8').digest('hex');
}
export function prepareDesktopTwoItemSale(request,locked){
 if(!request||Object.keys(request).sort().join(',')!=='customerId,documentDate,expectedRevision,items,requestId'||
    !Array.isArray(request.items)||request.items.length<1||request.items.length>2||!locked||!Array.isArray(locked.products)||locked.products.length!==request.items.length||
    !Array.isArray(locked.reservedExact3)||locked.reservedExact3.length!==request.items.length||
    typeof request.expectedRevision!=='string'||request.expectedRevision!==desktopTwoItemRevision(locked))fail();
 const ids=new Set(),lines=[],seriesSelections=[];
 for(let i=0;i<request.items.length;i++){
  const item=request.items[i],product=locked.products[i];
  if(!item||Object.keys(item).sort().join(',')!==(Object.hasOwn(item,'series')?'productId,quantityExact3,series':'productId,quantityExact3')||!product||item.productId!==product.id||ids.has(item.productId))fail();
  if(Object.hasOwn(item,'series')){const s=item.series;if(product.unit!=='ADET'||!isDesktopSeriesSelection(s)||s.unitId!==product.seriesUnit?.unitId||s.factorExact8!==product.seriesUnit?.factorExact8||desktopSeriesPieces(s.quantityExact3,s.factorExact8)!==item.quantityExact3)fail();seriesSelections.push(Object.freeze({productId:item.productId,unitId:s.unitId,factorExact8:s.factorExact8,seriesQuantityExact3:s.quantityExact3,pieceQuantityExact3:item.quantityExact3}));}
  ids.add(item.productId);
  const available=scaled3(product.stockExact3)-scaled3(locked.reservedExact3[i]);
  if(available<scaled3(item.quantityExact3))fail();
  const selected={customer:locked.customer,product};
  lines.push(prepareDesktopSale({requestId:request.requestId,customerId:request.customerId,productId:item.productId,quantityExact3:item.quantityExact3,documentDate:request.documentDate,expectedRevision:desktopSaleSelectionRevision(selected)},selected));
 }
 const total=lines.reduce((sum,line)=>sum+scaled4(line.expected.totalExact4),0n);
 if(total>9007199254740991n)fail();
 // Native normalization sums unrounded JS line values before SQL storage.
 const raw=lines.reduce((sum,line)=>sum+line.invoice.items[0].quantity*line.invoice.items[0].unitPrice,0);
 if(!Number.isSafeInteger(Math.round(raw*10000))||BigInt(Math.round(raw*10000))!==total)fail();
 const customerAfter=scaled4(locked.customer.balanceExact4)+total;
 const accountAfter=BigInt(locked.customer.accountBalanceExact8.replace('.',''))+total*10000n;
 const limit=9007199254740991n;if(customerAfter>limit||customerAfter< -limit||accountAfter>limit||accountAfter< -limit)fail();
 const invoice={...lines[0].invoice,items:lines.map(line=>line.invoice.items[0])};
 const expectedLines=lines.map(({expected:e})=>Object.freeze({productId:e.productId,unitId:e.unitId,priceId:e.priceId,quantityExact3:e.quantityExact3,unitPriceExact4:e.unitPriceExact4,lineTotalExact4:e.totalExact4,stockBeforeExact3:e.stockBeforeExact3,stockAfterExact3:e.stockAfterExact3}));
 return Object.freeze({invoice,expected:Object.freeze({customerId:request.customerId,entityId:locked.customer.entityId,accountId:locked.customer.accountId,currency:'TRY',totalExact4:fixed(total,4),customerBeforeExact4:locked.customer.balanceExact4,customerAfterExact4:fixed(customerAfter,4),accountBeforeExact8:locked.customer.accountBalanceExact8,accountAfterExact8:fixed(accountAfter,8),lines:Object.freeze(expectedLines)}),...(seriesSelections.length?{seriesSelections:Object.freeze(seriesSelections)}:{})});
}
