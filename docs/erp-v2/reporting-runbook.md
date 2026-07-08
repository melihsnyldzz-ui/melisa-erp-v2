# Reporting Runbook

Date: 2026-07-08
Owner: Codex

## Purpose

This runbook defines how Melisa ERP v2 management reports should be read, checked, exported, and escalated.

Management reports are operational decision-support views. They are not official accounting, tax, payment, or audit-close reports.

## Report Surfaces

- Web-admin: `Raporlar / Yonetim Raporlari`
- API: `GET /api/dashboard/management-reporting`
- API: `GET /api/dashboard/periodic-accounting`
- Permission: `dashboard.view`

Both API surfaces are read-only SQL `SELECT` aggregate surfaces.

## Required Operator Review

Before using report numbers for business decisions, review:

- Date filters on periodic reports.
- Whether sales and purchase totals include finalized documents only.
- Customer and supplier statement details for high balances.
- Negative stock warnings before purchasing or catalog decisions.
- Average-cost based stock valuation before margin decisions.
- Import/opening-balance reconciliation status before finance decisions.

## Data Quality Boundaries

- Customer and supplier balance summaries use current ERP card balances.
- Periodic balance sections are current grouped balances, not historical period-close snapshots.
- TRY summaries for foreign-currency balances use the latest available currency rate.
- Top product, customer, supplier, and warning sections are intentionally capped.
- Supplier performance is directional until product attribution, purchase history, and sales margin are reviewed together.

## Approval Boundaries

Do not use reporting work to run:

- DB writes.
- SQL migrations.
- Import apply, cleanup, reset, restore, or backup execution.
- Production deploys.
- WhatsApp or other external message sending.
- Official accounting or payment decisions without human review.

Those actions require explicit Melih approval and the relevant safety runbook.

## Recommended Smoke

Run:

```powershell
npm.cmd --prefix apps/web-admin run smoke:reporting
```

For UI or shared report changes, also run:

```powershell
npm.cmd --prefix apps/web-admin run build
```

