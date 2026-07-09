# Melisa ERP v2 Backup Restore Verification Plan

Date: 2026-07-09

Purpose: define exactly how Melisa ERP v2 backup and restore confidence will be proven before production use.

This is a planning/checklist document. It does not approve or execute backup, restore, reset, cleanup, migration or production deploy actions.

## Current Status

Status: Not verified yet.

Reason:

- Backup/restore rules exist in `backup-restore-plan.md`.
- Backup/reset script safety guards exist.
- Production backup job has not been proven.
- `RESTORE VERIFYONLY` evidence is not recorded.
- Staging restore evidence is not recorded.
- Restore smoke evidence is not recorded.

## Verification Target

| Item | Required value |
|---|---|
| Source database | `MELISA_ERP_V2` |
| Restore test database | `MELISA_ERP_V2_RESTORE_TEST` or explicitly approved equivalent |
| Excluded database | Vega databases are not production backup/restore targets |
| Backup storage | Restricted local/NAS/offsite path outside Git |
| Restore environment | Staging/test only before any production restore |

## Approval Required

Backup and restore touch real business data. They require explicit Melih approval.

### Approval Shape For Backup Creation

```text
I approve creating a SQL backup for MELISA_ERP_V2.
Target: [local/test/production host name]
Backup destination: [restricted path, do not paste secret values]
No restore, reset, cleanup, migration or deploy is approved by this message.
```

### Approval Shape For Restore Verification

```text
I approve restore verification for MELISA_ERP_V2 backup.
Source backup: [backup file name only, no file contents]
Restore target: MELISA_ERP_V2_RESTORE_TEST
No production restore, reset, cleanup, migration or deploy is approved by this message.
```

### Approval Shape For Production Restore

```text
I approve production restore during the approved maintenance window.
Backup has passed VERIFYONLY and staging restore smoke.
Target: MELISA_ERP_V2
Services will be stopped or isolated.
Rollback owner: [name]
```

Production restore must not be approved casually.

## Verification Sequence

### Phase 1 - Backup Readiness Review

| Check | Expected evidence |
|---|---|
| Backup path selected | Restricted path recorded outside Git |
| Backup owner assigned | Human owner named |
| Retention policy selected | Days/months recorded |
| Backup command reviewed | Command shape recorded, not executed |
| Secret handling reviewed | No values in docs/chat/Git |

### Phase 2 - Approved Backup Creation

Run only after explicit approval.

Command shape:

```powershell
cd apps\api
node scripts\backup-reset-melisa-db.mjs --backup --execute --confirm=MELISA_ERP_V2_BACKUP_AL
```

Evidence to record:

| Evidence | Do record | Do not record |
|---|---|---|
| Backup file name | Yes | Full sensitive path if private |
| Backup date/time | Yes | Secret values |
| Backup size | Yes | File contents |
| Target database | `MELISA_ERP_V2` | SQL password |
| Operator | Yes | Connection string |

### Phase 3 - Verify Backup File

Run only after explicit approval.

Minimum SQL Server verification:

```sql
RESTORE VERIFYONLY FROM DISK = N'[backup-file-path]';
```

Evidence to record:

- Verification date/time.
- Backup file name.
- Result: passed or failed.
- Operator.
- Error message if failed, without secrets.

### Phase 4 - Staging Restore

Run only after explicit approval.

Restore target:

```text
MELISA_ERP_V2_RESTORE_TEST
```

Rules:

- Do not overwrite `MELISA_ERP_V2`.
- Do not restore to Vega DB.
- Do not point production API at the restore-test database.
- Use a staging API environment for restore smoke.

Evidence to record:

| Check | Expected |
|---|---|
| Restore DB online | Yes |
| Main tables exist | Yes |
| Users/roles exist | Yes |
| Product/customer/supplier counts are plausible | Yes |
| Latest audit date is plausible | Yes |
| Staging API points to restore DB | Yes |

### Phase 5 - Restore Smoke

Run against staging/restore-test only:

| Smoke | Expected |
|---|---|
| `/api/health` | OK |
| `/api/sql/health` | OK |
| Login/logout | OK |
| `/api/auth/me` | Requires token |
| Product list read | OK |
| Customer list read | OK |
| Supplier list read | OK |
| Dashboard summary | OK |
| Monitoring summary | OK for authorized user |
| Web-admin stock list | OK |
| Web-admin customer/supplier lists | OK |

Write smoke is not required for restore verification unless separately approved.

## Evidence Log Template

Copy this block into the sprint report or a dated operator evidence file after a real approved verification:

```text
Backup Restore Verification Evidence
Date:
Operator:
Approval reference:
Source database:
Backup file name:
Backup size:
VERIFYONLY result:
Restore target:
Restore result:
Staging API base URL:
Smoke summary:
Warnings:
Decision:
```

## Stop Conditions

Stop immediately if:

- Target DB is not `MELISA_ERP_V2`.
- Restore target is production when only staging verification was approved.
- Backup file is missing, unexpectedly small, or inaccessible.
- Any command would expose `.env.local`, SQL password, JWT secret or connection string.
- `RESTORE VERIFYONLY` fails.
- Staging restore fails.
- API points to the wrong DB.
- Smoke has failed checks.
- Operator is unsure whether the action is backup, restore, reset or deploy.

## Production Gate

ERP cannot be called production-ready until:

- Backup creation has passed.
- `RESTORE VERIFYONLY` has passed.
- Staging restore has passed.
- Restore smoke has passed.
- Backup retention and access policy are documented.
- Rollback owner is named.

## Next Safe Step

```text
Plan P1 Backup Restore Evidence Log.
```

This next sprint should create the evidence log shell and only run real backup/restore commands if Melih gives a separate explicit approval naming the exact action and target.
