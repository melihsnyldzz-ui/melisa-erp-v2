# DB9 K12 backup and separate restore

Source preparation only. This helper has not connected to SQL Server, created a
backup, restored a database or established K12 acceptance. Root is the sole
operational owner. Source review, exact current CI and explicit Root execution
remain separate gates. Do not run the old DB5 `restore-first-sale-drill.ps1`.

The new source has two explicit modes, `Preflight` and `BackupRestore`. The core
contains declarations only; the runner can be dot-sourced without invoking its
operational body. The test extracts production definitions and uses in-memory
readers and phase faults. It never invokes `Recovery-Run`, an OS probe, connection
Open, backup, restore or a credential interface.

## Fixed boundaries

- Source: `Semih\MELISAERP`, DB9
  `MELISA_ERP_SCHEMA_REHEARSAL_20261107_K0210`, GUID
  `6d773db9-bd69-4906-b791-d63a490ab1f2`, creation timestamp
  `2026-11-10T11:10:18.030`, environment
  `287f689a-43bb-43dd-950b-adb615fcb20c`, schema7,43tables,502columns,
  actualT1=false, externalOperations=false. Xaser Windows SID, original SQL SID,
  sysadmin, Shared memory, SQL PID4924 and exact birth/path are checked.
- The D70e runtime manifest D243 and admission95c36 are fixed in the source;
  every manifest source/helper/asset is held read-only and hash-checked. The
  helper does not change runtime files, services or application state.
- Both application owner lock files must already exist and are held NoShare;
  application listeners/processes and other source-DB sessions cause rejection.
- Separate name only: `MELISA_ERP_DB9_RESTORE_20261111_CA3526AE`. Backup/MDF/LDF
  names and operation ID are fixed by `Recovery-Names`, matching the readiness
  report. SQL defaults must match the historical instance directories exactly;
  all parents must exist without reparse points, all destinations must be absent
  in the filesystem and SQL catalog. No silent redirection or reservation.
- Final Role application is a prerequisite: Root supplies the real applied
  receipt and final public native business snapshot by exact path/SHA. The
  expected counts7users/7roles/58permissions are mandatory. IDs, rowversions and
  policy values are not invented in this source.

## Root public decision contract

Root prepares the following fixed A-only filename for the selected mode:
`db9-firstsale-recovery-decision-preflight-20261111.json` or
`db9-firstsale-recovery-decision-backuprestore-20261111.json`.
No decision is created by source tests. All `sha256` fields below must be actual
fresh SHA256 digests; the text below is a contract, not an executable decision.

| Field | Required value |
|---|---|
| version | 1 |
| mode | exact requested mode |
| operationId | fixed readiness operation `ca3526ae-6d32-41f3-b05d-514578d1dc2c` |
| authorizedBy | `ROOT_SEQUENTIAL_OWNER` |
| postRoleBindingsConfirmed | true, after actual Role application is reconciled |
| target | exact object returned by `Recovery-Target` |
| runtimeSourceHead | `70e8ec1584369eeb1aae9a76a5285509cd127d7b` |
| personnelExpected | users7, roles7, permissions58 |
| runnerSha256/coreSha256 | exact reviewed source file digests, also supplied as CLI pins |
| roleAppliedReceipt/finalNativeSnapshot | A-only JSON references `{path,sha256}` to real post-Role evidence |
| independentSourceReview | A-only JSON reference; `decision=GO_SOURCE_ONLY`, numeric `P1P2Findings=0`, `files.core`/`files.runner` exact source hashes |
| preflight | BackupRestore only: exact successful Preflight result reference |
| preflightClosed | BackupRestore only: exact paired Preflight `-closed.json` path/SHA reference; same operation/mode/result path and SHA, decision/source pins, both connection methods and actual lock/hold releases must have succeeded |

The runner also requires `ExpectedSelfSha256`, `ExpectedCoreSha256` and
`ExpectedDecisionSha256` arguments. Source and decision files are held read-only
before connecting. The frozen review and Root decision are the authorization
boundary; a historical readiness report alone does not authorize execution.

## Finite operational order (not executed)

