import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openTrainingStore} from '../../../training-server/store.mjs';
import {receivingContext,purchaseContext,inboundMeta,supplierContext} from './workInboundModel.mjs';
import {catalogEnvelope} from './workCatalogModel.mjs';
import {workOperationLabels} from './workCopyPresentation.mjs';

test('training store speaks the actual ERP screen contract with separate provenance and no finance leak',()=>{
 const dir=mkdtempSync(join(tmpdir(),'melisa-training-contract-'));
 const seed={source:'approved-card-copy',supplier:{id:'1',code:'TRAINING',name:'Örnek tedarikçi'},products:['1','2'].map(id=>({id,stockCode:'ÖRNEK-'+id,name:'Örnek ürün '+id,barcode:null,purchasePriceExact8:'100.00000000',baselineQuantity:'10.000',expectedQuantity:'2.000'}))};
 const store=openTrainingStore({dataDir:dir,seed});
 try{
  const s=store.bootstrap();
  const receiving=receivingContext(store.read('/api/work-receiving/context',s));
  assert.equal(receiving.meta.source,'training');assert.equal(receiving.scope.synthetic,true);
  purchaseContext(store.read('/api/work-purchases/context',s));
  supplierContext(store.read('/api/work-suppliers/context',s));
  const catalog=catalogEnvelope(store.read('/api/catalog/products',s));
  assert.equal(catalog.data.length,2);assert.equal(catalog.meta.scopeCounts.syntheticTest,2);
  assert.match(workOperationLabels(receiving.meta).sampleBadge,/Eğitim/);
  assert.throws(()=>inboundMeta({...receiving.meta,trainingDatabase:false}));
  assert.throws(()=>catalogEnvelope({...catalog,meta:{...catalog.meta,trainingDatabase:false}}));
  assert.throws(()=>catalogEnvelope({...catalog,meta:{...catalog.meta,schemaVersion:'melisa-catalog.v1'}}));
  assert.throws(()=>catalogEnvelope({...catalog,data:catalog.data.map(r=>({...r,salePrices:[{priceExact:'10.00000000'}]}))}));
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
