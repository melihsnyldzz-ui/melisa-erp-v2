import test from 'node:test';import assert from 'node:assert/strict';
import {desktopAdditionalBarcodes,desktopAdditionalBarcodeText} from './desktopProductBarcodes.mjs';
test('barcode parsing preserves zeros and order, and refuses ambiguous or unbounded input',()=>{
 assert.deepEqual(desktopAdditionalBarcodeText('0001',' 0002\r\n\n0003 '),['0002','0003']);assert.deepEqual(desktopAdditionalBarcodes('0001',[]),[]);
 for(const v of [[1],[''],['0001'],['0002','0002'],[' 0002'],Array(11).fill('0002'),new Array(2),{0:'0002',length:1}])assert.throws(()=>desktopAdditionalBarcodes('0001',v));
 const a=['0002'];Object.defineProperty(a,'0',{get(){throw Error('getter must not execute');},enumerable:true});assert.throws(()=>desktopAdditionalBarcodes('0001',a),/PRODUCT_BARCODES_INVALID/);
 assert.deepEqual(desktopAdditionalBarcodes('ABC',['abc']),['abc']); // Native SQL collation, not JS casing, decides this conflict.
});
