import test from 'node:test';import assert from 'node:assert/strict';
import {desktopOpeningReason,isDesktopProductOpening} from '../../../../packages/shared/src/desktopProductOpening.mjs';
const opening=()=>({kind:'desktop-product-opening-v1',productId:'6',movementId:'11',actorId:'7',requestId:'6508625b-b648-421b-b7b9-35d4be7c7263',reason:'Açılış sayımı',quantityExact3:'2.000',costExact4:'8.0000',amountTryExact4:'16.0000',documentDate:'2026-11-06',currency:'TRY'});
test('opening detail requires a real date, positive stock, exact identity and bounded plain reason',()=>{
 assert.equal(isDesktopProductOpening(opening(),'6'),true);for(const reason of ['',null,' x','x\n','x'.repeat(251)])assert.throws(()=>desktopOpeningReason(reason));
 for(const change of [{productId:'7'},{movementId:'0'},{actorId:'07'},{requestId:'not-a-uuid'},{quantityExact3:'0.000'},{costExact4:'0.0000'},{documentDate:'2026-02-30'},{documentDate:'1899-01-01'},{currency:'USD'},{reason:'x\n'},{extra:true}])assert.equal(isDesktopProductOpening({...opening(),...change},'6'),false);
 const getter=opening();Object.defineProperty(getter,'reason',{enumerable:true,get(){throw Error('must not evaluate');}});assert.equal(isDesktopProductOpening(getter,'6'),false);
});
