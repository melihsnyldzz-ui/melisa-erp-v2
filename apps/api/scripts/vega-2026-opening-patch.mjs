import path from 'node:path';
import { getTestPool, sql, SPEC, hash, requireRule, literal, protectedManifest } from './vega-native-migration-runtime.mjs';
import { decimal } from './vega-native-migration-adapters.mjs';
import { patchId, patchPrefix, adjustmentLabel } from './vega-2026-opening-model.mjs';
import { makePlan, read, save } from './vega-2026-opening-plan.mjs';

const mode = process.argv[2];
requireRule(['--backup', '--commit-test', '--verify'].includes(mode) && process.argv.length === 3, 'EXPLICIT_PATCH_MODE_REQUIRED');
const pool = await getTestPool();
const request = () => pool.request();

async function historyFingerprint(q) {
  const tables = {};
  for (const role of ['customer', 'supplier']) {
    const rows = (await q().input('prefix', patchPrefix + '%').query(`SELECT id,CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) digest FROM dbo.${role}_movements m WHERE source_record_key IS NULL OR source_record_key NOT LIKE @prefix ORDER BY id`)).recordset;
    tables[role] = { rows: rows.length, hash: hash(rows) };
  }
  return tables;
}

async function verify(q) {
  const original = read('plan.json'), after = await makePlan(q);
  requireRule(after.sourceHash === original.sourceHash && after.ledgerHash === original.ledgerHash, 'SOURCE_OR_EXISTING_LEDGER_CHANGED');
  requireRule(after.summary.differenceAccounts === 0, 'OPENING_ALIGNMENT_REMAINS');
  const corrected = original.details.filter(d => d.status === 'DIFFERENT');
  for (const d of corrected) {
    const a = after.details.find(a => a.accountId === d.accountId);
    requireRule(a.existingCorrectionCount === 1 && a.previousCorrection === d.requiredCorrection, 'CORRECTION_NOT_EXACTLY_ONCE');
    requireRule(decimal(a.currentBalance) - decimal(d.currentBalance) === decimal(d.requiredCorrection), 'CURRENT_BALANCE_DELTA_MISMATCH');
  }
  for (const d of original.details.filter(d => d.status !== 'DIFFERENT')) {
    requireRule(after.details.find(a => a.accountId === d.accountId).currentBalance === d.currentBalance, 'UNRELATED_ACCOUNT_BALANCE_CHANGED');
  }
  requireRule(hash(await historyFingerprint(q)) === hash(read('history-before.json')), 'EXISTING_MOVEMENT_ROWS_CHANGED');
  const terminal = await protectedManifest(q);
  requireRule(terminal.hash === read('terminal-before.json').hash, 'TERMINAL_CHANGED');
  const counts = {};
  for (const table of ['customer_movements', 'supplier_movements', 'document_links', 'migration_decisions']) {
    counts[table] = (await q().input('run', patchId).query(`SELECT COUNT(*) n FROM dbo.${table} WHERE migration_run_id=@run`)).recordset[0].n;
  }
  requireRule(counts.customer_movements + counts.supplier_movements === corrected.length, 'PATCH_MOVEMENT_COUNT');
  requireRule(counts.document_links === corrected.reduce((n,d) => n+d.sources.length,0), 'PATCH_SOURCE_LINK_COUNT');
  const pakel = after.details.find(d => d.role === 'supplier' && d.partyId === '10183' && d.currency === 'USD');
  requireRule(pakel.expected === '37265.26003454' && pakel.after === pakel.expected, 'PAKEL_OPENING_ANCHOR');
  return { patchId, target: SPEC.target, beforeDifferenceAccounts: original.summary.differenceAccounts,
    correctedAccounts: corrected.length, afterDifferenceAccounts: after.summary.differenceAccounts,
    matchedExplicitOpeningAccounts: after.summary.anchoredAccounts,
    noExplicitOpeningAccounts: after.summary.noExplicitOpeningAccounts,
    unrecognizedCurrencyOpeningRecords: after.summary.rejectedSourceRecords,
    noExplicitOpeningWithNonzeroHistory: after.details.filter(d => !d.sources && d.historical !== '0.00000000').length,
    counts, pakel, terminalHash: terminal.hash, sourceWrites: 0, liveErpConnections: 0,
    historicalMovementsPreserved: true, currencyConversions: 0,
    independentMigrationReconciliation: 'NOT_CLAIMED', at: new Date().toISOString() };
}

