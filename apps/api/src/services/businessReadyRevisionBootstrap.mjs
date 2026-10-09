import {registerIsolatedCopyReadyRevision,validateIsolatedCopyReadyRevision,registerIsolatedCopyReadyPerformanceRevision,validateIsolatedCopyReadyPerformanceRevision,copyAssert} from './isolatedOperationCopyContext.mjs';
// Read every registry row: a filter must never conceal a second registration.
export const BUSINESS_READY_REVISION_PROOF_SQL=`SELECT DB_NAME() databaseName,CONVERT(varchar(36),r.copy_id) copyId,r.revision version,r.base_seal_hash baseSealHash,r.name,r.before_hash beforeHash,r.after_hash afterHash,r.revision_hash revisionHash,p.after_hash baseManifestHash,
 (SELECT COUNT(*) FROM dbo.stage4_copy_module_manifest) baseManifestRows,
 (SELECT m.seal_hash FROM dbo.stage4_copy_manifest m WHERE m.copy_id=r.copy_id AND m.sealed=1) manifestSealHash,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(r.name))),2) actualHash,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.immutable_stage4_copy_ready_revisions'))),2) immutableTriggerHash,
 CONVERT(int,OBJECTPROPERTY(OBJECT_ID(N'dbo.immutable_stage4_copy_ready_revisions'),'ExecIsTriggerDisabled')) triggerDisabled
 FROM dbo.stage4_copy_ready_revisions r LEFT JOIN dbo.stage4_copy_module_manifest p ON p.name=r.name ORDER BY r.name;`;
export async function configureBusinessReadyRevision(context,input,pool){
 validateIsolatedCopyReadyRevision(context,input);
 const proof=(await pool.request().query(BUSINESS_READY_REVISION_PROOF_SQL)).recordset;
 return registerIsolatedCopyReadyRevision(context,input,proof);
}
export const BUSINESS_READY_PERFORMANCE_REVISION_PROOF_SQL=BUSINESS_READY_REVISION_PROOF_SQL+`
SELECT DB_NAME() databaseName,CONVERT(varchar(36),r.copy_id) copyId,r.revision version,r.base_seal_hash baseSealHash,r.base_ready_revision_hash baseReadyRevisionHash,r.name,r.before_hash beforeHash,r.after_hash afterHash,r.revision_hash revisionHash,p.after_hash baseManifestHash,
 (SELECT COUNT(*) FROM dbo.stage4_copy_module_manifest) baseManifestRows,
 (SELECT m.seal_hash FROM dbo.stage4_copy_manifest m WHERE m.copy_id=r.copy_id AND m.sealed=1) manifestSealHash,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(r.name))),2) actualHash,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.immutable_stage4_copy_ready_performance_revisions'))),2) immutableTriggerHash,
 CONVERT(int,OBJECTPROPERTY(OBJECT_ID(N'dbo.immutable_stage4_copy_ready_performance_revisions'),'ExecIsTriggerDisabled')) triggerDisabled
 FROM dbo.stage4_copy_ready_performance_revisions r LEFT JOIN dbo.stage4_copy_module_manifest p ON p.name=r.name ORDER BY r.name;`;
export async function configureBusinessReadyPerformanceRevision(context,baseInput,input,pool){
 validateIsolatedCopyReadyPerformanceRevision(context,baseInput,input);
 const recordsets=(await pool.request().query(BUSINESS_READY_PERFORMANCE_REVISION_PROOF_SQL)).recordsets;
 copyAssert(Array.isArray(recordsets)&&recordsets.length===2,'ISOLATED_COPY_READY_PERFORMANCE_DB_PROOF');
 return registerIsolatedCopyReadyPerformanceRevision(context,baseInput,input,{base:recordsets[0],performance:recordsets[1]});
}
