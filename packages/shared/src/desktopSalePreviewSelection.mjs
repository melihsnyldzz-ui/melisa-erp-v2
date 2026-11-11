import {desktopSeriesPieces,isDesktopSeriesSelection} from './desktopSeriesUnits.mjs';
const fail=()=>{throw Error('Seri miktarı ve güncel ürün seçimi doğrulanamadı.');};
function quantity(value){if(typeof value!=='string')fail();const m=/^(0|[1-9]\d{0,12})(?:[.,](\d{1,3}))?$/.exec(value.trim());if(!m)fail();const result=m[1]+'.'+(m[2]??'').padEnd(3,'0'),n=BigInt(result.replace('.',''));if(n===0n||n>9007199254740991n)fail();return result;}
export function desktopSeriesDraftItems({productIds,quantities,quantityUnits,preview}={}){
 if(!Array.isArray(productIds)||productIds.length<1||productIds.length>2||![productIds,quantities,quantityUnits,preview?.products].every(v=>Array.isArray(v)&&v.length===productIds.length&&Array.from({length:v.length},(_,i)=>Object.hasOwn(v,String(i))).every(Boolean))||Array.from(productIds).some(v=>typeof v!=='string'||! /^[1-9]\d{0,15}$/.test(v)||BigInt(v)>9007199254740991n)||new Set(productIds).size!==productIds.length)fail();
 return productIds.map((productId,i)=>{const p=preview.products[i],entered=quantity(quantities[i]);if(typeof productId!=='string'||p?.productId!==productId||!['ADET','SERİ'].includes(quantityUnits[i]))fail();
  if(quantityUnits[i]==='ADET')return {productId,quantityExact3:entered};
  const series={unitId:p.seriesUnit?.unitId,factorExact8:p.seriesUnit?.factorExact8,quantityExact3:entered};if(p.unit!=='ADET'||!isDesktopSeriesSelection(series))fail();return {productId,quantityExact3:desktopSeriesPieces(entered,series.factorExact8),series};
 });
}
