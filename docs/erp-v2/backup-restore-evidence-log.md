# Melisa ERP v2 Backup Restore Evidence Log

Date: 2026-07-09

Purpose: keep one secret-safe evidence record for backup and restore verification before Melisa ERP v2 is considered production-ready.

This document is an evidence shell. It does not approve or execute backup, restore, reset, cleanup, migration, import apply, production deploy, or destructive SQL actions.

## Current Decision

Status: Pending real verification.

ERP Core is accepted for final testing with warnings, but production readiness remains blocked until backup and restore are proven with evidence.

## Approval Boundary

The following actions require separate explicit Melih approval naming the exact target and action:

- SQL backup creation.
- `RESTORE VERIFYONLY`.
- Staging/test restore.
- Production restore.
- Backup/restore/reset script execution.
- Migration.
- Production deployment.

Routine sprint approval is not enough for these actions.

## Evidence Summary

| Evidence area | Status | Required before production |
|---|---:|---:|
| Backup command reviewed | Pending | Yes |
| Backup file created | Pending | Yes |
| Backup file size recorded | Pending | Yes |
| `RESTORE VERIFYONLY` passed | Pending | Yes |
| Staging restore completed | Pending | Yes |
| Staging API pointed to restore DB | Pending | Yes |
| Restore smoke passed | Pending | Yes |
| Backup retention owner recorded | Pending | Yes |
| Rollback owner recorded | Pending | Yes |

## Evidence Entry Template

Copy this block for each approved verification run.

```text
Backup Restore Evidence Entry
Entry ID: BRE-YYYYMMDD-001
Date/time:
Operator:
Approval reference:
Host/environment:
Source database:
Backup action approved: yes/no
Restore action approved: yes/no
Backup file name:
Backup file size:
Backup storage class: local/NAS/offsite/other
Retention rule:
VERIFYONLY result:
Restore target database:
Restore result:
Staging API base URL:
Staging API DB target confirmed: yes/no
Read-only smoke command:
Read-only smoke result:
Write smoke approved: yes/no
Write smoke result: not run / passed / failed
Warnings:
Stop condition triggered: yes/no
Decision: pending / pass / pass with warnings / fail
Next action:
```

## Required Evidence Details

### Backup Creation

Record:

- Date/time.
- Operator.
- Host/environment.
- Source database.
- Backup file name.
- Backup file size.
- Retention rule.

Do not record:

- SQL password.
- Connection string.
- `.env.local` contents.
- Secret path segments.
- Backup file contents.

### VERIFYONLY

Record:

- Backup file name.
- Result: passed or failed.
- Error summary if failed.
- Operator.
- Date/time.

Minimum command shape:

```sql
RESTORE VERIFYONLY FROM DISK = N'[backup-file-path]';
```

### Staging Restore

Expected restore target:

```text
MELISA_ERP_V2_RESTORE_TEST
```

Record:

- Restore target database.
- Restore result.
- Whether the DB is online.
- Whether core table counts are plausible.
- Whether users/roles are present.
- Whether the latest audit date is plausible.

### Restore Smoke

Run only against the staging/restore-test environment.

Record:

- API base URL.
- Confirmed DB target.
- `/api/health` result.
- `/api/sql/health` result.
- Login/logout result.
- Product list read result.
- Customer list read result.
- Supplier list read result.
- Dashboard summary result.
- Monitoring summary result for an authorized user.
- Web-admin stock/customer/supplier list result.

## Stop Conditions

Stop and mark the entry as failed if:

- Target database is not confirmed.
- A command would restore over `MELISA_ERP_V2` without production restore approval.
- A command would touch Vega databases.
- A command would expose secrets.
- Backup file is missing, unexpectedly small, or inaccessible.
- `RESTORE VERIFYONLY` fails.
- Staging restore fails.
- API points to the wrong database.
- Smoke has failed checks.
- Operator is unsure whether the action is backup, restore, reset, migration, or deploy.

## Production Readiness Rule

Production readiness cannot pass until this log contains at least one approved evidence entry with:

- Backup file created.
- `RESTORE VERIFYONLY` passed.
- Staging restore passed.
- Restore smoke passed.
- Retention owner recorded.
- Rollback owner recorded.

## Current Entries

No approved backup/restore verification entries are recorded yet.

## Next Safe Step

```text
Plan P1 Backup Restore Dry-Run Preflight.
```

The next sprint may review the exact commands, environment names, and evidence collection steps, but must not run backup, restore, reset, migration, or deployment actions unless Melih gives a separate explicit approval for that exact action and target.
