# Melisa ERP v2 Backup Restore Dry-Run Preflight

Date: 2026-07-09

Purpose: review the backup/restore command shapes, target names, evidence fields and stop gates before any real backup or restore verification run.

This is a dry-run preflight document. It does not approve or execute SQL backup, `RESTORE VERIFYONLY`, database restore, reset, cleanup, migration, import apply, production deploy, or destructive SQL actions.

## Current Decision

Status: Dry-run preflight ready.

Production readiness remains blocked until a separately approved real backup/restore verification run records evidence in `backup-restore-evidence-log.md`.

## Target Names

| Purpose | Name |
|---|---|
| Source ERP database | `MELISA_ERP_V2` |
| Restore test database | `MELISA_ERP_V2_RESTORE_TEST` |
| Excluded databases | Vega databases and any unrelated SQL Server databases |
| Default API verification mode | Staging/test API only |
| Production API usage | Not allowed during restore-test smoke |

## Human Inputs Required Before Real Run

These values must be confirmed by Melih or the operator before any real execution:

| Input | Required before execution | Notes |
|---|---:|---|
| SQL Server host name | Yes | Record host label only; do not paste credentials |
| Backup destination class | Yes | local/NAS/offsite/other |
| Backup destination path | Yes | Keep secret/private path out of Git and chat if sensitive |
| Backup retention rule | Yes | Example: daily 7 days, weekly 4 weeks |
| Backup operator | Yes | Human responsible for the run |
| Restore-test target name | Yes | Default: `MELISA_ERP_V2_RESTORE_TEST` |
| Staging API base URL | Yes | Must point to restore-test DB, not production |
| Rollback owner | Yes | Required before production readiness |

## Command Shapes Reviewed

### Backup Command Shape

Run only after explicit backup approval.

```powershell
cd apps\api
node scripts\backup-reset-melisa-db.mjs --backup --execute --confirm=MELISA_ERP_V2_BACKUP_AL
```

Required pre-checks:

- Confirm target database is `MELISA_ERP_V2`.
- Confirm output path is restricted and outside Git.
- Confirm no `.env.local` or connection string value will be printed.
- Confirm the operator understands this creates a real backup file.

### VERIFYONLY Command Shape

Run only after explicit restore verification approval.

```sql
RESTORE VERIFYONLY FROM DISK = N'[backup-file-path]';
```

Required pre-checks:

- Confirm backup file name and location.
- Confirm the command does not restore or overwrite a database.
- Confirm output is recorded without secrets.

### Staging Restore Command Shape

Run only after explicit restore verification approval.

Expected restore target:

```text
MELISA_ERP_V2_RESTORE_TEST
```

Required pre-checks:

- Confirm target is not `MELISA_ERP_V2`.
- Confirm target is not a Vega database.
- Confirm existing restore-test DB overwrite is approved if it already exists.
- Confirm production API is stopped or isolated from restore-test configuration.

## Dry-Run Checklist

| Check | Status |
|---|---|
| Source DB name confirmed | Pending real operator confirmation |
| Restore-test DB name confirmed | Pending real operator confirmation |
| Backup destination class confirmed | Pending real operator confirmation |
| Retention rule confirmed | Pending real operator confirmation |
| Operator confirmed | Pending real operator confirmation |
| Rollback owner confirmed | Pending real operator confirmation |
| Staging API URL confirmed | Pending real operator confirmation |
| Evidence log ready | Ready |
| Stop conditions reviewed | Ready |
| Real backup approved | Not approved |
| Real restore verification approved | Not approved |

## Evidence To Prepare Before Real Run

Before executing a real run, prepare one empty entry in `backup-restore-evidence-log.md` with:

- Entry ID.
- Operator.
- Approval reference.
- Host/environment.
- Source database.
- Backup destination class.
- Retention rule.
- Restore target database.
- Staging API base URL.

Do not fill backup result, restore result, file size, VERIFYONLY result, or smoke result until those steps are actually completed.

## Stop Conditions

Stop before execution if:

- The operator cannot confirm the SQL Server host.
- The target database name is ambiguous.
- The restore target is `MELISA_ERP_V2` but only staging verification is approved.
- The restore target is a Vega database.
- Backup destination is inside Git.
- The command would print credentials, `.env.local`, SQL password, JWT secret, or connection string.
- The operator is unsure whether the next action is backup, verify, restore, reset, migration, cleanup, or deploy.

## Required Approval For Next Real Run

The next sprint must not execute anything unless Melih gives a separate explicit approval like:

```text
I approve the backup/restore verification run for MELISA_ERP_V2.
Allowed actions:
- create SQL backup
- run RESTORE VERIFYONLY
- restore to MELISA_ERP_V2_RESTORE_TEST only
- run read-only restore smoke against staging/test API
Not approved:
- production restore
- reset
- cleanup
- migration
- production deploy
- WhatsApp/external sending
```

## Next Safe Step

```text
Plan P1 Approved Backup Restore Verification Run.
```

This next sprint can prepare the exact execution checklist and may run real backup/restore verification only if Melih gives exact explicit approval for the target and allowed actions.
