import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AsyncLocalStorage} from 'node:async_hooks';
import vm from 'node:vm';

test('public quote drops cost/profit and unknown nested data while preserving sale amounts',async()=>{
 const source=await readFile(new URL('./desktopWorkflowDraftPrivate.mjs',import.meta.url),'utf8');
 const context=vm.createContext({});const module=new vm.SourceTextModule(source,{context});
 const exportsBySpecifier=new Map();
 for(const m of source.matchAll(/import\s+(?:\{([^}]+)\}|\*\s+as\s+\w+|(\w+))\s+from\s+['"]([^'"]+)['"]/g)){
  const names=m[1]?m[1].split(',').map(x=>x.trim().split(/\s+as\s+/)[0]):m[2]?['default']:[];
  exportsBySpecifier.set(m[3],[...new Set([...(exportsBySpecifier.get(m[3])??[]),...names])]);
 }
 await module.link(specifier=>{const names=exportsBySpecifier.get(specifier);if(!names)throw Error('unrecognized import: '+specifier);return new vm.SyntheticModule(names,function(){for(const name of names)this.setExport(name,specifier==='node:async_hooks'&&name==='AsyncLocalStorage'?AsyncLocalStorage:()=>{throw Error('unexpected dependency call');});},{context});});
 await module.evaluate();const project=module.namespace.projectDesktopPublicSaleQuote;
 const line={productId:'9',quantityExact3:'1.000',unitPriceExact4:'0.7500',lineTotalExact4:'0.7500',unitCostTryExact4:'8.0000',grossProfitTryExact4:'22.0000',privateNested:{cost:'hidden'}};
 const quote={currency:'USD',lines:[line,{...line,productId:'10'}],subtotalExact4:'1.5000',discountRateExact4:'0.0000',discountTotalExact4:'0.0000',totalExact4:'1.5000',maxDiscountRateExact4:'3.0000',belowCostWarning:false,writeSupported:true,accountId:'7',accountCurrency:'USD',accountAmountExact4:'1.5000',amountTryExact4:'60.0000',documentRateExact8:'40.00000000',accountRateExact8:'40.00000000',privateNested:{profit:'hidden'}};
 const result=JSON.parse(JSON.stringify(project(quote,{fx:true})));
 assert.deepEqual(Object.keys(result).sort(),['accountAmountExact4','accountCurrency','accountId','accountRateExact8','amountTryExact4','belowCostWarning','currency','discountRateExact4','discountTotalExact4','documentRateExact8','lines','maxDiscountRateExact4','subtotalExact4','totalExact4','writeSupported'].sort());
 assert.deepEqual(Object.keys(result.lines[0]).sort(),['lineTotalExact4','productId','quantityExact3','unitPriceExact4']);assert.equal(result.totalExact4,'1.5000');assert.equal(result.belowCostWarning,false);assert(!JSON.stringify(result).includes('hidden'));assert(!JSON.stringify(result).includes('unitCostTryExact4'));assert(!JSON.stringify(result).includes('grossProfitTryExact4'));assert.equal(line.unitCostTryExact4,'8.0000');
 assert.throws(()=>project({...quote,lines:[{...line,unitPriceExact4:{cost:'hidden'}},line]},{fx:true}),/DESKTOP_WORKFLOW_DRAFT_REJECTED/);
 assert.throws(()=>project({...quote,accountAmountExact4:{profit:'hidden'}},{fx:true}),/DESKTOP_WORKFLOW_DRAFT_REJECTED/);
});
