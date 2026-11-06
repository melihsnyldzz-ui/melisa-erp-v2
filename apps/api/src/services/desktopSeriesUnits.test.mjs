import test from 'node:test';import assert from 'node:assert/strict';
import {desktopSeriesFactor,desktopSeriesInput,isDesktopProductUnits,desktopSeriesPieces,isDesktopSeriesSelection,desktopSeriesStock,desktopSeriesStockLabel} from '../../../../packages/shared/src/desktopSeriesUnits.mjs';
test('base ADET, full series and remainder keep exact quantities without rounding',()=>{
 assert.equal(desktopSeriesInput('1'),null);assert.equal(desktopSeriesInput('6'),'6.00000000');assert.equal(desktopSeriesPieces('10.000','6.00000000'),'60.000');assert.equal(desktopSeriesPieces('2.000','4.00000000'),'8.000');
 assert.deepEqual(desktopSeriesStock('61.500','6.00000000'),{negative:false,wholeSeries:'10',remainderExact3:'1.500'});assert.equal(desktopSeriesStockLabel('60.000','6.00000000'),'10 SERİ');assert.equal(desktopSeriesStockLabel('-61.500','6.00000000'),'Eksi stok: 10 SERİ + 1.500 ADET');assert.equal(desktopSeriesStockLabel('0.001','6.00000000'),'0 SERİ + 0.001 ADET');
 for(const f of ['1.00000000','0.00000000','6','6.50000000','1000001.00000000'])assert.throws(()=>desktopSeriesFactor(f));for(const q of ['0.000','1.500','1','9999999999999.000'])assert.throws(()=>desktopSeriesPieces(q,'6.00000000'));
});
test('unit selection requires the same product and an exact immutable secondary series',()=>{
 const units=[{id:'1',productId:'7',label:'ADET',factorExact8:'1.00000000',isMain:true},{id:'2',productId:'7',label:'SERİ',factorExact8:'6.00000000',isMain:false}];assert.equal(isDesktopProductUnits(units,'7','ADET'),true);for(const change of [{productId:'8'},{label:'ADET'},{factorExact8:'1.00000000'},{isMain:true},{id:'1'}])assert.equal(isDesktopProductUnits([units[0],{...units[1],...change}],'7','ADET'),false);
 assert.equal(isDesktopSeriesSelection({unitId:'2',factorExact8:'6.00000000',quantityExact3:'2.000'}),true);assert.equal(isDesktopSeriesSelection({unitId:'2',factorExact8:'6.00000000',quantityExact3:'2.500'}),false);
});
