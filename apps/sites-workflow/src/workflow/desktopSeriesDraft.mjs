import {desktopSeriesPieces,isDesktopSeriesSelection} from '../../../../packages/shared/src/desktopSeriesUnits.mjs';
const fail=()=>{throw Error('Seri miktarı ve güncel ürün seçimi doğrulanamadı.');};
function quantity(value){if(typeof value!=='string')fail();const m=/^(0|[1-9]\d{0,12})(?:[.,](\d{1,3}))?$/.exec(value.trim());if(!m)fail();const result=m[1]+'.'+(m[2]??'').padEnd(3,'0'),n=BigInt(result.replace('.',''));if(n===0n||n>9007199254740991n)fail();return result;}
export function desktopSeriesDraftItems({productIds,quantities,quantityUnits,preview}={}){
 if(![productIds,quantities,quantityUnits,preview?.products].every(v=>Array.isArray(v)&&v.length===2)||new Set(productIds).size!==2)fail();
 return productIds.map((productId,i)=>{const p=preview.products[i],entered=quantity(quantities[i]);if(typeof productId!=='string'||p?.productId!==productId||!['ADET','SERİ'].includes(quantityUnits[i]))fail();
  if(quantityUnits[i]==='ADET')return {productId,quantityExact3:entered};
  const series={unitId:p.seriesUnit?.unitId,factorExact8:p.seriesUnit?.factorExact8,quantityExact3:entered};if(p.unit!=='ADET'||!isDesktopSeriesSelection(series))fail();return {productId,quantityExact3:desktopSeriesPieces(entered,series.factorExact8),series};
 });
}
