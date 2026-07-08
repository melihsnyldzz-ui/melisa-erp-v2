# Sprint 007 - Backup, Restore, And Reset Safety Report

Date: 2026-07-08
Phase: Operations
Status: Completed

## Business Goal

Protect Melisa ERP v2 from accidental data loss by documenting backup, restore, reset, and approval discipline before broader operational work continues.

## Scope Completed

- Reviewed Melisa OS, local AI rules, current ERP status, ERP roadmap, production checklist, and backup/restore plan.
- Reviewed the backup/reset script surface in `apps/api/scripts/backup-reset-melisa-db.mjs`.
- Confirmed the script targets `MELISA_ERP_V2` and has reset guards for target database, `--execute`, reset confirmation, and `SQL_READ_ONLY=false`.
- Added a backup execution guard so backup artifact creation now also requires `--execute` and `--confirm=MELISA_ERP_V2_BACKUP_AL`.
- Documented the operator runbook, approval points, and restore verification plan in `docs/erp-v2/backup-restore-plan.md`.
- Updated production readiness checklist backup and rollback criteria.
- Updated current status to recommend Sprint 008 next.

## Explicitly Not Performed

No SQL backup, restore, reset, cleanup, migration, production deploy, external message, or destructive script was run.

No `.env.local` values, SQL credentials, tokens, backup contents, or production data were exposed.

`.claude/` was not touched.

## Script Safety Review

Reviewed script:

- `apps/api/scripts/backup-reset-melisa-db.mjs`

Safety observations:

- `TARGET_DATABASE` is fixed to `MELISA_ERP_V2`.
- `assertTargetDatabase()` refuses any `SQL_DATABASE` other than `MELISA_ERP_V2`.
- Reset SQL includes a `DB_NAME()` guard.
- Reset and backup-reset remain locked behind `--execute --confirm=MELISA_ERP_V2_SIFIRLA`.
- Reset requires `SQL_READ_ONLY=false`.
- Backup now requires `--execute --confirm=MELISA_ERP_V2_BACKUP_AL`.
- Preview mode does not create a backup or reset data.

Remaining operator requirement:

- Restore itself is not automated here and must remain a human-approved SQL Server operator action, first verified on staging.

## Tests And Checks

- `node --check apps/api/scripts/backup-reset-melisa-db.mjs`
- `node apps/api/scripts/backup-reset-melisa-db.mjs --backup` expected locked failure before DB connection.
- `node apps/api/scripts/backup-reset-melisa-db.mjs --reset` expected locked failure before DB connection.
- `npm.cmd --prefix apps/web-admin run build`
- Documentation review against Sprint 007 acceptance criteria.
- `git status --short`

## Files Changed

- `apps/api/scripts/backup-reset-melisa-db.mjs`
- `docs/erp-v2/backup-restore-plan.md`
- `docs/erp-v2/production-readiness-checklist.md`
- `docs/erp-v2/current-status.md`
- `docs/erp-v2/backup-restore-reset-sprint-007-report.md`

## Acceptance Criteria Result

- Backup/restore runbook is clear: Completed.
- Reset scripts are documented as high risk: Completed.
- Human approval steps are explicit: Completed.
- Script target and guard review is recorded: Completed.
- No risky production operation was run without approval: Completed.

## Risks And Follow-up

| Risk | Status | Next action |
|---|---|---|
| Production restore has not been proven | Open | Run an approved staging restore test before production reliance |
| Backup artifact access can expose business data | Controlled by policy | Restrict storage and never commit/share backup files |
| Import/cleanup can still damage live data | Next sprint | Complete Sprint 008 Import And Cleanup Control |

## Next Sprint Recommendation

Recommended sprint: Sprint 008 - Import And Cleanup Control

Priority: P1

Reason: Backup/reset discipline is now documented and guarded; the next operational risk is import and cleanup writes that can affect stock, cari, finance, and audit data.
