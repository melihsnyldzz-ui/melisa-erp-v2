import {fixtureContext,fixtureIdentity,fixtureProof} from './isolatedOperationCopyContext.test.mjs';
import {isolatedCopyHash,validateIsolatedOperationCopyContext,bindIsolatedCopyOperationDTO} from './isolatedOperationCopyContext.mjs';
export function businessInboundFixture(){
 const raw=fixtureContext();raw.target={...raw.target,database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',login:'melisa_shared_test_rw_20261009_02',databaseUser:'melisa_shared_test_rw_20261009_02'};
 Object.assign(raw,{date:'2026-10-09',scopeKind:'VERIFIED_BUSINESS_TEST',businessScopeHash:'d'.repeat(64),businessInvoiceMaxExact4:'20000.0000',externalOperations:false,humanAccepted:false,currencyRates:[{currency:'TRY',rateExact8:'1.00000000',source:'identity',date:'2026-09-12',id:'1'},{currency:'USD',rateExact8:'47.80000000',source:'dated-fixture',date:'2026-09-12',id:'2'}]});
 for(const group of [raw.customers,raw.suppliers])for(const a of group){a.sourceKnown=true;a.sourceWitnessHash='e'.repeat(64);}
 raw.products[0]={...raw.products[0],stockUnitCostTryExact8:'9.25000000',costExact4:'9.2500',purchasePriceExact8:'2.50000000',purchaseCurrency:'USD'};
 raw.suppliers.push({...raw.suppliers[0],accountId:'34',currency:'TRY'});
 const {sealHash,...body}=raw;raw.sealHash=isolatedCopyHash(body);const copy=validateIsolatedOperationCopyContext(raw),origin={synthetic:false,operationOrigin:copy.operationOrigin};
 const supplier={...origin,id:'30',accountId:'32',code:'FIXTURE-S',name:'Fixture supplier',currency:'USD',balanceExact4:'10.0000',writeEligible:true};
 const dto=bindIsolatedCopyOperationDTO(copy,{meta:{operationOrigin:copy.operationOrigin,copyId:copy.copyId,sealHash:copy.sealHash,date:copy.date},scope:{...origin,supplier,warehouse:{id:'1',label:'Fixture warehouse'},products:[{...copy.products[0],...origin,stockQuantityExact3:'1.000',name:'Fixture product',unit:{label:'ADET',factorExact8:'1.00000000'},writeEligible:true}]}});
 return {copy,dto,supplier,identity:fixtureIdentity(copy),proof:fixtureProof(copy)};
}
