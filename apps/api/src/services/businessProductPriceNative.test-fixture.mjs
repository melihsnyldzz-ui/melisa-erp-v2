// Entirely modeled SQL responses, earned through the unchanged production
// registration functions. No pool, network, SQL execution or activation.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {capturedFixture,stockPredicateProofFixture} from '../../../../scripts/canonical/shared-business-selected-sale-revision-bootstrap.test-fixture.mjs';
import {compileCapturedBusinessSelectedSaleRevision} from '../../../../scripts/canonical/shared-business-selected-sale-revision-capture.mjs';
import {buildStockPredicateDistinctRevision} from '../../../../scripts/canonical/shared-business-stock-predicate-distinct-revision-sql.mjs';
import {configureBusinessSelectedSaleRevision,getRegisteredBusinessSelectedSaleRevision} from '../../../../scripts/canonical/shared-business-selected-sale-revision-bootstrap.mjs';
import {buildBusinessProductPriceRevision} from '../../../../scripts/canonical/shared-business-product-price-revision-sql.mjs';
import {BUSINESS_PRODUCT_PRICE_METADATA_SQL,configureBusinessProductPriceRevision} from '../../../../scripts/canonical/shared-business-product-price-bootstrap.mjs';
import {BUSINESS_PRICE_COPY_ID,BUSINESS_PRICE_TABLES,BUSINESS_PRICE_IMMUTABLE,BUSINESS_PRICE_PROOF} from '../../../../scripts/canonical/shared-business-product-price-revision-contract.mjs';
import {buildBusinessProductPriceSaleRevision,BUSINESS_PRICE_SALE_LINK_GUARD,BUSINESS_PRICE_SALE_REGISTRY} from '../../../../scripts/canonical/shared-business-product-price-sale-sql.mjs';
import {BUSINESS_PRODUCT_PRICE_SALE_METADATA_SQL,configureBusinessProductPriceSaleRevision} from '../../../../scripts/canonical/shared-business-product-price-sale-bootstrap.mjs';
import {validateIsolatedOperationCopyContext} from './isolatedOperationCopyContext.mjs';
import {selectBusinessSaleWriteIntent} from './businessSelectedSaleWriteIntent.mjs';
import {SELECTED_SALE_CONTEXT_METADATA_SQL,readBusinessSelectedSaleNativeContext} from './businessSelectedSaleNativeContext.mjs';
import {withIsolatedOperationCopyScope} from './isolatedOperationCopyScope.mjs';
import {withBusinessSelectedSaleWriteScope,SELECTED_SALE_WRITE_METADATA_SQL} from './businessSelectedSaleWriteScope.mjs';
import {isolatedCopyHash,isolatedCopyJSON} from './isolatedOperationCopyContext.mjs';
import {BUSINESS_PRICE_TRANSACTION_SQL,createBusinessProductPriceStore} from './businessProductPriceStore.mjs';
import {BUSINESS_PRICE_GET,BUSINESS_PRICE_SET} from '../../../../scripts/canonical/shared-business-product-price-revision-contract.mjs';

