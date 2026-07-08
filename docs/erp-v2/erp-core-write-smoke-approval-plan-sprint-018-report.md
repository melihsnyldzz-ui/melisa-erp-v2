# Sprint 018 - Controlled ERP Core Write Smoke Approval Plan Report

Date: 2026-07-08
Status: Completed
Phase: ERP Core Validation
Owner: Codex
Approver: Melih

## Business Goal

Prepare a controlled approval plan for ERP Core write-smoke execution across
purchase, sales, and finance without running any commercial writes.

## Scope Completed

- Added a Sprint 018 approval plan for controlled purchase, sales, and finance
  write smokes.
- Defined the exact approval requirements for target environment, run window, QA
  records, allowed write actions, evidence scope, reversal strategy, and stop
  conditions.
- Defined QA record and `QA-S018-` prefix strategy.
- Defined before/after evidence requirements that avoid secrets and private
  business data.
- Defined reversal expectations for purchase cancellation, sales cancellation,
  and finance reversal or retained QA evidence.
- Added a Sprint 018 static smoke test for plan/report/status/roadmap/package
  coverage.
- Updated current ERP status and roadmap references for Sprint 018 completion.

## Out Of Scope Honored

- No DB writes.
- No SQL migrations.
- No backup, restore, reset, cleanup, or destructive script execution.
- No controlled purchase, sales, finance, import, or terminal write smoke.
- No WhatsApp, SMS, email, catalog publishing, or external message sending.
- No production deployment.
- No secret, token, SQL credential, `.env.local`, or private business-data
  output.
- No price, stock, finance, customer, supplier, permission, invoice, import, or
  business-rule behavior change.
- `.claude/` was not touched.

## Approval Plan Summary

Controlled write execution is blocked until Melih gives run-specific approval
that names:

- Exact target environment/database.
- Run window and watcher.
- QA product, customer, supplier, and finance account strategy.
- Allowed purchase, sales, and finance write actions.
- Evidence that may be collected.
- Reversal or retention strategy for QA records.
- Stop conditions for mismatches, private data exposure, permission failures, or
  non-QA record touches.

Generic approval wording is not enough for DB write execution.

## Files Changed

- `docs/erp-v2/erp-core-write-smoke-approval-plan-sprint-018.md`
- `docs/erp-v2/erp-core-write-smoke-approval-plan-sprint-018-report.md`
- `docs/erp-v2/current-status.md`
- `docs/erp-v2/master-roadmap-v3.md`
- `scripts/sprint-018-erp-core-write-smoke-approval-plan-smoke.mjs`
- `scripts/sprint-017-erp-core-read-only-smoke.mjs`
- `scripts/sprint-016-erp-core-smoke-path-smoke.mjs`
- `apps/web-admin/package.json`

## Required Tests

- `npm.cmd --prefix apps/web-admin run smoke:erp-core-write-plan`
- `node --check scripts/sprint-018-erp-core-write-smoke-approval-plan-smoke.mjs`
- `npm.cmd --prefix apps/web-admin run smoke:erp-core-read-only`
- `npm.cmd --prefix apps/web-admin run smoke:erp-core-path`
- `npm.cmd --prefix apps/web-admin run build`

## Test Results

- Sprint 018 approval-plan smoke: 10/10 PASS.
- Sprint 018 smoke syntax check: PASS.
- Sprint 017 read-only smoke regression: 17/17 PASS.
- Sprint 017 smoke syntax check: PASS.
- Sprint 016 path smoke regression: 7/7 PASS.
- Sprint 016 smoke syntax check: PASS.
- Web-admin build: PASS, with existing Vite warnings for ignored
  `lucide-react` module directives and large chunk size.

## Human Approval Used

No risky action required approval in this sprint because the completed scope was
documentation and static validation only.

Explicit approval is still required before any live DB write, controlled
purchase/sales/finance smoke execution, migration, backup/restore/reset,
cleanup, production deploy, public publishing, permission/auth change,
finance/inventory/customer/business action, or external message sending.

## Next Sprint Recommendation

Sprint 019 - Controlled ERP Core Write Smoke Execution.

Reason: Sprint 018 now defines the approval plan. The next step is execution
only after Melih explicitly approves the target environment, QA records, allowed
write actions, evidence scope, and reversal strategy for that exact run.
