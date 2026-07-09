# Sprint 042 - Production Env Ownership Checklist

Date: 2026-07-09

Owner: Codex

Reviewer: ChatGPT

Approver: Melih

## Goal

Create a production environment ownership checklist without exposing or changing secret values.

## Completed Scope

- Created `docs/erp-v2/production-env-ownership-checklist.md`.
- Defined ownership groups for API runtime, CORS/request policy, SQL metadata, SQL credentials, JWT secrets, WhatsApp, web-admin, terminal and desktop config.
- Defined allowed and disallowed secret storage locations.
- Added owner sign-off template.
- Added stop conditions for secret exposure, public env misuse, WhatsApp enabling, local passwordless login and wrong SQL database.
- Kept all secret values out of docs, chat, Git and command output.
- Added static smoke coverage.

## Explicitly Not Executed

- No secret values were read, printed, generated, changed or committed.
- No production environment variables were created or modified.
- No production deployment was executed.
- No SQL backup was created.
- No `RESTORE VERIFYONLY` was executed.
- No database restore was executed.
- No reset, cleanup, migration or destructive SQL was executed.
- No import apply was executed.
- No WhatsApp or external message was sent.

## Acceptance Result

Accepted as a documentation and safety-control sprint.

Production env ownership is now checklist-ready but still pending human confirmation.

## Tests Run

```text
npm.cmd --prefix apps\web-admin run smoke:production-env-ownership
npm.cmd --prefix apps\web-admin run build
npm.cmd --prefix apps\web-admin run smoke:final-erp
```

Result:

- Production env ownership smoke passed: 11 passed, 0 failed.
- Web-admin production build passed.
- Final ERP smoke pack passed: 29 passed, 0 failed, 1 warning, 1 skipped.

Notes:

- The live API read-only smoke warning was `Route not found` against `http://127.0.0.1:4100`; this remains a warning because the final smoke pack can run without a live API in static/build verification mode.
- Controlled write smoke remained skipped because `FINAL_ERP_WRITE_SMOKE_APPROVED` was not true.

## Next Recommended Sprint

```text
Plan P1 Migration Rehearsal Checklist.
```
