// Synthetic interface replies only. No native execution, login or role grant.
import {selectedSaleFixture} from './businessSelectedSalePreview.test.mjs';
import {CUSTOMER_CONTACT_CONTEXT_SCHEMA,CUSTOMER_CONTACT_CONTEXT,CUSTOMER_CONTACT_UPDATE,CUSTOMER_CONTACT_PROOF} from '../../../../scripts/canonical/shared-business-customer-contact-contract.mjs';
export function contactFixture(){
 const copy=selectedSaleFixture(raw=>{for(const row of raw.customers.filter(row=>row.id==='100')){row.code='OFFLINE-100';row.name='Synthetic customer';}}).c;
 const links=copy.customers.filter(row=>row.id==='100'),actor={id:17,role:{id:2,code:'admin'},permissions:['customer.view','customer.edit']};
 const pin={id:'17',nativeRoleId:'2',nativeRoleCode:'admin',permissionsRowsHash:'F'.repeat(64)},nativeActor={...pin,permissions:[...actor.permissions],active:true};
 const context={schemaVersion:CUSTOMER_CONTACT_CONTEXT_SCHEMA,copyId:copy.copyId,sealHash:copy.sealHash,customerId:'100',customerCode:'OFFLINE-100',customerName:'Synthetic customer',partyEntityId:links[0].partyId,sourceKey:links[0].sourceKey,sourceCompany:'F0102',sourceId:links[0].sourceKey.split('/').at(-1),accounts:links.map(row=>({accountId:row.accountId,currency:row.currency,partyEntityId:row.partyId,sourceKey:row.sourceKey})),contact:{phone:'001000000',city:'İstanbul',country:'Türkiye'},revision:'C'.repeat(64)};
 const body={requestId:'12345678-1234-4234-8234-123456789012',expectedRevision:context.revision,phone:'001610000',city:'Ankara',country:null};
 const registered={actor:pin,revision:{modules:[CUSTOMER_CONTACT_CONTEXT,CUSTOMER_CONTACT_UPDATE,CUSTOMER_CONTACT_PROOF].map(name=>({name,afterHash:'A'.repeat(64)}))}};
 return {copy,actor,nativeActor,context,body,registered,synthetic:true,nativeExecution:false};
}
