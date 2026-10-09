// Offline CHECK adjunct only. It never connects, changes roles, or writes data.
import {moduleHash} from './stage4-copy-sql.mjs';
import {SHARED_COPY_DATABASE,ISOLATED_COPY_SERVER,ISOLATED_COPY_SOURCE_DATABASE,validateIsolatedOperationCopyContext,isolatedCopyHash} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
export const SHARED_STOCK_CHECK='CK_stock_movements_source_type_native';
export const SHARED_STOCK_BEFORE_HASH='F0DE6692372B574F9A80B5C68DC1661510935CE49FB4A5081A974BAA44AFB1F2';
export const SHARED_INTENT_PRICE_CHECK='CK__test_purc__purch__6B4FD30B';
export const SHARED_INTENT_PRICE_BEFORE_HASH='45BAEBC914F03BD7372F6A34610FCC2C076450C20C44B6EC6EBFF6698BDFB1CD';
const writer='melisa_shared_test_rw_20261009_01';
const assert=(ok,code)=>{if(!ok)throw Error(code);};
const q=s=>"N'"+s.replaceAll("'","''")+"'";
const trusted=c=>c&&(c.isDisabled===0||c.isDisabled===false)&&(c.isNotTrusted===0||c.isNotTrusted===false)&&(c.isNotForReplication===0||c.isNotForReplication===false)&&c.parentColumnId===0;
function scope(raw){
 const c=validateIsolatedOperationCopyContext(raw);
 assert(c.target.database===SHARED_COPY_DATABASE&&c.target.server===ISOLATED_COPY_SERVER&&c.target.login===writer&&c.warehouse?.id==='1'&&c.products.length===2&&c.actors.some(a=>a.id==='16'&&a.role==='isolated_test_ilker'),'SHARED_CHECK_FINITE_PROFILE');
 const products=[...c.products].sort((a,b)=>Number(a.id)-Number(b.id));
 for(const p of products)assert(typeof p.costExact4==='string'&&/^[1-9]\d{0,5}\.\d{4}$/.test(p.costExact4)&&Number(p.costExact4)<=1000000&&p.unit==='ADET'&&p.unitFactorExact8==='1.00000000','SHARED_CHECK_EXACT_COST');
 return {context:c,products,supplier:c.suppliers[0]};
}
export function sharedCopyStockCheckBranch(raw){
 const {context:c,products,supplier}=scope(raw);
 // These warehouse markers are written by the unchanged native receipt writer.
 // The sealed profile and existing same-TX native guard bind warehouse ID 1.
 const common=`db_name() collate Latin1_General_100_BIN2=${q(c.target.database)} AND serverproperty(N'ServerName')=${q(c.target.server)} AND original_login() collate Latin1_General_100_BIN2=${q(writer)} AND [source_type]=N'goods_receipt_batch' AND [movement_type]=N'in' AND [source_id]>(0) AND [created_by]=(16) AND [supplier_id]=(${supplier.id}) AND [customer_id] IS NULL AND [currency_code]=N'TRY' AND [document_date]=${q(c.date)} AND [warehouse_name]=N'TEST V70 MAL KABUL DEPOSU' AND [source_warehouse]=N'TEST-V70-GOODS-WH' AND [source_record_key] IS NULL AND [migration_run_id] IS NULL AND [affects_inventory]=(1) AND ([quantity_in]>=(1) AND [quantity_in]<=(5)) AND [quantity_in]=floor([quantity_in]) AND [quantity_out]=(0) AND [quantity_net]=[quantity_in]`;
 const tuples=products.map(p=>`[product_id]=(${p.id}) AND [unit_cost_try]=(${p.costExact4}) AND [unit_price]=(${p.costExact4}) AND [average_cost_try_after]=(${p.costExact4}) AND [amount_try]=[quantity_in]*(${p.costExact4})`);
 return `${common} AND (${tuples.join(' OR ')})`;
}
export function buildSharedNativeConstraintAdjunct(input){
 assert(input?.schemaVersion==='melisa-shared-native-constraints-input.v1'&&input.businessWrites===0,'SHARED_CHECK_CAPTURE');
 const {context:c}=scope(input.copyContext),source=input[ISOLATED_COPY_SOURCE_DATABASE],copy=input[SHARED_COPY_DATABASE];
 for(const [v,db] of [[source,ISOLATED_COPY_SOURCE_DATABASE],[copy,SHARED_COPY_DATABASE]])assert(v?.identity?.database===db&&v.identity.server===ISOLATED_COPY_SERVER&&Array.isArray(v.constraints)&&v.constraints.length>0,'SHARED_CHECK_CAPTURE_IDENTITY');
 const pick=v=>v.constraints.filter(r=>r.schemaName==='dbo'&&r.tableName==='stock_movements'&&r.name===SHARED_STOCK_CHECK);
 const src=pick(source),dst=pick(copy);assert(src.length===1&&dst.length===1&&trusted(src[0])&&trusted(dst[0]),'SHARED_CHECK_TRUSTED_BASE');
 const before=dst[0];assert(typeof before.definition==='string'&&moduleHash(before.definition)===SHARED_STOCK_BEFORE_HASH&&before.definitionHash===SHARED_STOCK_BEFORE_HASH&&src[0].definition===before.definition&&src[0].definitionHash===before.definitionHash,'SHARED_CHECK_KNOWN_BEFORE');
 assert(before.definition.startsWith('(')&&before.definition.endsWith(')'),'SHARED_CHECK_EXPRESSION');
 // The original complete expression remains verbatim in the first OR branch.
 // CASE rejects NULL in the new branch. Existing old CHECK semantics are kept.
 const branch=sharedCopyStockCheckBranch(c),afterDefinition=`(${before.definition} OR case when ${branch} then (1) else (0) end=(1))`;
 const checks=copy.constraints.map(r=>({schemaName:r.schemaName,tableName:r.tableName,name:r.name,definitionHash:r.definitionHash,isDisabled:r.isDisabled,isNotTrusted:r.isNotTrusted,isNotForReplication:r.isNotForReplication}));
 assert(copy.constraints.every(r=>r.definitionHash===moduleHash(r.definition)&&trusted({...r,parentColumnId:0})),'SHARED_CHECK_OTHER_TRUST_STATE');
 const schemaCols=copy.schema?.filter(r=>r.schemaName==='dbo'&&r.tableName==='stock_movements').map(r=>r.columnName)??[];
 for(const name of ['source_type','movement_type','source_id','created_by','supplier_id','customer_id','currency_code','document_date','warehouse_name','source_warehouse','source_record_key','migration_run_id','affects_inventory','quantity_in','quantity_out','quantity_net','product_id','unit_cost_try','unit_price','average_cost_try_after','amount_try'])assert(schemaCols.includes(name),'SHARED_CHECK_NATIVE_SCHEMA');
 const name=`dbo.${SHARED_STOCK_CHECK}`;
 const replacement={name,table:'dbo.stock_movements',constraint:SHARED_STOCK_CHECK,beforeHash:before.definitionHash,afterHash:moduleHash(afterDefinition),beforeDefinition:before.definition,afterDefinition,branch,sql:`ALTER TABLE dbo.stock_movements DROP CONSTRAINT ${SHARED_STOCK_CHECK};\nALTER TABLE dbo.stock_movements WITH CHECK ADD CONSTRAINT ${SHARED_STOCK_CHECK} CHECK ${afterDefinition};\nALTER TABLE dbo.stock_movements WITH CHECK CHECK CONSTRAINT ${SHARED_STOCK_CHECK};`};
 const body={schemaVersion:'melisa-shared-copy-native-check-adjunct.v1',target:c.target,copyId:c.copyId,baseSealHash:c.sealHash,backupSHA:c.backupSHA,replacements:[replacement],unchangedChecks:checks.filter(r=>r.name!==SHARED_STOCK_CHECK),requiredNativeGuard:'dbo.usp_stage4_copy_guard',requiredQuarantineFirstCount:37,baseModuleManifestCount:184,adapterRevisionRows:3,warehouseId:c.warehouse.id,allowedActorId:'16',businessWrites:0,normalRolesChanged:false,registryWrites:0,requiresOuterSerializableTransaction:true,requiresBeforeAfterBusinessAndModuleProof:true,requiresTrustedEnabledAfter:true,normalSourceWrites:0};
 return {...body,adjunctHash:isolatedCopyHash(body)};
}

