import {createHash} from 'node:crypto';
import {validateCurrentProductCatalogContext} from './currentProductCatalogContext.mjs';
import {crmV2Error} from './crmOrderV2Contract.mjs';

export const CRM_SHARED_DATABASE='MELISA_ERP_CRM_SHARED_TEST_20261009_01';
export const CRM_SHARED_SERVER='Semih\\MELISADEV';
export const CRM_SHARED_SOURCE_DATABASE='MELISA_ERP_SIRKET_TEST_20260929_01';
export const CRM_CURRENT_PROCEDURES=Object.freeze({customers:'dbo.usp_shared_crm_order_customers',create:'dbo.usp_shared_crm_order_create',read:'dbo.usp_shared_crm_order_read'});
const registered=new WeakSet();
let configured;
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);
const fail=()=>{throw crmV2Error('CRM_V2_TARGET_UNAVAILABLE',503);};
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};

// Only the bootstrap may install this finite copy context. Request JSON and
// environment variables cannot grant current-source writes in another database.
export function validateCrmOrderCurrentContext(input){
 if(input?.schemaVersion!=='melisa-crm-shared-test-context.v1'||input.actualT1!==false||input.sourceDatabase!==CRM_SHARED_SOURCE_DATABASE||!hash(input.backupSHA)||!hash(input.quarantineGuardHash)||!/^\b[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.copyId??''))fail();
 const t=input.target;
 if(t?.server!==CRM_SHARED_SERVER||t.database!==CRM_SHARED_DATABASE||t.login!=='melisa_crm_shared_draft_20261009_01'||t.databaseUser!==t.login)fail();
 if(input.crmOrigin!=='http://127.0.0.1:62501'||input.nativePort!==62504||input.apiPort!==4174||input.externalOperations!==false||input.stockEffect!==false||input.ledgerEffect!==false||input.reservationEffect!==false)fail();
 let catalog;try{catalog=validateCurrentProductCatalogContext(input.catalog);}catch{fail();}
 const result=freeze({...structuredClone(input),catalog:structuredClone(catalog)});registered.add(result);return result;
}
export function assertCrmOrderCurrentContext(context){if(!registered.has(context))fail();return context;}
export function assertCrmOrderCurrentIdentity(context,identity){
 assertCrmOrderCurrentContext(context);const t=context.target;
 if(identity?.databaseName!==t.database||identity.serverName!==t.server||identity.loginName!==t.login||identity.databaseUser!==t.databaseUser||identity.sysadmin!==0||identity.databaseControl!==0||identity.originalDatabaseAccess!==0||identity.liveDatabaseAccess!==0)fail();
 return identity;
}
export function configureCrmOrderCurrentContext(input,identity){
 if(configured)fail();const context=validateCrmOrderCurrentContext(input);assertCrmOrderCurrentIdentity(context,identity);configured=context;return context;
}
export const getCrmOrderCurrentContext=()=>configured??null;
export function crmOrderCurrentSource(context){
 const c=assertCrmOrderCurrentContext(context).catalog;
 return freeze({runId:c.runId,sourceAsOf:c.sourceAsOf,sourceHash:c.sourceHash,planHash:c.planHash,bindingsHash:c.bindingsHash,snapshotHash:c.snapshotHash,counts:{products:c.productCount,prices:c.priceCount},actualT1:false});
}
export const crmOrderCurrentSourceHash=context=>createHash('sha256').update(JSON.stringify(crmOrderCurrentSource(context)),'utf16le').digest('hex').toUpperCase();
