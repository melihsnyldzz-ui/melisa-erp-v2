# Sprint 037 - Backup Restore Evidence Log

Date: 2026-07-09

Owner: Codex

Reviewer: ChatGPT

Approver: Melih

## Goal

Create a practical, secret-safe evidence log shell for backup and restore verification.

## Completed Scope

- Created `docs/erp-v2/backup-restore-evidence-log.md`.
- Added required evidence fields for backup creation, `RESTORE VERIFYONLY`, staging restore and restore smoke.
- Marked all real verification areas as pending.
- Kept backup, restore, reset, migration, cleanup and production deploy actions approval-gated.
- Updated ERP status and roadmap references.
- Added static smoke coverage so the evidence log stays connected to the final ERP smoke pack.

## Explicitly Not Executed

- No SQL backup was created.
- No `RESTORE VERIFYONLY` was executed.
- No database restore was executed.
- No reset, cleanup, migration or destructive SQL was executed.
- No import apply was executed.
- No production deploy was executed.
- No WhatsApp or external message was sent.

## Acceptance Result

Accepted as a documentation and safety-control sprint.

Backup/restore remains pending until a separately approved real verification run records evidence in the log.

## Tests Run

```text
npm.cmd --prefix apps\web-admin run smoke:backup-restore-evidence
npm.cmd --prefix apps\web-admin run build
npm.cmd --prefix apps\web-admin run smoke:final-erp
```

Result:

- Backup/restore evidence log smoke passed: 9 passed, 0 failed.
- Web-admin production build passed.
- Final ERP smoke pack passed: 24 passed, 0 failed, 1 warning, 1 skipped.

Notes:

- The live API read-only smoke warning was `Route not found` against `http://127.0.0.1:4100`; this remains a warning because the final smoke pack can run without a live API in static/build verification mode.
- Controlled write smoke remained skipped because `FINAL_ERP_WRITE_SMOKE_APPROVED` was not true.

## Next Recommended Sprint

```text
Plan P1 Backup Restore Dry-Run Preflight.
```

This should review exact backup/restore commands and environment names without executing real backup, restore, reset, migration, or production deploy actions unless a separate exact approval is provided.
