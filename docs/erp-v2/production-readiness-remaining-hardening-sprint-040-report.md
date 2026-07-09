# Sprint 040 - Production Readiness Remaining Hardening

Date: 2026-07-09

Owner: Codex

Reviewer: ChatGPT

Approver: Melih

## Goal

Define the remaining non-destructive production readiness work while backup/restore execution waits for exact approval.

## Completed Scope

- Created `docs/erp-v2/production-readiness-remaining-hardening.md`.
- Separated remaining production readiness items into safe non-destructive checklist work.
- Kept backup/restore execution blocked until exact approval is provided.
- Defined a recommended sprint order for host/network, env ownership, migration rehearsal, SQL least privilege, permission sign-off, monitoring/log retention, terminal device acceptance and import safety.
- Added static smoke coverage.

## Explicitly Not Executed

- No SQL backup was created.
- No `RESTORE VERIFYONLY` was executed.
- No database restore was executed.
- No reset, cleanup, migration or destructive SQL was executed.
- No import apply was executed.
- No production deploy was executed.
- No WhatsApp or external message was sent.
- No secret values were read, printed or changed.

## Acceptance Result

Accepted as a documentation and safety-control sprint.

Production readiness can continue through non-destructive hardening while backup/restore execution waits for exact approval.

## Tests Run

```text
npm.cmd --prefix apps\web-admin run smoke:production-hardening
npm.cmd --prefix apps\web-admin run build
npm.cmd --prefix apps\web-admin run smoke:final-erp
```

Result:

- Production readiness hardening smoke passed: 9 passed, 0 failed.
- Web-admin production build passed.
- Final ERP smoke pack passed: 27 passed, 0 failed, 1 warning, 1 skipped.

Notes:

- The live API read-only smoke warning was `Route not found` against `http://127.0.0.1:4100`; this remains a warning because the final smoke pack can run without a live API in static/build verification mode.
- Controlled write smoke remained skipped because `FINAL_ERP_WRITE_SMOKE_APPROVED` was not true.

## Next Recommended Sprint

```text
Plan P1 Production Host Network Checklist.
```