try {
  if (mode === '--backup') {
    requireRule(read('source-check.json').matchesFrozenSource === true, 'LIVE_READ_ONLY_SOURCE_CHECK_REQUIRED');
    const plan = await makePlan(request);
    requireRule(hash(plan) === hash(read('plan.json')), 'TARGET_CHANGED_SINCE_PLAN');
    const terminal = await protectedManifest(request);
    save('terminal-before.json', terminal); save('history-before.json', await historyFingerprint(request));
    const dir = (await request().query("SELECT CONVERT(nvarchar(4000),SERVERPROPERTY('InstanceDefaultBackupPath')) dir")).recordset[0].dir;
    const file = path.win32.join(dir, `${SPEC.target}_before_${patchId}.bak`);
    requireRule(path.win32.isAbsolute(dir) && path.win32.dirname(file) === path.win32.normalize(dir).replace(/\\$/, ''), 'BACKUP_DIRECTORY');
    const exists = (await request().input('p', sql.NVarChar(4000), file).query('SELECT file_exists FROM sys.dm_os_file_exists(@p)')).recordset[0];
    requireRule(exists.file_exists === 0, 'BACKUP_ALREADY_EXISTS');
    await request().query(`BACKUP DATABASE [MELISA_ERP_FULL_TEST_20260916] TO DISK=${literal(file)} WITH COPY_ONLY,CHECKSUM,NOINIT,NAME=${literal(patchId)}`);
    await request().query(`RESTORE VERIFYONLY FROM DISK=${literal(file)} WITH CHECKSUM`);
    const h = (await request().query(`RESTORE HEADERONLY FROM DISK=${literal(file)}`)).recordset;
    requireRule(h.length === 1 && h[0].DatabaseName === SPEC.target && h[0].IsCopyOnly && h[0].HasBackupChecksums, 'BACKUP_HEADER');
    const receipt = { patchId, target: SPEC.target, file, guid: h[0].BackupSetGUID, bytes: String(h[0].BackupSize), verified: true, restoreExecuted: false, at: new Date().toISOString() };
    save('backup-receipt.json', receipt); console.log(JSON.stringify(receipt));
  } else if (mode === '--verify') {
    const result = await verify(request);
    const marker = (await request().input('run', patchId).query('SELECT run_name,status,target_database FROM dbo.migration_runs WHERE run_name=@run')).recordset;
    requireRule(marker.length === 1 && marker[0].status === 'COMMITTED_OPENING_PATCH_REVIEW_REMAINS', 'COMMIT_MARKER_REQUIRED');
    const receipt = { ...result, committed: true, rolledBack: false, marker: marker[0] };
    save('verification-' + Date.now() + '.json', receipt); console.log(JSON.stringify(receipt));
  } else {
    const backup = read('backup-receipt.json');
    requireRule(backup.verified && backup.target === SPEC.target && backup.patchId === patchId, 'VERIFIED_PATCH_BACKUP_REQUIRED');
    const prior = (await request().input('run', patchId).query('SELECT id FROM dbo.migration_runs WHERE run_name=@run')).recordset;
    if (prior.length) {
      const result = await verify(request);
      save('idempotency-' + Date.now() + '.json', { ...result, additionalWrites: 0 });
      console.log(JSON.stringify({ patchId, idempotentNoOp: true, additionalWrites: 0, correctedAccounts: result.correctedAccounts, remainingDifferences: result.afterDifferenceAccounts }));
    } else {
      const tx = new sql.Transaction(pool); await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      const q = () => new sql.Request(tx); let committed = false;
      try {
        await q().query("SET XACT_ABORT ON; DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=N'VEGA2026_OPENING_TEST_PATCH',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000; IF @r<0 THROW 51000,'PATCH_LOCK_FAILED',1;");
        const original = read('plan.json'), fresh = await makePlan(q);
        requireRule(hash(fresh) === hash(original), 'TARGET_CHANGED_SINCE_BACKUP');
        requireRule(hash(await historyFingerprint(q)) === hash(read('history-before.json')), 'HISTORY_CHANGED_SINCE_BACKUP');
        requireRule((await protectedManifest(q)).hash === read('terminal-before.json').hash, 'TERMINAL_CHANGED_SINCE_BACKUP');
        const corrections = original.details.filter(d => d.status === 'DIFFERENT');
        requireRule(corrections.every(d => d.existingCorrectionCount === 0), 'EXISTING_PATCH_REQUIRES_REVIEW');
        for (const role of ['customer', 'supplier']) {
          const rows = corrections.filter(d => d.role === role).map(d => {
            const payload = { label: adjustmentLabel, effectiveDate: '2026-01-01', sourceSnapshot: original.sourceSnapshot, accountId: d.accountId, historical: d.historical, alreadyEffectiveOpening: d.alreadyEffectiveOpening, before: d.before, expected: d.expected, correction: d.requiredCorrection, sources: d.sources };
            return { ...d, payload: JSON.stringify(payload), payloadHash: hash(payload), headerKey: d.sources[0].headerKey };
          });
          await q().input('json', sql.NVarChar(sql.MAX), JSON.stringify(rows)).input('run', patchId).input('label', adjustmentLabel).query(`
INSERT dbo.${role}_movements (${role}_id,movement_type,amount,currency_code,balance_effect,document_date,account_currency,account_amount,party_entity_id,party_currency_account_id,balance_effect_exact,affects_balance,source_record_key,migration_run_id,source_payload_hash,source_payload_json,source_document_key,original_document_date,source_document_no,source_notes)
SELECT partyId,N'vega_journal',ABS(delta),currency,delta,'20260101',currency,ABS(delta),partyEntityId,accountId,delta,1,correctionKey,@run,payloadHash,payload,headerKey,N'2026-01-01',@label,@label
FROM OPENJSON(@json) WITH(partyId bigint,partyEntityId bigint,accountId bigint,currency nvarchar(3),delta decimal(28,8) '$.requiredCorrection',correctionKey nvarchar(250),payloadHash char(64),payload nvarchar(max),headerKey nvarchar(250));`);
        }
        const links = corrections.flatMap(d => d.sources.map(s => ({ key: 'OPENING2026-LINK/' + hash(d.correctionKey + '/' + s.sourceKey), origin: d.correctionKey, related: s.sourceKey, amount: s.effect, currency: d.currency, header: s.headerKey })));
        await q().input('json', sql.NVarChar(sql.MAX), JSON.stringify(links)).input('run', patchId).query(`INSERT dbo.document_links(origin_source_key,related_source_key,relation_type,amount_source,currency_code,source_record_key,migration_run_id,source_document_key)
SELECT origin,related,N'VEGA_2026_OPENING_ALIGNMENT',amount,currency,[key],@run,header FROM OPENJSON(@json) WITH(origin nvarchar(250),related nvarchar(250),amount decimal(28,8),currency nvarchar(3),[key] nvarchar(250),header nvarchar(250));`);
        const reviews = original.details.filter(d => !d.sources).map(d => ({ key: 'OPENING2026-REVIEW/ACCOUNT/' + d.accountId, reason: 'NO_EXPLICIT_2026_OPENING', related: null, detail: JSON.stringify(d) }))
          .concat(original.rejected.map(d => ({ key: 'OPENING2026-REVIEW/SOURCE/' + hash(d.sourceKey), reason: d.reason, related: d.sourceKey, detail: JSON.stringify(d) })));
        await q().input('json', sql.NVarChar(sql.MAX), JSON.stringify(reviews)).input('run', patchId).query(`INSERT dbo.migration_decisions(record_type,reason,status,details_json,source_record_key,migration_run_id,related_source_key)
SELECT N'2026_opening_balance',reason,N'UNRESOLVED',detail,[key],@run,related FROM OPENJSON(@json) WITH(reason nvarchar(120),detail nvarchar(max),[key] nvarchar(250),related nvarchar(250));`);
        await q().input('json', sql.NVarChar(sql.MAX), JSON.stringify(corrections)).query(`UPDATE a SET current_balance=a.current_balance+j.delta,balance_status=N'VEGA_2026_OPENING_ALIGNED_PENDING_INDEPENDENT_VERIFICATION'
FROM dbo.party_currency_accounts a JOIN OPENJSON(@json) WITH(accountId bigint,delta decimal(28,8) '$.requiredCorrection') j ON a.id=j.accountId;`);
        for (const role of ['customer', 'supplier']) {
          await q().input('json', sql.NVarChar(sql.MAX), JSON.stringify(corrections.filter(d => d.role === role))).query(`UPDATE p SET balance=COALESCE(x.balance,0) FROM dbo.${role}s p CROSS APPLY(SELECT SUM(CONVERT(decimal(28,8),CASE WHEN m.affects_balance=0 THEN 0 ELSE COALESCE(m.balance_effect_exact,m.balance_effect) END)) balance FROM dbo.${role}_movements m WHERE m.${role}_id=p.id AND COALESCE(m.account_currency,m.currency_code)=p.currency_code)x WHERE p.id IN(SELECT partyId FROM OPENJSON(@json) WITH(partyId bigint,currency nvarchar(3)) WHERE currency=p.currency_code);`);
        }
        const result = await verify(q);
        const receipt = { ...result, committed: true, rolledBack: false, backupGuid: backup.guid, status: 'COMMITTED_OPENING_PATCH_REVIEW_REMAINS' };
        await q().input('run', patchId).input('target', SPEC.target).input('receipt', sql.NVarChar(sql.MAX), JSON.stringify(receipt)).query(`INSERT dbo.migration_runs(run_name,status,target_database,source_snapshot,start_date,finished_at,receipt_json,source_record_key,migration_run_id) VALUES(@run,N'COMMITTED_OPENING_PATCH_REVIEW_REMAINS',@target,N'spec-20260917-01','20260101',SYSUTCDATETIME(),@receipt,N'RUN/'+@run,@run);`);
        await tx.commit(); committed = true;
        save('commit-receipt.json', receipt); console.log(JSON.stringify(receipt));
      } catch (e) {
        if (!committed) { try { await tx.rollback(); } catch {} }
        throw e;
      }
    }
  }
} finally { await pool.close(); }
