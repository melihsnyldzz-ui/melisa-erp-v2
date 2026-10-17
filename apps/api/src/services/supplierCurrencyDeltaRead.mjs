// Read using the existing dbo SELECT permission and the same card transaction.
// A committed, immutable approved journal must agree with its native movement.
export const SUPPLIER_DELTA_READ_SQL=`SELECT CONVERT(varchar(20),a.id) accountId,
 CONVERT(varchar(50),COALESCE(SUM(e.delta),CONVERT(decimal(28,8),0))) sourceDeltaExact,
 CONVERT(bit,CASE WHEN SUM(CASE WHEN e.account_id IS NOT NULL AND (r.run_id IS NULL OR r.status<>N'COMMITTED' OR r.parent_plan_hash<>N'87d1afc526da80464e47249f69be5dc69ed78000645d13fdb94a1041828f19d0'
 OR e.parent_plan_hash<>r.parent_plan_hash OR e.supplier_id<>a.supplier_id OR e.currency<>a.currency_code
 OR (e.delta=0 AND (e.movement_id IS NOT NULL OR e.audit_id IS NOT NULL))
 OR (e.delta<>0 AND (m.id IS NULL OR m.party_currency_account_id IS NULL OR m.account_currency IS NULL OR m.balance_effect_exact IS NULL OR m.affects_balance IS NULL OR m.migration_run_id IS NULL OR m.source_payload_hash IS NULL OR m.supplier_id<>a.supplier_id OR m.party_currency_account_id<>a.id OR m.account_currency<>a.currency_code OR m.currency_code<>a.currency_code OR m.balance_effect_exact<>e.delta OR m.affects_balance<>1 OR m.movement_type<>N'MIGRATION_HISTORICAL_ADJUSTMENT' OR m.migration_run_id<>e.run_id OR m.source_payload_hash<>r.manifest_hash OR au.id IS NULL OR au.entity_id<>a.id OR au.action<>N'goal73_currency_delta' OR au.reason<>e.run_id OR au.actor_user_id<>r.actor_id))) THEN 1 ELSE 0 END)=0 THEN 1 ELSE 0 END) verified
 FROM dbo.party_currency_accounts a
 LEFT JOIN dbo.goal73_supplier_currency_effects e ON e.account_id=a.id
 LEFT JOIN dbo.goal73_supplier_currency_runs r ON r.run_id=e.run_id
 LEFT JOIN dbo.supplier_movements m ON m.id=e.movement_id
 LEFT JOIN dbo.audit_logs au ON au.id=e.audit_id
 WHERE a.id IN(SELECT CONVERT(bigint,[value]) FROM OPENJSON(@account_ids))
 GROUP BY a.id`;
export function attachSupplierDeltas(rawRows,proofRows){
 const proof=new Map(proofRows.map(p=>[p.accountId,p]));
 for(const raw of rawRows)for(const account of raw.nativeAccounts??[]){const p=proof.get(account.id);account.sourceDeltaExact=p?.verified===true?p.sourceDeltaExact:null;account.sourceDeltaVerified=p?.verified===true;}
 return rawRows;
}
