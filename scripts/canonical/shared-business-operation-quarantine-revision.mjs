// Pure preparation only; no database, file, environment or runtime operations.
import {createHash} from 'node:crypto';
export const OPERATION_QUARANTINE_BASE=Object.freeze({name:'dbo.usp_assert_operation_quarantine_v2',definitionSha256:'ef88672772a375804fa9353a7ac04fdd0e13de8fe8876ad2b2197e8603317254',sourceUtf8Sha256:'8a3cb85ddb619579f3ebca85ef857b414b3e7f4cba2e7681f7e948cb35191ee4',definitionLength:14396});
export const OPERATION_QUARANTINE_REVISION_REGISTRY='dbo.stage4_copy_operation_quarantine_revisions';
export const OPERATION_QUARANTINE_EXPECTED_HASH_SQL="LOWER(COALESCE((SELECT c.after_hash FROM dbo.stage4_copy_module_manifest c WHERE c.name=p.object_name AND LOWER(c.before_hash)=p.definition_hash),p.definition_hash))";
const sha=(value,encoding='utf16le')=>createHash('sha256').update(value,encoding).digest('hex');
const check=(condition,code)=>{if(!condition)throw Object.assign(new Error(code),{code});};
export function operationQuarantineExpectedHashSQL(copyId){
 check(typeof copyId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(copyId),'OPERATION_QUARANTINE_COPY_ID');
 const baseline="COALESCE((SELECT c.after_hash FROM dbo.stage4_copy_module_manifest c WHERE c.name=p.object_name AND LOWER(c.before_hash)=p.definition_hash),p.definition_hash)";
 const v9=`COALESCE((SELECT q.after_hash FROM dbo.stage4_copy_supplier_item_quarantine_revisions q WHERE q.copy_id=N'${copyId}' AND q.revision=9 AND q.name=p.object_name AND q.before_hash=${baseline}),${baseline})`;
 const v10=`COALESCE((SELECT t.after_hash FROM ${OPERATION_QUARANTINE_REVISION_REGISTRY} t WHERE t.copy_id=N'${copyId}' AND t.revision=10 AND t.name=p.object_name AND t.before_hash=${v9}),${v9})`;
 return `LOWER(${v10})`;
}
// This shape helper permits synthetic tests, but deployment must use the pinned
// prepare function below and the parent's fresh complete v9/v10 registry proof.
export function transformOperationQuarantineExpectedHash(definition,copyId){
 check(typeof definition==='string'&&definition.split(OPERATION_QUARANTINE_EXPECTED_HASH_SQL).length===2,'OPERATION_QUARANTINE_EXPECTED_HASH_SHAPE');
 const offset=definition.indexOf(OPERATION_QUARANTINE_EXPECTED_HASH_SQL),prefix=definition.slice(0,offset),suffix=definition.slice(offset+OPERATION_QUARANTINE_EXPECTED_HASH_SQL.length),replacement=operationQuarantineExpectedHashSQL(copyId);
 const after=prefix+replacement+suffix;
 check(after.startsWith(prefix)&&after.endsWith(suffix),'OPERATION_QUARANTINE_BODY_PRESERVATION');
 return {definition:after,proof:Object.freeze({prefixHash:sha(prefix),suffixHash:sha(suffix),expectedBeforeHash:sha(OPERATION_QUARANTINE_EXPECTED_HASH_SQL),expectedAfterHash:sha(replacement),resolverPredicatesPreserved:true,compatibilityPredicatesPreserved:true,holdPredicatesPreserved:true,requiresForwardRegistry:true,requiresFreshCompleteParentProof:true,businessWrites:0})};
}
export function prepareOperationQuarantineRevision(definition,{copyId}={}){
 const base=OPERATION_QUARANTINE_BASE;
 check(typeof definition==='string'&&definition.length===base.definitionLength&&sha(definition)===base.definitionSha256&&sha(definition,'utf8')===base.sourceUtf8Sha256,'OPERATION_QUARANTINE_BASE_PIN');
 const prepared=transformOperationQuarantineExpectedHash(definition,copyId);
 return Object.freeze({schemaVersion:'melisa-operation-quarantine-revision-preparation.v1',name:base.name,beforeHash:base.definitionSha256,afterHash:sha(prepared.definition),definition:prepared.definition,proof:prepared.proof});
}