export function privateBusinessPriceLeafSources(path,sha256){
 const bytes=fs.readFileSync(path);
 if(createHash('sha256').update(bytes).digest('hex')!==sha256)throw Error('SYNTHETIC_PRIVATE_LEAF_INPUT_PIN');
 const input=JSON.parse(bytes);
 return Object.fromEntries(['supplierItemQuarantineSource','operationQuarantineSource','stockPredicateSource'].map(k=>{if(!input[k])throw Error('SYNTHETIC_PRIVATE_LEAF_MISSING');return[k,input[k]];}));
}
function nativeType(type){
 const [name,args]=type.split(/[()]/),parts=args?.split(',');
 if(name==='decimal')return {typeName:name,maxLength:13,precision:Number(parts[0]),scale:Number(parts[1])};
 if(name==='datetime2')return {typeName:name,maxLength:8,precision:27,scale:Number(args)};
 if(['nvarchar','varchar','char'].includes(name))return {typeName:name,maxLength:args==='max'?-1:Number(args)*(name==='nvarchar'?2:1),precision:0,scale:0};
 return {typeName:name,maxLength:name==='bigint'?8:name==='int'?4:16,precision:name==='bigint'?19:name==='int'?10:0,scale:0};
}
function metadataProof(copy,bundle){
 const recordsets=[[],[],[],[],[],[]];
 for(const name of [...bundle.objects.map(o=>o.name),...BUSINESS_PRICE_TABLES]){
  const module=bundle.objects.find(o=>o.name===name),afterHash=module?.afterHash??'C'.repeat(64);
  recordsets[0].push({copyId:copy.copyId,name,kind:module?'MODULE':'SCHEMA',revision:12,baseSealHash:copy.sealHash,baseRevisionHash:bundle.baseRevisionHash,profileHash:bundle.profileHash,afterHash,revisionHash:bundle.revision.revisionHash,actualHash:afterHash,immutableTriggerHash:bundle.revision.immutableTriggerHash,triggerDisabled:0});
 }
 for(const s of bundle.schemaDescriptors){
  s.columns.forEach((c,i)=>recordsets[1].push({tableName:s.name,ordinal:i+1,columnName:c.name,...nativeType(c.type),nullable:c.nullable,identityColumn:c.identity,defaultDefinition:c.defaultDefinition===null?null:`(${c.defaultDefinition})`}));
  s.keys.forEach((k,i)=>recordsets[2].push({tableName:s.name,indexId:i+1,isUnique:true,isPrimary:k.primary,uniqueConstraint:!k.primary,disabled:false,indexType:i===0?1:2,hasFilter:false,filterDefinition:null,columnsJson:JSON.stringify(k.columns.map((columnName,j)=>({columnName,keyOrdinal:j+1,descendingKey:false,included:false})))}));
  s.foreignKeys.forEach((f,i)=>recordsets[3].push({tableName:s.name,foreignKeyId:i+1,referencedTable:f.table,disabled:false,notTrusted:false,onDelete:0,onUpdate:0,columnsJson:JSON.stringify(f.columns.map((columnName,j)=>({columnName,referencedColumn:f.referencedColumns[j]})))}));
  s.checks.forEach(definition=>recordsets[4].push({tableName:s.name,definition:`(${definition})`,disabled:false,notTrusted:false}));
  recordsets[5].push({tableName:s.name,triggerName:s.trigger,disabled:false,insteadOfTrigger:false,eventsJson:JSON.stringify(['DELETE','INSERT','UPDATE'].map(eventName=>({eventName}))),definitionHash:s.trigger===BUSINESS_PRICE_IMMUTABLE?bundle.revision.immutableTriggerHash:bundle.objects.find(o=>o.name===s.trigger).afterHash});
 }
 return {recordsets};
}
export async function earnedBusinessProductPriceNativeFixture(leafSources){
 const input=await capturedFixture(1,raw=>{raw.copyId=BUSINESS_PRICE_COPY_ID;},{stockPredicateCompatible:true});
 const compiled=await compileCapturedBusinessSelectedSaleRevision(input),args={copy:compiled.copy,daily:input.daily,profit:input.profit,schema:input.schema,...leafSources};
 const stockBundle=buildStockPredicateDistinctRevision(args),copy=validateIsolatedOperationCopyContext(input.context);
 const state={base:input.base,performance:input.performance,effects:input.effects,daily:input.daily,profit:input.profit,nativeCheck:input.nativeCheck??null,schema:input.schema,selectedRevision:stockBundle.baseSelectedRevision,selectedEffectsRevision:stockBundle.baseEffectsRevision,selectedParentRevision:stockBundle.baseParentRevision,supplierItemQuarantineRevision:stockBundle.baseSupplierItemQuarantineRevision,operationQuarantineRevision:stockBundle.baseOperationQuarantineRevision,stockPredicateRevision:stockBundle.revision,...leafSources};
 const native=stockPredicateProofFixture({copy,input,state,bundle:stockBundle});
 const frame={db:copy.target.database,server:copy.target.server,login:copy.target.login,databaseUser:copy.target.databaseUser,sysadmin:0,control:0,live:0,originalDatabaseAccess:0,sessionId:91,transactionId:'1001',transactionCount:1,transactionState:1,isolationLevel:4,copyLockMode:'Shared'};
 let priceBundle,saleBundle;
 const calls=[];
 const query=async text=>{
  calls.push(text);
  if(native.results.has(text)){
   const result=structuredClone(native.results.get(text));
   for(const set of result.recordsets)for(const row of set)if(Object.hasOwn(row,'copyLockMode'))Object.assign(row,{copyLockMode:frame.copyLockMode,sessionId:frame.sessionId,transactionId:frame.transactionId});
   return result;
  }
  if(text===BUSINESS_PRODUCT_PRICE_METADATA_SQL)return {recordset:[{...frame,privateAccessRows:4,getterExecute:1,setterExecute:1,proofExecute:1,proofDefinitionHash:priceBundle.objects.find(o=>o.name===BUSINESS_PRICE_PROOF).afterHash}]};
  if(text===priceBundle?.proofSQL)return metadataProof(copy,priceBundle);
  if(text===BUSINESS_PRODUCT_PRICE_SALE_METADATA_SQL)return {recordset:[{...frame,privateAccess:0,contextExecute:1,beginExecute:1,intentExecute:1,historyExecute:1,assertExecute:1,proofExecute:1,proofViewDefinition:1,proofDefinitionHash:saleBundle.proofArtifact.definitionHash}]};
  if(text===saleBundle?.proofSQL)return {recordsets:[saleBundle.objects.map((o,i)=>({copyId:copy.copyId,name:o.name,revision:13,baseSealHash:copy.sealHash,basePriceRevisionHash:saleBundle.revision.basePriceRevisionHash,baseSelectedRevisionHash:saleBundle.revision.baseSelectedRevisionHash,profileHash:saleBundle.revision.profileHash,afterHash:o.afterHash,revisionHash:saleBundle.revision.revisionHash,actualHash:o.afterHash,immutableTriggerHash:saleBundle.revision.immutableTriggerHash,triggerDisabled:0,objectId:900+i,objectType:o.name===BUSINESS_PRICE_SALE_LINK_GUARD?'TR':'P',parentName:o.name===BUSINESS_PRICE_SALE_LINK_GUARD?'dbo.work_sales_links':null,moduleDisabled:false,insteadOfTrigger:false,sessionId:frame.sessionId,transactionId:frame.transactionId,immutableParentName:BUSINESS_PRICE_SALE_REGISTRY,registrySchemaValid:true,immutableTriggerObjectId:999,immutableTriggerType:'TR',immutableInsteadOfTrigger:false,immutableEventCount:3}))]};
  throw Error('SYNTHETIC_PRICE_QUERY_NOT_MODELED');
 };
 const request={query};
 const selected=await configureBusinessSelectedSaleRevision({copy,request,...state});
 priceBundle=buildBusinessProductPriceRevision({copyContext:copy,baseRevision:selected.stockPredicateRevision});
 const metadata=await configureBusinessProductPriceRevision(copy,priceBundle.revision,request);
 const metadataCanEditBeforeConsumer=metadata.canEdit;
 const selectedBaseInput={daily:state.daily,profit:state.profit,schema:state.schema};
 saleBundle=buildBusinessProductPriceSaleRevision({copyContext:copy,priceBundle:metadata.bundle,selectedBundle:getRegisteredBusinessSelectedSaleRevision(copy).bundle,selectedBaseInput});
 const consumer=await configureBusinessProductPriceSaleRevision(copy,saleBundle.revision,request,{selectedBaseInput});
 return {synthetic:true,nativeExecution:false,copy,selected,metadata,consumer,frame,state,query,calls,metadataCanEditBeforeConsumer};
}

