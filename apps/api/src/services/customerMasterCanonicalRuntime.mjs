// Explicit bootstrap seam only. No config/credential reads, SQL at import,
// registration of a shared copy, or automatic activation of the real writer.
import {createHash} from 'node:crypto';
import {CUSTOMER_CARD_PROC,CUSTOMER_CARD_PROC_HASH,assembleCustomerCardRaw} from './customerCardReadStore.mjs';
import {catalogSourceVersion} from './catalogProductReadStore.mjs';
import {finalPartyContext,readFinalPartyProof,attachFinalPartyProof} from './finalPartyDeltaRead.mjs';
import {configuredCurrentFinanceContext,currentFinanceContext,readCurrentFinanceProof,attachCurrentFinanceProof} from './currentFinanceDeltaRead.mjs';
import {registeredSharedPartyContext} from './isolatedPartyCardReader.mjs';
import {customerMasterError} from './customerMasterModel.mjs';

export const CUSTOMER_MASTER_NORMAL_TARGET=Object.freeze({server:'Semih\\MELISADEV',database:'MELISA_ERP_SIRKET_TEST_20260929_01'});
export const CUSTOMER_MASTER_NORMAL_SCOPE='canonical-customer-master:Semih\\MELISADEV:MELISA_ERP_SIRKET_TEST_20260929_01';
export const CUSTOMER_MASTER_NORMAL_LOGIN='melisa_sirket_sales_test_20260929_01';
export const CUSTOMER_MASTER_NORMAL_GUARD='9AE41CA1AB25EE165019AD04DBD9A6FB4E5B7190F027E0A07A87FB03D698379E';
export const CUSTOMER_MASTER_NORMAL_ADMISSION=createHash('sha256').update(JSON.stringify({schema:'melisa-canonical-customer-master-admission.v1',target:CUSTOMER_MASTER_NORMAL_TARGET,scopeKey:CUSTOMER_MASTER_NORMAL_SCOPE,login:CUSTOMER_MASTER_NORMAL_LOGIN,reader:CUSTOMER_CARD_PROC_HASH,guard:CUSTOMER_MASTER_NORMAL_GUARD}),'utf16le').digest('hex').toUpperCase();
const runtimes=new WeakMap(),check=value=>{if(!value)throw customerMasterError();};
export function assertCanonicalCustomerMasterIdentity(i){
 check(i?.db===CUSTOMER_MASTER_NORMAL_TARGET.database&&i.server===CUSTOMER_MASTER_NORMAL_TARGET.server&&i.login===CUSTOMER_MASTER_NORMAL_LOGIN&&i.databaseUser===CUSTOMER_MASTER_NORMAL_LOGIN&&i.sysadmin===0&&i.control===0&&i.live===0);
}
// Called only by an already admitted normal ERP bootstrap. This is not a
// connection-string factory and never selects a different login or database.
export async function createCanonicalCustomerMasterRuntime({database,startup,getFinalContext=catalogSourceVersion,getCurrentFinanceContext=configuredCurrentFinanceContext}={}){
 const {identity,env,mode,port,writes}=startup??{};
 // Match configureCanonicalTest's fixed transport, then independently pin the
 // SQL-reported instance name below. Endpoint and SERVERPROPERTY are distinct.
 check(database?.isCanonicalTest?.()===true&&!database.isIsolatedOperationCopyRuntime?.()&&!registeredSharedPartyContext()&&mode==='erp'&&port===4144&&writes===true&&env?.port===4144&&env.sql?.readOnly===false&&env.sql?.trustedConnection===false&&env.sql.database===CUSTOMER_MASTER_NORMAL_TARGET.database&&env.sql.server==='127.0.0.1'&&env.sql.port===1433&&env.sql.user===CUSTOMER_MASTER_NORMAL_LOGIN);
 assertCanonicalCustomerMasterIdentity({db:identity?.databaseName,server:identity?.serverName,login:identity?.loginName,databaseUser:identity?.databaseUser,sysadmin:identity?.sysadmin,control:identity?.databaseControl,live:identity?.liveDatabaseAccess});
 check(typeof getFinalContext==='function'&&typeof getCurrentFinanceContext==='function');
 // Current-finance proof is mandatory on this normal target: an opening-only
 // DTO must not replace the approved later customer-account deltas.
 check(currentFinanceContext(getCurrentFinanceContext()));finalPartyContext(getFinalContext());
 const runtime=Object.freeze({pool:await database.getSqlPool(),sql:database.getSqlDriver()});check(runtime.pool&&runtime.sql);
 runtimes.set(runtime,{getFinalContext,getCurrentFinanceContext});return runtime;
}
export function canonicalCustomerMasterBoundary(runtime){
 const registered=runtimes.get(runtime);if(!registered)return null;
 check(!registeredSharedPartyContext());
 const final=structuredClone(registered.getFinalContext()??null),current=structuredClone(registered.getCurrentFinanceContext());
 finalPartyContext(final);check(currentFinanceContext(current));
 const fingerprint=JSON.stringify([final,current]);
 return Object.freeze({scopeKey:CUSTOMER_MASTER_NORMAL_SCOPE,admissionHash:CUSTOMER_MASTER_NORMAL_ADMISSION,target:CUSTOMER_MASTER_NORMAL_TARGET,recipe:{name:CUSTOMER_CARD_PROC,afterHash:CUSTOMER_CARD_PROC_HASH},
  assertCurrent(){check(fingerprint===JSON.stringify([registered.getFinalContext()??null,registered.getCurrentFinanceContext()]));},
  async assemble(rows,{sql,tx}){
   const ids=rows.flatMap(r=>r.nativeAccounts.map(a=>a.id));
   if(finalPartyContext(final))attachFinalPartyProof(rows,await readFinalPartyProof({sql,tx,ids,context:final}));
   attachCurrentFinanceProof(rows,await readCurrentFinanceProof({sql,tx,ids,context:current}));
   return rows.map(assembleCustomerCardRaw);
  }
 });
}
