import {businessInboundFixture} from './businessInbound.test-fixture.mjs';
import {isolatedCopyHash,validateIsolatedOperationCopyContext} from './isolatedOperationCopyContext.mjs';
export function businessProductPriceFixture(mutateRaw=()=>{}){
 const input=structuredClone(businessInboundFixture().copy);
 input.products=[{...input.products[0],id:'444',stockCode:'OFFLINE-444',sourceKey:['VEGA2026','F0102TBLSTOKLAR','444'].join('/'),unit:'ADET',unitFactorExact8:'1.00000000',identityVerified:true,sourceKnown:true,quarantined:false,priceIds:['100'],quotes:[{quoteId:'100',currency:'TRY',priceExact8:'3.00000000',type:'sale',mainUnit:true,verified:true,nativeRowHash:'F'.repeat(64),bindingHash:'E'.repeat(64),unitSourceId:null}]}];
 mutateRaw(input);const {sealHash,...sealed}=input;input.sealHash=isolatedCopyHash(sealed);const copy=validateIsolatedOperationCopyContext(input),p=copy.products[0],q=p.quotes[0];
 const tuple={type:'sale',unitId:q.unitSourceId===null?null:String(q.unitSourceId),tier:0,currency:q.currency},revision='A'.repeat(64),requestId='4c758081-465d-445f-b024-aad40355f9d0';
 const raw={schemaVersion:'melisa-business-product-prices.v1',productId:p.id,copyId:copy.copyId,sealHash:copy.sealHash,operationOrigin:copy.operationOrigin,revision,canEdit:true,prices:[{priceId:q.quoteId,tuple,priceExact:q.priceExact8,currentVersionId:null,source:{quoteId:q.quoteId,priceExact8:q.priceExact8,nativeRowHash:q.nativeRowHash.toUpperCase(),bindingHash:q.bindingHash.toUpperCase(),sourceKey:p.sourceKey,sourceUnitId:tuple.unitId,versionRunId:copy.currentProductSourceVersionRunId}}],recentChanges:[]};
 const permissions=['product.view','purchase.view','product.price.edit'],actor={id:'16',permissions},actual={id:'16',role:copy.actors.find(a=>a.id==='16').role,active:true,permissions:[...permissions]};
 const body={requestId,expectedRevision:revision,priceId:q.quoteId,tuple:{...tuple},priceExact:'1.23456789',reason:'Yeni satış fiyatı'};
 return {copy,actor,actual,raw,body};
}