export function modeledBusinessPriceSaleRead(f,{currency='TRY',priceExact8='4.25000000',mode='CURRENT',invoiceId=mode==='CURRENT'?null:'500',mutate=()=>{}}={}){
 const {copy,consumer,selected,frame}=f,transaction={},artifact=mode==='HISTORY'?consumer.bundle.historyArtifact:consumer.bundle.contextArtifact;
 const customer=copy.customers.find(c=>c.id==='100'&&c.currency===currency),source=copy.products[0],quote=source.quotes.find(q=>q.currency===currency);
 const selection=selectBusinessSaleWriteIntent(copy,{customerId:customer.id,currency,productIds:[source.id]}),actor={id:'15',permissions:['sales.view','sales.create','sales.finalize','sales.cancel']};
 const actual={id:actor.id,role:copy.actors.find(a=>a.id===actor.id).role,active:true,permissions:[...actor.permissions]};
 const pricing={origin:'MANUAL',versionId:'9',sourcePriceExact8:quote.priceExact8,nativeRowHash:quote.nativeRowHash.toUpperCase(),bindingHash:quote.bindingHash.toUpperCase(),priceExact8,versionProofHash:'9'.repeat(64)};
 const pricingJson=JSON.stringify([{productId:source.id,quoteId:quote.quoteId,currency,pricing}]),pricingHash=createHash('sha256').update(pricingJson,'utf16le').digest('hex').toUpperCase();
 const origin={synthetic:false,operationOrigin:copy.operationOrigin},rate=copy.currencyRates.find(r=>r.currency===currency);
 const dto={meta:{schemaVersion:'melisa-selected-sale-context.v1',date:copy.date,copyId:copy.copyId,sealHash:copy.sealHash,operationOrigin:copy.operationOrigin,readOnly:true},revision:'a'.repeat(64),writable:false,rate,policy:{basis:'SOURCE_BUSINESS_INVOICE_DOCUMENT_AMOUNT_PREVIEW_ONLY',currency,maxItems:200,maxInvoiceAmountExact4:copy.businessInvoiceMaxExact4,quantity:'POSITIVE_WHOLE_MAIN_UNIT'},limits:{maxItems:200,maxInvoiceAmountExact4:copy.businessInvoiceMaxExact4},scope:{...origin,customer:{...origin,...customer,writeEligible:true,balanceExact4:'10.0000',balanceExact8:'10.00000000'},products:[{...origin,id:source.id,stockCode:source.stockCode,sourceKey:source.sourceKey,sourceWitnessHash:source.sourceWitnessHash,costExact4:source.costExact4,name:source.name??'OFFLINE_NATIVE_PRICE_PRODUCT',stockQuantityExact3:'10.000',barcode:source.barcodes[0],writeEligible:true,unit:{label:'ADET',factorExact8:'1.00000000'},prices:[{quoteId:quote.quoteId,currency,unitPriceExact8:priceExact8,pricing,source:{kind:'isolated-test-copy',copyId:copy.copyId,sealHash:copy.sealHash}}]}],accounts:[]},pricingProof:{schemaVersion:'melisa-business-product-price-sale-proof.v1',copyId:copy.copyId,sealHash:copy.sealHash,profileHash:artifact.profileHash,priceRevisionHash:artifact.priceRevisionHash,saleRevisionHash:artifact.saleRevisionHash,readerDefinitionHash:artifact.definitionHash,mode,invoiceId,pricingHash}};
 const proof={copyId:copy.copyId,sealHash:copy.sealHash,backupSHA:copy.backupSHA,valid:true,definitionHashes:{...selected.parentHashes}};
 const row={sessionId:frame.sessionId,transactionId:frame.transactionId,readerDefinitionHash:artifact.definitionHash,proof_json:JSON.stringify(proof),actor_json:JSON.stringify(actual),context_json:JSON.stringify(dto),pricing_json:pricingJson};
 const metaSQL=SELECTED_SALE_CONTEXT_METADATA_SQL.replace(`N'${selected.bundle.contextArtifact.name}'`,`N'${artifact.name}'`),calls=[];
 const request=()=>({parent:transaction,input(){return this;},async query(text){calls.push(text);if(text===metaSQL){const value={...frame,readerDefinitionHash:artifact.definitionHash};mutate('metadata',value);return {recordset:[value]};}return f.query(text);},async execute(name){calls.push(name);if(name!==artifact.name)throw Error('SYNTHETIC_PRICE_READ_PROC');const value=structuredClone(row);mutate('row',value);return {recordset:[value]};}});
 const sql={UniqueIdentifier:'uuid',BigInt:'bigint',NVarChar:()=>{},MAX:'max'},options={copy,transaction,sql,request,artifact:selected.bundle.contextArtifact,actor,selection,priceConsumer:consumer,invoiceId};
 const run=fn=>withIsolatedOperationCopyScope({context:copy,identity:frame,transaction,readProof:proof,write:false},async()=>{const current=await readBusinessSelectedSaleNativeContext(options);return fn?fn(current):current;});
 return {options,copy,transaction,actor,actual,selection,proof,row,dto,calls,run};
}

