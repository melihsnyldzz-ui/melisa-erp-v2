import {moduleHash} from './stage4-copy-sql.mjs';
import {prepareBusinessSelectedSaleContextSQL,SELECTED_SALE_READER} from './shared-business-selected-sale-preview-sql.mjs';
import {isolatedCopyHash,copyAssert} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {assertPreparedSelectedRevisionArtifact} from './shared-business-selected-sale-revision-sql.mjs';

export const SELECTED_SALE_INTENT_READER='dbo.usp_business_selected_sale_write_intent_v1';
const artifacts=new WeakMap();
const once=(text,from,to)=>{copyAssert(text.split(from).length===2,'SELECTED_SALE_INTENT_SOURCE_ANCHOR');return text.replace(from,to);};

// This is preparation of a same-transaction intent reader, not installation or
// an additional commercial writer. The current v4/v5 begin never emits the
// selectedSaleIntent before-image witness; existing runtimes therefore cannot
// enter this scope. A coherent pinned begin/guard/effects successor is required.
export function prepareBusinessSelectedSaleWriteScopeSQL(copy){
 const parent=prepareBusinessSelectedSaleContextSQL(copy);
 let definition=parent.definition;
 copyAssert(definition.split(SELECTED_SALE_READER).length===3,'SELECTED_SALE_INTENT_SOURCE_ANCHOR');
 definition=definition.replaceAll(SELECTED_SALE_READER,SELECTED_SALE_INTENT_READER);
 definition=once(definition,'@customer_id bigint,@currency nvarchar(3),@product_ids_json nvarchar(max)','@request_id uniqueidentifier,@operation nvarchar(40)');
 definition=once(definition,"<>N'Shared'","<>N'Exclusive'");
 const intent=`DECLARE @customer_id bigint,@currency nvarchar(3),@product_ids_json nvarchar(max),@payload nvarchar(max),@intent nvarchar(max),@payload_hash char(64);
IF @request_id IS NULL OR @operation IS NULL OR @operation NOT IN(N'sale_draft',N'sale_finalize',N'sale_cancel') THROW 51904,'SELECTED_SALE_INTENT_OPERATION',1;
IF(SELECT COUNT(*) FROM dbo.stage4_copy_intents WITH(UPDLOCK,HOLDLOCK) WHERE copy_id=@copy_id AND session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID())<>1 THROW 51904,'SELECTED_SALE_INTENT_TRANSACTION',1;
SELECT @payload=payload_json,@payload_hash=payload_hash,@intent=JSON_QUERY(before_state_json,'$.selectedSaleIntent') FROM dbo.stage4_copy_intents WITH(UPDLOCK,HOLDLOCK) WHERE copy_id=@copy_id AND request_id=@request_id AND actor_id=@actor_id AND operation=@operation AND session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID() AND response_json IS NULL AND effect_proof_json IS NULL;
IF ISNULL(ISJSON(@payload),0)<>1 OR ISNULL(ISJSON(@intent),0)<>1 OR ISNULL(CONVERT(varchar(64),HASHBYTES('SHA2_256',@payload),2),'')<>@payload_hash OR ISNULL(JSON_VALUE(@payload,'$.copyId'),'')<>LOWER(CONVERT(varchar(36),@copy_id)) OR ISNULL(JSON_VALUE(@payload,'$.sealHash'),'')<>'${copy.sealHash}' OR ISNULL(JSON_VALUE(@payload,'$.actorId'),'')<>CONVERT(varchar(20),@actor_id) OR ISNULL(JSON_VALUE(@payload,'$.requestId'),'')<>LOWER(CONVERT(varchar(36),@request_id)) OR ISNULL(JSON_VALUE(@payload,'$.operation'),'')<>@operation OR ISNULL(JSON_VALUE(@payload,'$.operationOrigin'),'')<>N'ISOLATED_TEST_COPY' THROW 51904,'SELECTED_SALE_INTENT_PAYLOAD',1;
-- This witness is produced by the owner begin procedure in its protected
-- before-image, never by a client body or the preview reader.
IF ISNULL(JSON_VALUE(@intent,'$.schemaVersion'),'')<>N'melisa-selected-sale-native-intent.v1' OR ISNULL(JSON_VALUE(@intent,'$.profileHash'),'')<>'${isolatedCopyHash(copy)}' OR ISNULL(JSON_VALUE(@intent,'$.copyId'),'')<>LOWER(CONVERT(varchar(36),@copy_id)) OR ISNULL(JSON_VALUE(@intent,'$.sealHash'),'')<>'${copy.sealHash}' OR ISNULL(JSON_VALUE(@intent,'$.actorId'),'')<>CONVERT(varchar(20),@actor_id) OR ISNULL(JSON_VALUE(@intent,'$.requestId'),'')<>LOWER(CONVERT(varchar(36),@request_id)) OR ISNULL(JSON_VALUE(@intent,'$.operation'),'')<>@operation OR ISNULL(JSON_VALUE(@intent,'$.payloadHash'),'')<>@payload_hash OR ISNULL(JSON_VALUE(@intent,'$.policyHash'),'')<>ISNULL(JSON_VALUE(@payload,'$.businessSelectedSalePolicyHash'),'!') OR ISNULL(JSON_VALUE(@intent,'$.sourceSelectionHash'),'')<>ISNULL(JSON_VALUE(@payload,'$.sourceSelectionHash'),'!') OR ISNULL(JSON_VALUE(@intent,'$.customerId'),'')<>ISNULL(JSON_VALUE(@payload,'$.businessCustomerId'),'!') OR ISNULL(JSON_VALUE(@intent,'$.customerAccountId'),'')<>ISNULL(JSON_VALUE(@payload,'$.businessAccountId'),'!') OR ISNULL(JSON_VALUE(@intent,'$.currency'),'')<>ISNULL(JSON_VALUE(@payload,'$.businessCurrency'),'!') OR ISNULL(JSON_QUERY(@intent,'$.productIds'),'')<>ISNULL(JSON_QUERY(@payload,'$.businessProductIds'),'!') THROW 51904,'SELECTED_SALE_OWNER_INTENT_REQUIRED',1;
IF JSON_VALUE(@intent,'$.policyHash') LIKE '%[^A-F0-9]%' OR LEN(JSON_VALUE(@intent,'$.policyHash'))<>64 OR JSON_VALUE(@intent,'$.sourceSelectionHash') LIKE '%[^A-F0-9]%' OR LEN(JSON_VALUE(@intent,'$.sourceSelectionHash'))<>64 THROW 51904,'SELECTED_SALE_INTENT_HASH',1;
SET @customer_id=TRY_CONVERT(bigint,JSON_VALUE(@intent,'$.customerId'));SET @currency=JSON_VALUE(@intent,'$.currency');SET @product_ids_json=JSON_QUERY(@intent,'$.productIds');
`;
 definition=once(definition,'DECLARE @p nvarchar(max),',intent+'DECLARE @p nvarchar(max),');
 definition=once(definition,'NOT BETWEEN 1 AND 2','NOT BETWEEN 1 AND 200');
 definition=once(definition,"SET @revision=LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',@state),2));",`SET @revision=LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',@state),2));
IF ISNULL(JSON_VALUE(@intent,'$.selectedRevision'),'')<>@revision OR (@operation=N'sale_draft' AND ISNULL(JSON_VALUE(@payload,'$.expectedRevision'),'')<>@revision) OR (@operation<>N'sale_draft' AND ISNULL(JSON_VALUE(@intent,'$.invoiceRevision'),'')<>ISNULL(JSON_VALUE(@payload,'$.expectedRevision'),'!')) THROW 51904,'SELECTED_SALE_INTENT_REVISION',1;`);
 definition=once(definition,'@@SPID sessionId,CURRENT_TRANSACTION_ID() transactionId,','@intent intent_json,@payload payload_json,@payload_hash payloadHash,@@SPID sessionId,CURRENT_TRANSACTION_ID() transactionId,');
 // Output remains a read-only source DTO. Only the separately validated native
 // intent can enter the application write scope; DTO writable flags are ignored.
 const artifact=Object.freeze({schemaVersion:'melisa-selected-sale-write-scope-preparation.v1',name:SELECTED_SALE_INTENT_READER,definition,definitionHash:moduleHash(definition),copyId:copy.copyId,profileHash:isolatedCopyHash(copy),parentHashes:parent.parentHashes,requiresNativeSelectedIntent:true,businessWrites:0,grants:0});
 artifacts.set(artifact,copy);return artifact;
}
export function assertPreparedBusinessSelectedSaleWriteScope(artifact,copy){
 if(artifacts.get(artifact)===copy)return artifact;
 // Only the canonical successor compiler can brand its regenerated reader.
 // Arbitrary artifact hashes or plain JSON cannot enter this branch.
 try{return assertPreparedSelectedRevisionArtifact(artifact,copy,'intent');}catch{copyAssert(false,'SELECTED_SALE_SERVER_WRITE_ARTIFACT_REQUIRED');}
}
