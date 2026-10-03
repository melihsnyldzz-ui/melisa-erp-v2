import {createHash} from 'node:crypto';
const text=v=>String(v??'').trim();
const currency=v=>({'$':'USD','USD':'USD','€':'EUR','EUR':'EUR','TL':'TRY','TRY':'TRY'}[text(v)]||null);
export const fullStockHash=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
export function prepareFullStock(source){
 if(source.source!=='VEGA2026/F0102/D0007'||!source.sourceReadOnly||source.identity?.admin!==0||source.identity.stockWrite!==0)throw Error('FULL_STOCK_SOURCE_GUARD');
 const units=new Map();for(const u of source.units){const list=units.get(u.sourceId)||[];list.push(u);units.set(u.sourceId,list);}
 const products=[],excluded=[],adjustments=[],missingBarcodes=[],issues=[];
 for(const p of source.products){
  if(p.saleProhibited||(!Number(p.quantity)&&!Number(p.movementCount))||/^TEST[-_]/i.test(text(p.stockCode))){excluded.push({sourceId:p.sourceId,stockCode:p.stockCode,reason:p.saleProhibited?'SALES_PROHIBITED':/^TEST[-_]/i.test(text(p.stockCode))?'EXPLICIT_TEST_CARD':'ZERO_STOCK_NO_CURRENT_PERIOD_MOVEMENT'});continue;}
  const all=[...(units.get(p.sourceId)||[])].sort((a,b)=>Number(b.isDefault)-Number(a.isDefault)||Number(b.isBase)-Number(a.isBase)||a.unitId-b.unitId),primary=all[0];
  if(!primary||!primary.isDefault||!primary.isBase||all.filter(u=>u.isDefault).length!==1||text(primary.unit)!=='ADET'||primary.factor!==1||primary.taxRate!==0||!(primary.price>0)||!currency(primary.currency)||!text(p.stockCode)||text(p.stockCode).length>50||p.reserved||p.packageContent||p.packageForm||p.seriesSourceId){issues.push({sourceId:p.sourceId,stockCode:p.stockCode,reason:'PRIMARY_OR_PACKAGE_UNVERIFIED'});continue;}
  const quantity=Math.sign(p.quantity)*Math.round(Math.abs(p.quantity));
  if(quantity!==p.quantity)adjustments.push({sourceId:p.sourceId,stockCode:p.stockCode,kind:'QUANTITY_ROUNDING',before:p.quantity,after:quantity,rule:'Nearest integer; halves away from zero; owner approved'});
  const name=text(p.name)||text(p.stockCode);
  if(!text(p.name))adjustments.push({sourceId:p.sourceId,stockCode:p.stockCode,kind:'MISSING_NAME_CODE_DISPLAY',before:p.name,after:name});
  for(const u of all){if(u.price!==primary.price||currency(u.currency)!==currency(primary.currency)||text(u.unit)!==text(primary.unit)||u.factor!==primary.factor||u.taxRate!==primary.taxRate)adjustments.push({sourceId:p.sourceId,stockCode:p.stockCode,kind:'UNIT_NORMALIZED_TO_PRIMARY',unitId:u.unitId,barcode:text(u.barcode),before:{price:u.price,currency:u.currency,unit:u.unit,factor:u.factor,tax:u.taxRate},after:{price:primary.price,currency:currency(primary.currency),unit:'ADET',factor:1,tax:0},authorityUnitId:primary.unitId});}
  const barcodes=[...new Set([text(primary.barcode),...all.map(u=>text(u.barcode))].filter(Boolean))];
  if(barcodes.some(b=>b.length>80||/[\x00-\x1f]/.test(b))){issues.push({sourceId:p.sourceId,stockCode:p.stockCode,reason:'BARCODE_NOT_REPRESENTABLE'});continue;}
  if(!barcodes.length)missingBarcodes.push({sourceId:p.sourceId,stockCode:p.stockCode,name,quantity});
  products.push({sourceId:p.sourceId,stockCode:text(p.stockCode),name,brand:text(p.brand)||null,category:text(p.category)||null,quantity,sourceQuantity:p.quantity,price:primary.price,currency:currency(primary.currency),unit:'ADET',factor:1,taxRate:0,barcodes,primaryBarcode:barcodes[0]||null,primaryUnitId:primary.unitId,packageContent:p.packageContent,packageForm:p.packageForm,seriesSourceId:p.seriesSourceId,sourceUnits:all});
 }
 const codes=new Map(),barcodes=new Map();for(const p of products){const code=p.stockCode.toLocaleUpperCase('tr');if(codes.has(code))issues.push({reason:'STOCK_CODE_DUPLICATE',stockCode:p.stockCode,ids:[codes.get(code),p.sourceId]});codes.set(code,p.sourceId);for(const barcode of p.barcodes){if(barcodes.has(barcode)&&barcodes.get(barcode)!==p.sourceId)issues.push({reason:'BARCODE_AMBIGUOUS',barcode,ids:[barcodes.get(barcode),p.sourceId]});barcodes.set(barcode,p.sourceId);}}
 return {at:source.at,source:source.source,sourceReadOnly:true,sourceHash:fullStockHash(source),selection:{rule:'STATUS=1; not cancelled/deleted/prohibited; nonzero stock OR movement in D0007; explicit TEST- cards excluded',sourceActive:source.products.length,excluded:excluded.length,products:products.length,barcodes:barcodes.size,negative:products.filter(p=>p.quantity<0).length,zero:products.filter(p=>p.quantity===0).length,positive:products.filter(p=>p.quantity>0).length,quantity:products.reduce((s,p)=>s+p.quantity,0)},products,excluded,adjustments,missingBarcodes,issues};
}