export function modeledBusinessPriceSaleWrite(f,{operation='sale_draft',invoiceId=operation==='sale_draft'?null:'500',priceExact8='4.25000000',mutate=()=>{}}={}){
 f.frame.copyLockMode='Exclusive';
 const h=modeledBusinessPriceSaleRead(f,{mode:operation==='sale_draft'?'CURRENT':'HISTORY',invoiceId,priceExact8}),{copy,consumer}=f,artifact=consumer.bundle.writeScopeArtifact,requestId='12345678-1234-4234-8234-123456789012';
 const payload={copyId:copy.copyId,sealHash:copy.sealHash,operationOrigin:copy.operationOrigin,actorId:h.actor.id,operation,requestId,expectedRevision:'a'.repeat(64),businessCustomerId:h.selection.customerId,businessAccountId:h.selection.customerAccountId,businessCurrency:h.selection.currency,businessProductIds:h.selection.productIds,sourceSelectionHash:h.selection.sourceSelectionHash,businessSelectedSalePolicyHash:h.selection.policyHash,...(invoiceId?{id:invoiceId}:{})};
 const intent={schemaVersion:'melisa-selected-sale-native-intent.v1',profileHash:artifact.profileHash,copyId:copy.copyId,sealHash:copy.sealHash,actorId:h.actor.id,operation,requestId,payloadHash:isolatedCopyHash(payload),customerId:h.selection.customerId,customerAccountId:h.selection.customerAccountId,partyId:h.selection.partyId,currency:h.selection.currency,productIds:h.selection.productIds,policyHash:h.selection.policyHash,sourceSelectionHash:h.selection.sourceSelectionHash,rateExact8:h.selection.rateExact8,maxInvoiceAmountExact4:h.selection.maxInvoiceAmountExact4,invoiceId,selectedRevision:h.dto.revision,...(invoiceId?{invoiceRevision:payload.expectedRevision}:{})};
 h.dto.pricingProof.readerDefinitionHash=consumer.bundle.contextArtifact.definitionHash;
 const row={...h.row,readerDefinitionHash:artifact.definitionHash,context_json:JSON.stringify(h.dto),intent_json:JSON.stringify(intent),payload_json:isolatedCopyJSON(payload),payloadHash:isolatedCopyHash(payload)};
 const metaSQL=SELECTED_SALE_WRITE_METADATA_SQL.replace(`N'${f.selected.bundle.writeScopeArtifact.name}'`,`N'${artifact.name}'`),calls=[];
 const request=()=>({parent:h.transaction,input(){return this;},async query(text){calls.push(text);if(text===metaSQL){const m={...f.frame,readerDefinitionHash:artifact.definitionHash};mutate('metadata',m);return {recordset:[m]};}return f.query(text);},async execute(name){if(name!==artifact.name)throw Error('SYNTHETIC_PRICE_INTENT_PROC');calls.push(name);const r=structuredClone(row);mutate('row',r);return {recordset:[r]};}});
 const options={...h.options,artifact:f.selected.bundle.writeScopeArtifact,request,operation,requestId,priceConsumer:consumer};
 const run=fn=>withIsolatedOperationCopyScope({context:copy,identity:f.frame,transaction:h.transaction,readProof:h.proof,write:true},()=>withBusinessSelectedSaleWriteScope(options,fn));
 return {...h,options,row,payload,intent,calls,run};
}

