# Sprint 014 - Reporting And Decision Support

Date: 2026-07-08
Status: Completed
Phase: Intelligence
Owner: Codex
Approver: Melih

## Business Goal

Turn trusted ERP data into useful management reports while keeping report outputs tied to visible assumptions, data-quality checks, permissions, and human review boundaries.

## Scope Completed

- Added explicit assumptions to management and periodic reporting API payloads.
- Added data-quality review notes and row-limit metadata for reporting sections.
- Made the management report UI show report assumptions, data-quality checks, approval boundaries, and periodic report assumptions.
- Included report assumptions and review boundaries in management report export rows.
- Added a Sprint 014 static smoke test for reporting endpoints, read-only boundaries, UI visibility, and export inclusion.
- Added a reporting runbook.

## Out Of Scope Honored

- No DB writes.
- No SQL migrations.
- No backup, restore, reset, cleanup, or destructive script execution.
- No WhatsApp or external message sending.
- No production deployment.
- No official accounting claims.
- No AI-generated decisions or automated recommendations.
- `.claude/` was not touched.

## Reporting Boundaries

- Reports are operational ERP decision support, not official accounting output.
- Sales and purchase report totals use finalized documents unless a section explicitly displays draft or cancelled counts.
- Customer and supplier balances should be checked against statements before collection, payment, purchasing, or risk decisions.
- Negative stock and average-cost stock valuation require operator review.
- Supplier performance remains directional until supplier attribution, purchase history, product movement, and margin are reviewed together.

## Files Changed

- `apps/api/src/services/dashboardService.js`
- `apps/web-admin/src/modules/reports/ManagementReportsScreen.jsx`
- `apps/web-admin/src/styles/erp-modern.css`
- `apps/web-admin/package.json`
- `scripts/sprint-014-reporting-decision-support-smoke.mjs`
- `docs/erp-v2/reporting-runbook.md`
- `docs/erp-v2/reporting-decision-support-sprint-014-report.md`
- `docs/erp-v2/current-status.md`
- `docs/erp-v2/master-roadmap-v3.md`

## Required Tests

- `npm.cmd --prefix apps/web-admin run smoke:reporting`
- `node --check apps/api/src/services/dashboardService.js`
- `node --check scripts/sprint-014-reporting-decision-support-smoke.mjs`
- `npm.cmd --prefix apps/web-admin run build`

## Human Approval Used

No risky action required approval in this sprint because the completed scope was source, UI, smoke, and documentation only.

Explicit approval is still required before any live DB write, migration, backup/restore/reset, cleanup, production deploy, or external message sending.

## Next Sprint Recommendation

Sprint 015 - AI And Automation Readiness.

Reason: Reporting now exposes operational assumptions and data-quality limits. The next safe step is to document AI read/write boundaries and approval rules before any AI-assisted automation is implemented.

