# Sprint 039 - Approved Backup Restore Verification Run Packet

Date: 2026-07-09

Owner: Codex

Reviewer: ChatGPT

Approver: Melih

## Goal

Prepare the exact execution packet for the real backup/restore verification run without executing risky actions.

## Completed Scope

- Created `docs/erp-v2/approved-backup-restore-verification-run.md`.
- Documented the exact approval wording required before execution.
- Defined the allowed actions and explicitly excluded production restore, reset, cleanup, migration, deploy and external sending.
- Confirmed the required source database and restore-test database names.
- Added the execution checklist for backup creation, `RESTORE VERIFYONLY`, restore-test DB and read-only smoke.
- Added evidence-entry draft text for `backup-restore-evidence-log.md`.
- Added static smoke coverage for the approval packet.

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

The real backup/restore verification run remains blocked until exact execution approval is provided.

## Tests Run

```text
npm.cmd --prefix apps\web-admin run smoke:backup-restore-approved-run
npm.cmd --prefix apps\web-admin run build
npm.cmd --prefix apps\web-admin run smoke:final-erp
```

Result:

- Approved backup/restore verification run smoke passed: 11 passed, 0 failed.
- Web-admin production build passed.
- Final ERP smoke pack passed: 26 passed, 0 failed, 1 warning, 1 skipped.

Notes:

- The live API read-only smoke warning was `Route not found` against `http://127.0.0.1:4100`; this remains a warning because the final smoke pack can run without a live API in static/build verification mode.
- Controlled write smoke remained skipped because `FINAL_ERP_WRITE_SMOKE_APPROVED` was not true.

## Next Recommended Step

```text
Await Explicit Backup Restore Execution Approval.
```

If exact approval is provided, the next sprint can execute only the explicitly allowed backup/restore verification actions and record evidence.