export function modeledBusinessProductPriceStore(f,{mutate=()=>{}}={}){
 const {copy,frame}=f,p=copy.products[0],permissions=['product.view','purchase.view','product.price.edit'],actor={id:'16',permissions};
 let context={schemaVersion:'melisa-business-product-prices.v1',productId:p.id,copyId:copy.copyId,sealHash:copy.sealHash,operationOrigin:copy.operationOrigin,revision:'A'.repeat(64),canEdit:true,prices:p.quotes.filter(q=>q.type==='sale'&&q.mainUnit&&q.verified).map(q=>({priceId:q.quoteId,tuple:{type:'sale',unitId:q.unitSourceId===null?null:String(q.unitSourceId),tier:0,currency:q.currency},priceExact:q.priceExact8,currentVersionId:null,source:{quoteId:q.quoteId,priceExact8:q.priceExact8,nativeRowHash:q.nativeRowHash.toUpperCase(),bindingHash:q.bindingHash.toUpperCase(),sourceKey:p.sourceKey,sourceUnitId:q.unitSourceId===null?null:String(q.unitSourceId),versionRunId:copy.currentProductSourceVersionRunId}})),recentChanges:[]};
 const events=[],journal=new Map();
 class Transaction{async begin(level){frame.transactionCount=1;frame.transactionState=1;frame.isolationLevel=level;events.push('begin');}async commit(){events.push('commit');}async rollback(){events.push('rollback');}}
 class Request{
  constructor(parent){this.parent=parent;this.params={};}input(k,t,v){this.params[k]=v;return this;}
  async query(text){
   if(text.includes('sys.sp_getapplock')){frame.copyLockMode=text.includes("N'Exclusive'")?'Exclusive':'Shared';events.push('lock:'+frame.copyLockMode);return {recordset:[]};}
   const result=text===BUSINESS_PRICE_TRANSACTION_SQL?{recordset:[structuredClone(frame)]}:await f.query(text);
   mutate('query',result,text);return result;
  }
  async execute(name){
   events.push(name);let replayed=false,current=context;
   if(name===BUSINESS_PRICE_SET){
    const payloadJson=this.params.payload_json,input=JSON.parse(payloadJson),prior=journal.get(input.requestId);
    if(prior){if(prior.payloadJson!==payloadJson)throw Object.assign(Error('SYNTHETIC_CONFLICT'),{number:51906});replayed=true;current=prior.context;}
    else{
     if(input.expectedRevision!==context.revision)throw Object.assign(Error('SYNTHETIC_STALE'),{number:51905});
     current=structuredClone(context);const row=current.prices.find(r=>r.priceId===input.priceId),before=row.priceExact;row.currentVersionId=String(journal.size+1);row.priceExact=input.priceExact;current.revision=(journal.size?'C':'B').repeat(64);
     current.recentChanges.unshift({versionId:row.currentVersionId,requestId:input.requestId,actorId:'16',priceId:row.priceId,tuple:{...row.tuple},beforePriceExact:before,priceExact:row.priceExact,reason:input.reason,createdAt:'2026-10-13T10:00:00.000Z'});
     journal.set(input.requestId,{payloadJson,context:structuredClone(current)});context=current;
    }
   }else if(name!==BUSINESS_PRICE_GET)throw Error('SYNTHETIC_PRICE_STORE_PROC');
   const row={context_json:JSON.stringify(current),actor_json:JSON.stringify({id:'16',role:copy.actors.find(a=>a.id==='16').role,active:true,permissions}),replayed,sessionId:frame.sessionId,transactionId:frame.transactionId,readerDefinitionHash:f.metadata.revision.modules.find(m=>m.name===name).afterHash};
   mutate('row',row,name);return {recordsets:[[row]],recordset:[row]};
  }
 }
 const sql={Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:4},UniqueIdentifier:'uuid',BigInt:'bigint',NVarChar:()=>{},MAX:'max'};
 const store=createBusinessProductPriceStore({getRuntime:async()=>({copyContext:copy,pool:{},sql})});
 return {store,actor,events,journal,getContext:()=>structuredClone(context)};
}