// SQL Server removes the old outer OR group and adds parentheses around the
// two scalar function operands of COLLATE. No tokens or predicate groups change.
export function sharedCopyCanonicalCheckDefinition(before,branch){
 assert(moduleHash(before)===SHARED_STOCK_BEFORE_HASH,'SHARED_CHECK_CANONICAL_BEFORE');
 for(const functionName of ['db_name','original_login'])assert(branch.split(`${functionName}() collate`).length===2,'SHARED_CHECK_CANONICAL_FUNCTION');
 const canonicalBranch=branch.replace('db_name() collate','(db_name()) collate').replace('original_login() collate','(original_login()) collate');
 return `(${before.slice(1,-1)} OR case when ${canonicalBranch} then (1) else (0) end=(1))`;
}

export function buildReviewedSharedNativeConstraintAdjunct(input,rehearsal,inputArtifactSHA){
 const initial=buildSharedNativeConstraintAdjunct(input),r=initial.replacements[0];
 assert(rehearsal?.rolledBack===true&&rehearsal.trustedEnabled===true&&rehearsal.businessBefore===rehearsal.businessAfter,'SHARED_CHECK_REHEARSAL_ROLLBACK');
 assert(/^[A-Fa-f0-9]{64}$/.test(inputArtifactSHA??'')&&rehearsal.inputSHA?.toUpperCase()===inputArtifactSHA.toUpperCase(),'SHARED_CHECK_REHEARSAL_INPUT_PIN');
 assert(isolatedCopyHash(rehearsal.target)===isolatedCopyHash(initial.target)&&rehearsal.copyId===initial.copyId&&rehearsal.baseSealHash===initial.baseSealHash&&rehearsal.constraint===r.constraint&&rehearsal.beforeHash===r.beforeHash,'SHARED_CHECK_REHEARSAL_TARGET');
 const canonical=sharedCopyCanonicalCheckDefinition(r.beforeDefinition,r.branch);
 assert(rehearsal.definition===canonical&&rehearsal.actualHash===moduleHash(canonical),'SHARED_CHECK_CANONICAL_EXACT_REVIEW');
 // Execute the unchanged expression already checked by SQL Server. The expected
 // stored definition/hash now pins its independently captured canonical form.
 const {adjunctHash,...body}=initial;
 body.replacements=[{...r,afterDefinition:canonical,afterHash:rehearsal.actualHash,sourceExpression:r.afterDefinition}];
 body.canonicalReview={inputArtifactSHA:inputArtifactSHA.toUpperCase(),rolledBack:true,businessProofUnchanged:true,originalInnerExpressionVerbatim:true,normalizations:['flatten associative top-level OR group only','parenthesize DB_NAME and ORIGINAL_LOGIN operands before COLLATE only'],actualDefinitionHash:rehearsal.actualHash};
 return {...body,adjunctHash:isolatedCopyHash(body)};
}