1. Validate all public pins, Windows identity, SQL process lifetime, app-offline
   state, both NoShare locks and admitted runtime closure. CreateNew a durable
   mode claim before opening the integrated connection.
2. Preflight performs persistent SQL writes0. It reads current defaults, exact
   two-file layout, logical D/L names, file sizes and43PK coverage. It requires
   four source file footprints plus2GiB free on C:. It returns all43 PK-ordered
   count/SHA256 fingerprints plus schema/database-security/server-security hashes.
   All full rows, including credentials/tokens/audit bodies, stay inside native
   SQL `FOR JSON`/`HASHBYTES`; result rows contain counts and digests only.
3. Root binds that actual preflight result into a separate reviewed BackupRestore
   decision. Immediately before backup the helper repeats all preflight checks,
   exact layout and43-table/metadata equality. It never wraps BACKUP/RESTORE in a
   user transaction. Every nontransactional phase gets a flushed CreateNew intent
   before submission and a separate CreateNew command-return record.
4. BACKUP uses COPY_ONLY, CHECKSUM, NO_COMPRESSION, NOINIT, NOSKIP and unique exact
   NAME/MEDIANAME. HEADERONLY must show exactly one undamaged full checksum copy-
   only set; LABELONLY exact single media family; FILELISTONLY exact logical D/L.
   VERIFYONLY checks checksums and a streaming SHA256 is recorded. The backup is
   held read-only through restore and final comparison; byte hashes are rechecked.
5. Recheck source, destination absence and media SHA. RESTORE only the separate
   name with exact two MOVE destinations, CHECKSUM, FILE1, MEDIANAME, RECOVERY and
   RESTRICTED_USER. No REPLACE, DROP, source mode change, source security change,
   automatic cleanup or application boot against the copy.
6. A distinct durable copy-isolation phase adds only DENY CONNECT TO public on
   the copy. Check exact copy name/new database ID/files/ONLINE restricted state,
   trusted constraints, explicit public deny and original writer HAS_DBACCESS=0.
   CHECKDB runs without REPAIR. Observe the copy GUID; do not assume source GUID.
7. Source-before == copy == source-after must match all43 full-table digests,
   counts, schema and security. Only the copy's new public CONNECT deny is
   excluded from the copy database-security comparison. Original invoice8,
   roles, permissions, stock and cari rows are included in full-table equality;
   no raw invoice/credential body is emitted. Server-security hashes must match.
8. Attempt Close and Dispose independently before releasing holds/locks, even if
   the first call fails. Record each method result, observed Closed state, actual
   hold/lock release counts and booleans in a separate CreateNew lifecycle record.
   It binds the same mode/operation, decision/source pins, result path/state/SHA.
   Any close/dispose/release failure is UNKNOWN_NO_RETRY, even when the other call
   closes the connection. A completed data result alone is insufficient. The
   BackupRestore validator itself rejects a missing, failed or mismatched paired
   Preflight lifecycle record; this is not deferred to an external Root check.

Timeout, lost response, partial result-record write, failed integrity check,
hash mismatch or collision stops the sequence. Keep all backup/copy/artifacts;
`UNKNOWN_NO_RETRY_RETAIN_ALL` does not claim SQL rollback. Root reconciles actual
state before any new plan. There is no automatic retry, deletion, source
overwrite, SQL service action or app restart. Successful SQL restore still does
not prove off-machine retention, restored-app boot or human acceptance.

## Source test

Run only `db9-firstsale-recovery.test.ps1` using the existing cached PowerShell
with `-NoProfile -NonInteractive`. It parses real source AST and calls extracted
production helpers with synthetic values. No dependency install is required.

Microsoft primary references for metadata and separate-destination syntax:
[LABELONLY](https://learn.microsoft.com/en-us/sql/t-sql/statements/restore-statements-labelonly-transact-sql),
[FILELISTONLY](https://learn.microsoft.com/en-us/sql/t-sql/statements/restore-statements-filelistonly-transact-sql),
[new-location restore](https://learn.microsoft.com/en-us/sql/relational-databases/backup-restore/restore-a-database-to-a-new-location-sql-server).
