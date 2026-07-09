# Sprint 027 Report: Final Testing Runbook And Operator Readiness

Date: 2026-07-09

Status: Completed

## Goal

Prepare ERP operators for controlled final human testing by defining the test order, safe read-only checks, approval-gated write checks, stop conditions, and evidence to record.

## Completed Scope

- Created `docs/erp-v2/final-testing-runbook.md`.
- Linked the final testing runbook from `docs/erp-v2/README.md`.
- Defined preflight checks for API, web-admin, SQL Server, terminal app, secrets, and smoke results.
- Defined safe read-only checks for login, navigation, stock, customer/supplier, sales/purchase lists, finance, reports, terminal health, settings, and definitions.
- Defined approval-gated write checks for purchase, sales, finance, settings, import apply, and terminal send.
- Listed actions that must not run during routine final testing.
- Added final testing stop conditions.
- Added evidence and done criteria for final testing.
- Added focused smoke coverage to keep the runbook and status references current.
- Added final-testing runbook smoke to the final ERP smoke pack.

## Out Of Scope

- No live DB writes.
- No controlled write smoke execution.
- No import apply.
- No terminal send.
- No backup, restore, reset, cleanup, archive, or migration.
- No production deploy.
- No WhatsApp or external message sending.
- No UI redesign.

## Tests

Checks run:

- `node --check scripts\final-testing-runbook-smoke.mjs`
- `npm.cmd --prefix apps\web-admin run smoke:final-testing-runbook`
- `npm.cmd --prefix apps\web-admin run build`
- `npm.cmd --prefix apps\web-admin run smoke:final-erp`

Result:

- Final testing runbook smoke: 9 passed, 0 failed.
- Web-admin production build: passed.
- Final ERP smoke pack: 21 passed, 0 failed, 1 warning, 1 skipped.
- Warning: live API read-only smoke returned route not found in the current local API context.
- Skipped: controlled write smoke because `FINAL_ERP_WRITE_SMOKE_APPROVED` was not enabled.

## Business Result

ERP now has a practical operator-facing final testing path. Melih and staff can test the ERP in a safe order, separate read-only review from approved writes, and stop when a real business-risk condition appears.

## Next Recommended Sprint

Plan P1 Post-Test Findings Fix Pass.
