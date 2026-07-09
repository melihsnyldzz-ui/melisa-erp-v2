# Sprint 038 - Backup Restore Dry-Run Preflight

Date: 2026-07-09

Owner: Codex

Reviewer: ChatGPT

Approver: Melih

## Goal

Prepare the backup/restore dry-run preflight so the real verification run can be approved and executed without ambiguity.

## Completed Scope

- Created `docs/erp-v2/backup-restore-dry-run-preflight.md`.
- Confirmed the intended source database name: `MELISA_ERP_V2`.
- Confirmed the intended restore-test database name: `MELISA_ERP_V2_RESTORE_TEST`.
- Documented backup command shape, `RESTORE VERIFYONLY` command shape and staging restore command expectations.
- Listed human inputs required before any real run.
- Defined stop conditions before backup, verify and restore actions.
- Added explicit approval wording for the next real verification run.
- Connected the preflight to the final ERP smoke pack through static smoke coverage.

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

The backup/restore process is now ready for a separate explicitly approved real verification run.

## Tests Run

```text
npm.cmd --prefix apps\web-admin run smoke:backup-restore-preflight
npm.cmd --prefix apps\web-admin run build
npm.cmd --prefix apps\web-admin run smoke:final-erp
```

Result:

- Backup/restore dry-run preflight smoke passed: 10 passed, 0 failed.
- Web-admin production build passed.
- Final ERP smoke pack passed: 25 passed, 0 failed, 1 warning, 1 skipped.

Notes:

- The live API read-only smoke warning was `Route not found` against `http://127.0.0.1:4100`; this remains a warning because the final smoke pack can run without a live API in static/build verification mode.
- Controlled write smoke remained skipped because `FINAL_ERP_WRITE_SMOKE_APPROVED` was not true.

## Next Recommended Sprint

```text
Plan P1 Approved Backup Restore Verification Run.
```

The next sprint may run real backup/restore verification only if Melih gives exact explicit approval naming the allowed actions and target database.
