# Sprint 017 - ERP Core Read-Only Smoke Execution Report

Date: 2026-07-08
Status: Completed
Phase: ERP Core Validation
Owner: Codex
Approver: Melih

## Business Goal

Execute the safe read-only validation layer for the connected ERP Core path:
login, stock, purchase, sales, finance, and reports.

## Scope Completed

- Added a Sprint 017 read-only smoke checklist.
- Added a static smoke script that verifies route-level auth/permission guards
  and reporting read-only boundaries.
- Confirmed source-level evidence for login, stock, purchase, sales, finance,
  and reports.
- Confirmed protected commercial write endpoints remain approval-gated and out
  of this sprint's execution scope.
- Updated current status and roadmap references for Sprint 017 completion.

## Out Of Scope Honored

- No DB writes.
- No SQL migrations.
- No backup, restore, reset, cleanup, or destructive script execution.
- No controlled purchase, sales, finance, import, or terminal write smoke.
- No WhatsApp, SMS, email, catalog publishing, or external message sending.
- No production deployment.
- No secret, token, SQL credential, `.env.local`, or private business-data
  output.
- `.claude/` was not touched.

## Evidence Summary

- Login: `/auth/me` remains protected by `requireAuth`, and missing bearer token
  handling remains fail-closed.
- Stock: product read routes require `product.view`, while product mutation
  routes require edit/passive permissions.
- Purchase: purchase list/detail reads require `purchase.view`; draft,
  finalize, cancel, and draft update actions remain write-gated.
- Sales: sales list/detail reads require `sales.view`; draft, finalize, cancel,
  and draft update actions remain write-gated.
- Finance: read/report endpoints require finance/dashboard/customer permissions;
  collections, payments, account writes, cleanup, and standardization remain
  write-gated.
- Reports: management and periodic reporting endpoints require auth, expose
  assumptions/data-quality/row-limit metadata, and stay SELECT-only.

## Files Changed

- `docs/erp-v2/erp-core-read-only-smoke-sprint-017.md`
- `docs/erp-v2/erp-core-read-only-smoke-sprint-017-report.md`
- `docs/erp-v2/current-status.md`
- `docs/erp-v2/master-roadmap-v3.md`
- `scripts/sprint-017-erp-core-read-only-smoke.mjs`
- `apps/web-admin/package.json`

## Required Tests

- `npm.cmd --prefix apps/web-admin run smoke:erp-core-read-only`
- `node --check scripts/sprint-017-erp-core-read-only-smoke.mjs`
- `npm.cmd --prefix apps/web-admin run smoke:erp-core-path`
- `npm.cmd --prefix apps/web-admin run build`

## Test Results

- Sprint 017 read-only smoke: 17/17 PASS.
- Sprint 017 smoke syntax check: PASS.
- Sprint 016 smoke regression: 7/7 PASS.
- Sprint 016 smoke syntax check: PASS.
- Web-admin build: PASS, with existing Vite warnings for ignored
  `lucide-react` module directives and large chunk size.

## Human Approval Used

No risky action required approval in this sprint because the completed scope was
documentation and static/read-only validation only.

Explicit approval is still required before any live DB write, migration,
backup/restore/reset, cleanup, production deploy, public publishing,
permission/auth change, finance/inventory/customer/business action, or external
message sending.

## Next Sprint Recommendation

Sprint 018 - Controlled ERP Core Write Smoke Approval Plan.

Reason: Sprint 017 confirms the read-only gate. The next practical step is to
prepare, but not execute, a controlled write-smoke approval plan for purchase,
sales, and finance that names the target environment, QA records, rollback or
reversal expectations, and evidence requirements.
