# Sprint 016 - Full ERP Core Smoke Path Report

Date: 2026-07-08
Status: Completed
Phase: ERP Core Validation
Owner: Codex
Approver: Melih

## Business Goal

Define one connected ERP Core smoke path from login through stock, purchase,
sales, finance, and reports while keeping live commercial writes behind explicit
human approval.

## Scope Completed

- Defined the full ERP Core smoke checklist:
  `login -> stock -> purchase -> sales -> finance -> reports`.
- Split safe read-only checks from approval-gated write checks.
- Documented the commercial truth rules that the full path must protect.
- Added explicit approval boundaries for DB writes, migrations, import apply,
  backup/restore/reset, deployment, public publishing, and external messages.
- Added a Sprint 016 static smoke test for checklist, report, package script,
  roadmap, and current status coverage.
- Updated current ERP status and roadmap references for Sprint 016 completion.

## Out Of Scope Honored

- No DB writes.
- No SQL migrations.
- No backup, restore, reset, cleanup, or destructive script execution.
- No controlled purchase, sales, finance, import, or terminal write smoke.
- No WhatsApp, SMS, email, catalog publishing, or external message sending.
- No production deployment.
- No price, stock, finance, customer, supplier, permission, invoice, or import
  behavior change.
- `.claude/` was not touched.

## Full Path Boundary

The connected ERP Core path is now documented as a validation sequence. Static
and read-only checks may be run without special approval when they do not expose
secrets or private data. Any write check in purchase, sales, finance, import,
backup/restore/reset, migration, deployment, public publishing, or external
communication requires exact Melih approval for that run.

## Files Changed

- `docs/erp-v2/erp-core-smoke-path-sprint-016.md`
- `docs/erp-v2/erp-core-smoke-path-sprint-016-report.md`
- `docs/erp-v2/current-status.md`
- `docs/erp-v2/master-roadmap-v3.md`
- `scripts/sprint-016-erp-core-smoke-path-smoke.mjs`
- `apps/web-admin/package.json`

## Required Tests

- `npm.cmd --prefix apps/web-admin run smoke:erp-core-path`
- `node --check scripts/sprint-016-erp-core-smoke-path-smoke.mjs`

## Human Approval Used

No risky action required approval in this sprint because the completed scope was
documentation and static validation only.

Explicit approval is still required before any live DB write, migration,
backup/restore/reset, cleanup, production deploy, public publishing,
permission/auth change, finance/inventory/customer/business action, or external
message sending.

## Next Sprint Recommendation

Sprint 017 - ERP Core Read-Only Smoke Execution.

Reason: Sprint 016 defines the safe connected path. The next practical step is
to execute read-only local/API checks and collect evidence, while leaving
controlled commercial write checks behind a separate explicit approval gate.

