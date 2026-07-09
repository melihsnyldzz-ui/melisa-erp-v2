# Melisa ERP v2 Approved Backup Restore Verification Run

Date: 2026-07-09

Purpose: define the exact execution packet for the first real backup/restore verification run.

This document prepares the run. It does not by itself approve or execute SQL backup, `RESTORE VERIFYONLY`, database restore, reset, cleanup, migration, import apply, production deploy, or destructive SQL actions.

## Current Decision

Status: Waiting for exact execution approval.

The previous approval message was not enough to execute a real backup/restore run because it did not name the exact target and allowed actions.

## Required Exact Approval

Before execution, Melih must approve with this exact meaning:

```text
I approve the backup/restore verification run for MELISA_ERP_V2.
Allowed actions:
- create SQL backup for MELISA_ERP_V2
- run RESTORE VERIFYONLY on the created backup
- restore only to MELISA_ERP_V2_RESTORE_TEST
- run read-only restore smoke against staging/test API
Not approved:
- production restore
- reset
- cleanup
- migration
- production deploy
- WhatsApp/external sending
```

If any part of the approval is missing or ambiguous, do not execute.

## Run Scope

| Area | Allowed after exact approval | Not allowed |
|---|---:|---|
| Create SQL backup | Yes | Backup of unrelated DBs |
| Verify backup file | Yes | Exposing backup contents |
| Restore to test DB | Yes | Restoring over production DB |
| Read-only smoke | Yes | Write smoke unless separately approved |
| Production restore | No | Always separate approval |
| Reset/cleanup/migration | No | Always separate approval |
| Production deploy | No | Always separate approval |

## Target Names

| Purpose | Required value |
|---|---|
| Source database | `MELISA_ERP_V2` |
| Restore-test database | `MELISA_ERP_V2_RESTORE_TEST` |
| Excluded database families | Vega and unrelated SQL Server databases |
| Backup storage | Restricted path outside Git |
| Evidence file | `docs/erp-v2/backup-restore-evidence-log.md` |

## Execution Checklist

### Step 0 - Pre-Execution Confirmation

Confirm before running anything:

- Exact approval text is present.
- SQL Server host label is known.
- Backup storage class is known.
- Backup destination is outside Git.
- Operator is known.
- Restore target is `MELISA_ERP_V2_RESTORE_TEST`.
- Production API is not pointed at the restore-test DB.
- No secret will be printed or committed.

### Step 1 - Create Backup

Command shape:

```powershell
cd apps\api
node scripts\backup-reset-melisa-db.mjs --backup --execute --confirm=MELISA_ERP_V2_BACKUP_AL
```

Record:

- Date/time.
- Operator.
- Host/environment.
- Backup file name.
- Backup file size.
- Backup storage class.
- Retention rule.

### Step 2 - Verify Backup File

Command shape:

```sql
RESTORE VERIFYONLY FROM DISK = N'[backup-file-path]';
```

Record:

- VERIFYONLY result.
- Error summary if failed, without secrets.
- Date/time.
- Operator.

### Step 3 - Restore To Test Database

Restore target:

```text
MELISA_ERP_V2_RESTORE_TEST
```

Record:

- Restore target database.
- Restore result.
- Whether the DB is online.
- Whether core counts are plausible.
- Whether users/roles are present.
- Whether latest audit date is plausible.

### Step 4 - Read-Only Restore Smoke

Run only against staging/test API that points to `MELISA_ERP_V2_RESTORE_TEST`.

Record:

- Staging API base URL.
- Confirmed DB target.
- Health result.
- SQL health result.
- Login/logout result.
- Product list read result.
- Customer list read result.
- Supplier list read result.
- Dashboard summary result.
- Monitoring summary result.

## Evidence Entry Draft

Use this draft in `backup-restore-evidence-log.md` only after a real approved run begins:

```text
Backup Restore Evidence Entry
Entry ID: BRE-20260709-001
Date/time:
Operator:
Approval reference:
Host/environment:
Source database: MELISA_ERP_V2
Backup action approved: yes
Restore action approved: yes
Backup file name:
Backup file size:
Backup storage class:
Retention rule:
VERIFYONLY result:
Restore target database: MELISA_ERP_V2_RESTORE_TEST
Restore result:
Staging API base URL:
Staging API DB target confirmed:
Read-only smoke command:
Read-only smoke result:
Write smoke approved: no
Write smoke result: not run
Warnings:
Stop condition triggered:
Decision:
Next action:
```

## Stop Conditions

Stop immediately if:

- Exact approval is missing.
- Target database is ambiguous.
- Backup command targets anything other than `MELISA_ERP_V2`.
- Restore target is anything other than `MELISA_ERP_V2_RESTORE_TEST`.
- Restore would overwrite production.
- Restore target is a Vega database.
- Backup destination is inside Git.
- Any command would print credentials, `.env.local`, SQL password, JWT secret, or connection string.
- `RESTORE VERIFYONLY` fails.
- Staging restore fails.
- API points to the wrong database.
- Smoke has failed checks.

## Current Status

Not executed.

The system is prepared for a real verification run, but execution is blocked until exact approval is provided.

## Next Safe Step

```text
Await Explicit Backup Restore Execution Approval.
```

If exact approval is provided, the next sprint can execute the allowed actions and fill the evidence log. If exact approval is not provided, continue with remaining non-destructive production readiness work.