export function sharedCopyIntentPriceCheckBranch(raw){
 const {context:c,products}=scope(raw);
 const common=`(db_name()) collate Latin1_General_100_BIN2=${q(c.target.database)} AND serverproperty(N'ServerName')=${q(c.target.server)} AND (original_login()) collate Latin1_General_100_BIN2=${q(writer)} AND [draft_id]>(0) AND [receipt_line_id]>(0) AND ([quantity]>=(1) AND [quantity]<=(5)) AND [quantity]=floor([quantity]) AND [line_discount_rate]=(0) AND [line_total]=[quantity]*[purchase_price]`;
 return `${common} AND (${products.map(p=>`[product_id]=(${p.id}) AND [purchase_price]=(${p.costExact4})`).join(' OR ')})`;
}

export function buildSharedIntentPriceConstraintAdjunct(input,chainCapture=null){
 assert(input?.schemaVersion==='melisa-shared-intent-price-check-input.v1'&&input.businessWrites===0,'SHARED_PRICE_CHECK_CAPTURE');
 const {context:c}=scope(input.copyContext),source=input[ISOLATED_COPY_SOURCE_DATABASE],copy=input[SHARED_COPY_DATABASE];
 for(const [v,db] of [[source,ISOLATED_COPY_SOURCE_DATABASE],[copy,SHARED_COPY_DATABASE]])assert(v?.identity?.database===db&&v.identity.server===ISOLATED_COPY_SERVER&&Array.isArray(v.constraints),'SHARED_PRICE_CHECK_CAPTURE_IDENTITY');
 const pick=v=>v.constraints.filter(r=>r.schemaName==='dbo'&&r.tableName==='test_purchase_batch_intent_lines'&&r.name===SHARED_INTENT_PRICE_CHECK),src=pick(source),dst=pick(copy);
 assert(src.length===1&&dst.length===1&&src[0].parentColumnId===5&&dst[0].parentColumnId===5&&trusted({...src[0],parentColumnId:0})&&trusted({...dst[0],parentColumnId:0}),'SHARED_PRICE_CHECK_TRUSTED_BASE');
 const before=dst[0];assert(before.definition==='([purchase_price]=(80) OR [purchase_price]=(60))'&&before.definitionHash===SHARED_INTENT_PRICE_BEFORE_HASH&&moduleHash(before.definition)===before.definitionHash&&src[0].definition===before.definition&&src[0].definitionHash===before.definitionHash,'SHARED_PRICE_CHECK_KNOWN_BEFORE');
 const cols=copy.schema?.filter(r=>r.schemaName==='dbo'&&r.tableName==='test_purchase_batch_intent_lines').map(r=>r.columnName)??[];
 for(const col of ['draft_id','receipt_line_id','product_id','quantity','purchase_price','line_discount_rate','line_total'])assert(cols.includes(col),'SHARED_PRICE_CHECK_SCHEMA');
 assert(copy.constraints.length===4&&source.constraints.length===4&&copy.constraints.every(r=>moduleHash(r.definition)===r.definitionHash&&trusted({...r,parentColumnId:0})&&source.constraints.some(s=>s.schemaName===r.schemaName&&s.tableName===r.tableName&&s.name===r.name&&s.definition===r.definition&&s.definitionHash===r.definitionHash)),'SHARED_PRICE_CHECK_COMPANION_BASE');
 const branch=sharedCopyIntentPriceCheckBranch(c);
 // The previously rehearsed stock adjunct established this exact SQL Server
 // normalization: associative outer OR is flattened, inner legacy tokens kept.
 const afterDefinition=`(${before.definition.slice(1,-1)} OR case when ${branch} then (1) else (0) end=(1))`;
 const replacement={name:`dbo.${SHARED_INTENT_PRICE_CHECK}`,table:'dbo.test_purchase_batch_intent_lines',constraint:SHARED_INTENT_PRICE_CHECK,beforeHash:before.definitionHash,afterHash:moduleHash(afterDefinition),beforeDefinition:before.definition,afterDefinition,beforeParentColumnId:5,afterParentColumnId:0,branch,sql:`ALTER TABLE dbo.test_purchase_batch_intent_lines DROP CONSTRAINT ${SHARED_INTENT_PRICE_CHECK};\nALTER TABLE dbo.test_purchase_batch_intent_lines WITH CHECK ADD CONSTRAINT ${SHARED_INTENT_PRICE_CHECK} CHECK ${afterDefinition};\nALTER TABLE dbo.test_purchase_batch_intent_lines WITH CHECK CHECK CONSTRAINT ${SHARED_INTENT_PRICE_CHECK};`};
 let companions=copy.constraints;
 if(chainCapture){
  const wide=chainCapture[SHARED_COPY_DATABASE],wideSource=chainCapture[ISOLATED_COPY_SOURCE_DATABASE];
  assert(chainCapture.businessWrites===0&&chainCapture.copyContext?.copyId===c.copyId&&chainCapture.copyContext?.sealHash===c.sealHash&&wide?.identity?.database===SHARED_COPY_DATABASE&&wide.identity.server===ISOLATED_COPY_SERVER&&wideSource?.identity?.database===ISOLATED_COPY_SOURCE_DATABASE&&wideSource.identity.server===ISOLATED_COPY_SERVER&&wide.constraints?.length===10&&wideSource.constraints?.length===10,'SHARED_PRICE_CHECK_CHAIN_CAPTURE');
  assert(wide.constraints.every(r=>r.schemaName==='dbo'&&['test_purchase_batch_drafts','test_purchase_batch_intent_lines','test_purchase_batch_links'].includes(r.tableName)&&moduleHash(r.definition)===r.definitionHash&&trusted({...r,parentColumnId:0})&&wideSource.constraints.some(s=>s.name===r.name&&s.tableName===r.tableName&&s.definition===r.definition&&s.definitionHash===r.definitionHash))&&new Set(wide.constraints.map(r=>r.name)).size===10,'SHARED_PRICE_CHECK_CHAIN_PINS');
  assert(copy.constraints.every(r=>wide.constraints.some(w=>w.name===r.name&&w.definitionHash===r.definitionHash)),'SHARED_PRICE_CHECK_CHAIN_LINE_PINS');companions=wide.constraints;
 }
 const body={schemaVersion:'melisa-shared-copy-native-check-adjunct.v1',target:c.target,copyId:c.copyId,baseSealHash:c.sealHash,backupSHA:c.backupSHA,replacements:[replacement],unchangedChecks:companions.filter(r=>r.name!==SHARED_INTENT_PRICE_CHECK).map(({schemaName,tableName,name,definitionHash,isDisabled,isNotTrusted,isNotForReplication,parentColumnId})=>({schemaName,tableName,name,definitionHash,isDisabled,isNotTrusted,isNotForReplication,parentColumnId})),requiredNativeGuard:'dbo.usp_stage4_copy_guard',requiredQuarantineFirstCount:37,baseModuleManifestCount:184,adapterRevisionRows:3,allowedActorId:'16',requiredHeaderCurrency:'TRY',actorCurrencyAuthority:'Existing same-TX native/header guard; these columns do not exist on intent lines',businessWrites:0,normalRolesChanged:false,registryWrites:0,normalSourceWrites:0,requiresOuterSerializableTransaction:true,requiresBeforeAfterBusinessAndModuleProof:true,requiresTrustedEnabledAfter:true,afterHashStatus:'PROSPECTIVE_CANONICAL_REQUIRES_REHEARSE',originalInnerExpressionVerbatim:true};
 return {...body,adjunctHash:isolatedCopyHash(body)};
}
