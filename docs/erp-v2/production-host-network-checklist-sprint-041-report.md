# Sprint 041 - Production Host Network Checklist

Date: 2026-07-09

Owner: Codex

Reviewer: ChatGPT

Approver: Melih

## Goal

Create a non-destructive production host and network checklist before deployment.

## Completed Scope

- Created `docs/erp-v2/production-host-network-checklist.md`.
- Defined host, owner, deployment operator, DB location, runtime mode and access-pattern decisions.
- Defined port, HTTPS, reverse proxy, CORS and access-policy checkpoints.
- Recorded production safety defaults.
- Added human sign-off template.
- Kept deployment, DNS, firewall, secrets, backup/restore, migration and production writes out of scope.
- Added static smoke coverage.

## Explicitly Not Executed

- No production deployment was executed.
- No DNS, firewall, reverse proxy or HTTPS setting was changed.
- No SQL backup was created.
- No `RESTORE VERIFYONLY` was executed.
- No database restore was executed.
- No reset, cleanup, migration or destructive SQL was executed.
- No import apply was executed.
- No WhatsApp or external message was sent.
- No secret values were read, printed or changed.

## Acceptance Result

Accepted as a documentation and safety-control sprint.

Production host/network readiness is now checklist-ready but still pending human confirmation.

## Tests Run

```text
npm.cmd --prefix apps\web-admin run smoke:production-host-network
npm.cmd --prefix apps\web-admin run build
npm.cmd --prefix apps\web-admin run smoke:final-erp
```

Result:

- Production host/network smoke passed: 10 passed, 0 failed.
- Web-admin production build passed.
- Final ERP smoke pack passed: 28 passed, 0 failed, 1 warning, 1 skipped.

Notes:

- The live API read-only smoke warning was `Route not found` against `http://127.0.0.1:4100`; this remains a warning because the final smoke pack can run without a live API in static/build verification mode.
- Controlled write smoke remained skipped because `FINAL_ERP_WRITE_SMOKE_APPROVED` was not true.

## Next Recommended Sprint

```text
Plan P1 Production Env Ownership Checklist.
```
