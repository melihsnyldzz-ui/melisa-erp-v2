import {AsyncLocalStorage} from 'node:async_hooks';
import {assertIsolatedCopyContext,assertIsolatedCopyIdentity,assertIsolatedCopyReadProof,assertIsolatedCopyActor,bindIsolatedCopyOperationDTO,copyAssert,isolatedCopyHash,isolatedCopyJSON} from './isolatedOperationCopyContext.mjs';
import {isolatedCopyTransactionContext} from './isolatedOperationCopyScope.mjs';
import {workId} from './workSalesModel.mjs';
import {getRegisteredBusinessSelectedCollectionRevision,verifyBusinessSelectedCollectionRevision} from '../../../../scripts/canonical/shared-business-selected-collection-revision-bootstrap.mjs';

const scopes=new AsyncLocalStorage();
const rights={collection_create:'finance.collection',collection_cancel:'finance.collection.cancel'};
const parse=value=>{copyAssert(typeof value==='string','SELECTED_COLLECTION_INTENT_JSON');try{return JSON.parse(value);}catch{copyAssert(false,'SELECTED_COLLECTION_INTENT_JSON');}};
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);
export const selectedCollectionWriteMetadataSQL=name=>`SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess,
@@SPID sessionId,CURRENT_TRANSACTION_ID() transactionId,@@TRANCOUNT transactionCount,XACT_STATE() transactionState,(SELECT transaction_isolation_level FROM sys.dm_exec_sessions WHERE session_id=@@SPID) isolationLevel,APPLOCK_MODE(N'public',N'melisa-stage4-copy:'+LOWER(CONVERT(varchar(36),@copy_id)),N'Transaction') copyLockMode,
CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${name}',N'P'))),2) readerDefinitionHash;`;
function metadata(copy,artifact,row){
 assertIsolatedCopyIdentity(copy,row);
 copyAssert(row?.transactionCount===1&&row.transactionState===1&&row.isolationLevel===4&&row.copyLockMode==='Exclusive'&&Number.isSafeInteger(row.sessionId)&&row.sessionId>0&&/^[1-9]\d*$/.test(String(row.transactionId))&&(typeof row.transactionId!=='number'||Number.isSafeInteger(row.transactionId))&&row.readerDefinitionHash===artifact.definitionHash,'SELECTED_COLLECTION_NATIVE_WRITE_PIN');
 return row;
}
function selection(copy,artifact,row,actor,operation,requestId){
 const proof=parse(row.proof_json);assertIsolatedCopyReadProof(copy,proof);
 copyAssert(isolatedCopyJSON(proof.definitionHashes)===isolatedCopyJSON(artifact.parentHashes),'SELECTED_COLLECTION_NATIVE_PARENT_PINS');
 const actual=parse(row.actor_json);
 for(const right of ['finance.view','customer.view',rights[operation]])assertIsolatedCopyActor(copy,actor,actual,right);
 const payload=parse(row.payload_json),intent=parse(row.intent_json),dto=parse(row.context_json),s=payload.businessSelectedCollection;
 copyAssert(row.payload_json===isolatedCopyJSON(payload)&&row.payloadHash===isolatedCopyHash(payload),'SELECTED_COLLECTION_CANONICAL_INTENT');
 copyAssert(payload.copyId===copy.copyId&&payload.sealHash===copy.sealHash&&payload.operationOrigin===copy.operationOrigin&&payload.actorId===actor.id&&payload.requestId===requestId&&payload.operation===operation,'SELECTED_COLLECTION_INTENT_IDENTITY');
 copyAssert(s&&Object.keys(s).sort().join(',')===['invoiceId','creatorId','collectorId','customerId','customerAccountId','accountId','currency','creationRequestId','policyHash','sourceSelectionHash'].sort().join(',')&&s.creatorId==='15'&&s.collectorId==='16'&&actor.id==='16'&&s.currency==='TRY'&&workId(s.invoiceId)===s.invoiceId&&hash(s.policyHash)&&hash(s.sourceSelectionHash)&&typeof s.creationRequestId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(s.creationRequestId),'SELECTED_COLLECTION_SELECTION');
 const customer=copy.customers.filter(c=>c.id===s.customerId&&c.accountId===s.customerAccountId&&c.currency===s.currency),account=copy.financeAccounts.filter(a=>a.id===s.accountId&&a.currency===s.currency);
 copyAssert(customer.length===1&&account.length===1&&['cash','bank'].includes(account[0].type),'SELECTED_COLLECTION_ACCOUNT_POLICY');
 const expected={schemaVersion:'melisa-selected-collection-native-intent.v1',profileHash:isolatedCopyHash(copy),copyId:copy.copyId,sealHash:copy.sealHash,actorId:actor.id,operation,requestId,payloadHash:row.payloadHash,...s};
 copyAssert(Object.entries(expected).every(([k,v])=>isolatedCopyJSON(intent[k])===isolatedCopyJSON(v)),'SELECTED_COLLECTION_OWNER_INTENT_REQUIRED');
 copyAssert(hash(dto.revision)&&intent.selectedRevision===dto.revision,'SELECTED_COLLECTION_OWNER_REVISION');
 const native=dto.scope?.customer,accounts=dto.scope?.accounts;
 copyAssert(native&&['id','accountId','partyId','currency','sourceKey','sourceWitnessHash'].every(k=>native[k]===customer[0][k]),'SELECTED_COLLECTION_NATIVE_CUSTOMER');
 copyAssert(Array.isArray(accounts)&&accounts.length===1&&['id','currency','type'].every(k=>accounts[0][k]===account[0][k]),'SELECTED_COLLECTION_NATIVE_ACCOUNT');
 copyAssert(isolatedCopyJSON(dto.rate)===isolatedCopyJSON(copy.currencyRates.find(r=>r.currency===s.currency)),'SELECTED_COLLECTION_NATIVE_RATE');
 copyAssert((operation==='collection_cancel'?dto.capabilities?.canCancelCollection===true:dto.capabilities?.canCollect===true),'SELECTED_COLLECTION_NATIVE_CAPABILITY');
 return {dto,selected:freeze({...s,operation,actorId:actor.id,requestId,payloadHash:row.payloadHash})};
}
// Only an earned server registry plus an owner-sealed intent in this exact
// transaction can enter. A caller DTO or a detached native request is no grant.
export async function withBusinessSelectedCollectionWriteScope({copy,transaction,sql,request,actor,operation,requestId,collectionConsumer},fn){
 assertIsolatedCopyContext(copy);
 copyAssert(collectionConsumer&&collectionConsumer===getRegisteredBusinessSelectedCollectionRevision(copy),'SELECTED_COLLECTION_SERVER_CONSUMER');
 copyAssert(isolatedCopyTransactionContext(transaction)===copy&&typeof request==='function'&&typeof fn==='function'&&Object.hasOwn(rights,operation),'SELECTED_COLLECTION_WRITE_TRANSACTION');
 const a=freeze({id:workId(String(actor?.id)),permissions:[...(actor?.permissions??[])]});
 copyAssert(a.id==='16'&&['finance.view','customer.view',rights[operation]].every(r=>a.permissions.includes(r)),'ISOLATED_COPY_FORBIDDEN',403);
 copyAssert(typeof requestId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId),'SELECTED_COLLECTION_INTENT_REQUEST');
 copyAssert(!scopes.getStore()?.active,'SELECTED_COLLECTION_NESTED_WRITE_SCOPE');
 const artifact=collectionConsumer.bundle.intentArtifact;
 copyAssert(artifact?.name==='dbo.usp_business_selected_collection_intent_v1'&&hash(artifact.definitionHash),'SELECTED_COLLECTION_INTENT_ARTIFACT');
 const bound=()=>{const r=request();copyAssert(r?.parent===transaction,'SELECTED_COLLECTION_BOUND_REQUEST');return r;};
 const verify=async()=>copyAssert(await verifyBusinessSelectedCollectionRevision(copy,bound().input('copy_id',sql.UniqueIdentifier,copy.copyId),{write:true})===collectionConsumer,'SELECTED_COLLECTION_FRESH_CONSUMER');
 await verify();
 const readMeta=async()=>{const rows=(await bound().input('copy_id',sql.UniqueIdentifier,copy.copyId).query(selectedCollectionWriteMetadataSQL(artifact.name))).recordset;copyAssert(rows?.length===1,'SELECTED_COLLECTION_NATIVE_METADATA');return metadata(copy,artifact,rows[0]);};
 const before=await readMeta();
 const rows=(await bound().input('copy_id',sql.UniqueIdentifier,copy.copyId).input('actor_id',sql.BigInt,a.id).input('request_id',sql.UniqueIdentifier,requestId).input('operation',sql.NVarChar(40),operation).execute(artifact.name)).recordset;
 copyAssert(rows?.length===1,'SELECTED_COLLECTION_NATIVE_INTENT_RESULT');
 const row=rows[0],after=await readMeta();
 copyAssert(row.readerDefinitionHash===artifact.definitionHash&&before.sessionId===row.sessionId&&before.sessionId===after.sessionId&&String(before.transactionId)===String(row.transactionId)&&String(before.transactionId)===String(after.transactionId),'SELECTED_COLLECTION_SAME_NATIVE_TRANSACTION');
 const {dto,selected}=selection(copy,artifact,row,a,operation,requestId);
 await verify();bindIsolatedCopyOperationDTO(copy,dto);
 const value={copy,transaction,active:true,selection:selected};
 try{return await scopes.run(value,()=>fn(dto));}finally{value.active=false;}
}
export function getBusinessSelectedCollectionWriteScope(copy,transaction){
 const value=scopes.getStore();if(!value?.active)return null;
 copyAssert(value.copy===copy&&value.transaction===transaction&&isolatedCopyTransactionContext(transaction)===copy,'SELECTED_COLLECTION_SCOPE_TRANSACTION_CHANGED');return value.selection;
}
