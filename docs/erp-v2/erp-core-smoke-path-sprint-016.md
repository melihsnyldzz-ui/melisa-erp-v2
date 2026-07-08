# ERP Core Smoke Path - Sprint 016

Date: 2026-07-08
Status: Defined
Owner: Codex
Approver: Melih

## Purpose

Sprint 016 defines one connected ERP Core smoke path:

```text
login -> stock -> purchase -> sales -> finance -> reports
```

The goal is to make the validation path explicit before any live commercial write
checks are executed. This document is a checklist and approval boundary, not a
record of live DB write execution.

## Safety Boundary

The default Sprint 016 path is read-first.

No approval is required for static source checks, documentation checks, package
script checks, and read-only API health checks that do not expose secrets or
private data.

Explicit Melih approval is required before any step that creates, updates,
finalizes, cancels, imports, cleans, resets, restores, migrates, deploys,
publishes, sends an external message, or writes to SQL Server.

## Read-Only Checks

These checks can run without special approval when credentials and local services
are already configured safely:

| Step | Check | Evidence |
|---|---|---|
| Login | Confirm auth-protected endpoints reject missing/invalid tokens and documented local login flow exists | Auth route/source review or read-only API check |
| Stock | Confirm product search/list can return stock code, barcode, name, supplier, price/currency, and stock visibility metadata | Product API/source review or read-only list check |
| Purchase | Confirm purchase draft/finalize/cancel behavior is documented and write endpoints are protected | Purchase route/service/static review |
| Sales | Confirm sales draft/finalize/cancel behavior is documented and write endpoints are protected | Sales route/service/static review |
| Finance | Confirm collections/payments and movements are operational-finance only and protected | Finance route/service/static review |
| Reports | Confirm management reports show assumptions, data-quality notes, row limits, and non-official-accounting boundary | Reporting smoke/static review |

## Approval-Gated Write Checks

These checks must not run from this sprint without exact human approval for the
target database and run window:

| Step | Controlled write check | Approval requirement |
|---|---|---|
| Purchase | Create purchase draft, finalize it, verify stock increase and supplier movement, then cancel/reverse | Explicit Melih approval for controlled QA write |
| Sales | Create sales draft, finalize it, verify stock decrease and customer movement, then cancel/reverse | Explicit Melih approval for controlled QA write |
| Finance | Create collection/payment, verify customer/supplier movement and finance account impact, then reverse if supported | Explicit Melih approval for controlled QA write |
| Import | Preview/apply with QA rows only | Explicit Melih approval for import apply |
| Backup/restore/reset | Any execution or verification against a real database backup | Explicit Melih approval and target DB confirmation |
| Migration | Any SQL migration execution | Explicit Melih approval and target DB confirmation |

## Commercial Truth Rules

- Draft sales and purchase documents must not affect stock or cari movements.
- Finalized sales reduce stock and create customer commercial impact.
- Finalized purchases increase stock and create supplier commercial impact.
- Cancellations must reverse stock and ledger impact instead of deleting truth.
- Finance is operational finance, not official accounting.
- Reports are decision support and must show assumptions and review boundaries.
- Audit traceability is required for critical business operations.

## Full Path Checklist

- [x] Define the connected ERP Core smoke path.
- [x] Separate read-only checks from approval-gated write checks.
- [x] Tie purchase, sales, stock, finance, and reports to documented commercial truth.
- [x] Keep DB writes, migrations, backup/restore/reset, deploys, WhatsApp sending, and public publishing out of this sprint.
- [x] Add a static smoke test that guards the checklist, report, package script, roadmap, and current status references.

## Execution Notes

This sprint completes the checklist and static validation layer. It does not
prove that a live end-to-end write flow was executed. A later controlled QA
sprint can run the write path only after approval names the exact environment,
test data strategy, rollback/reversal expectations, and evidence to collect.

