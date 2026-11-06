// DES-04: ADET is the base; a full series is an immutable integer multiplier.
const fail=()=>{throw Object.assign(Error('PRODUCT_SERIES_INVALID'),{code:'PRODUCT_SERIES_INVALID'});};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
function exact(v,keys){return !!(v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value');}));}
const fixed3=n=>`${n/1000n}.${String(n%1000n).padStart(3,'0')}`;
export function desktopSeriesFactor(v){if(typeof v!=='string'||!/^([1-9]\d{0,6})\.00000000$/.test(v))fail();const n=BigInt(v.split('.')[0]);if(n<2n||n>1000000n)fail();return v;}
export function desktopSeriesInput(v){if(typeof v!=='string'||!/^[1-9]\d{0,6}$/.test(v)||BigInt(v)>1000000n)fail();return v==='1'?null:desktopSeriesFactor(v+'.00000000');}
export function isDesktopProductUnits(rows,productId,mainLabel){
 if(!id(productId)||typeof mainLabel!=='string'||!Array.isArray(rows)||Object.getPrototypeOf(rows)!==Array.prototype||![1,2].includes(rows.length)||Reflect.ownKeys(rows).length!==rows.length+1||Array.from({length:rows.length},(_,i)=>Object.getOwnPropertyDescriptor(rows,String(i))).some(d=>!d?.enumerable||!Object.hasOwn(d,'value')))return false;
 if(rows.some(u=>!exact(u,['id','productId','label','factorExact8','isMain'])||!id(u.id)||u.productId!==productId||typeof u.isMain!=='boolean'))return false;
 if(rows[0].label!==mainLabel||rows[0].factorExact8!=='1.00000000'||rows[0].isMain!==true)return false;
 if(rows.length===2){try{desktopSeriesFactor(rows[1].factorExact8);}catch{return false;}if(mainLabel!=='ADET'||rows[1].label!=='SERİ'||rows[1].isMain!==false||rows[0].id===rows[1].id)return false;}
 return true;
}
export function desktopSeriesPieces(quantityExact3,factorExact8){
 desktopSeriesFactor(factorExact8);if(typeof quantityExact3!=='string'||!/^[1-9]\d{0,12}\.000$/.test(quantityExact3))fail();
 const n=BigInt(quantityExact3.replace('.',''))*BigInt(factorExact8.split('.')[0]);if(n>9007199254740991n)fail();return fixed3(n);
}
export function isDesktopSeriesSelection(v){if(!exact(v,['unitId','factorExact8','quantityExact3'])||!id(v.unitId))return false;try{desktopSeriesPieces(v.quantityExact3,v.factorExact8);return true;}catch{return false;}}
export function desktopSeriesStock(stockExact3,factorExact8){
 desktopSeriesFactor(factorExact8);if(typeof stockExact3!=='string'||!/^\-?(?:0|[1-9]\d{0,14})\.\d{3}$/.test(stockExact3))fail();
 let n=BigInt(stockExact3.replace('.',''));const negative=n<0n;if(negative)n=-n;const size=BigInt(factorExact8.split('.')[0])*1000n;return Object.freeze({negative,wholeSeries:String(n/size),remainderExact3:fixed3(n%size)});
}
export function desktopSeriesStockLabel(stockExact3,factorExact8){const s=desktopSeriesStock(stockExact3,factorExact8);return (s.negative?'Eksi stok: ':'')+s.wholeSeries+' SERİ'+(s.remainderExact3==='0.000'?'':' + '+s.remainderExact3+' ADET');}
