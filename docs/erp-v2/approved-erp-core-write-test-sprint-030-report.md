# Sprint 030 Report - Approved ERP Core Write Test

Date: 2026-07-09
Owner: Codex
Reviewer: ChatGPT
Approver: Melih
Status: Completed

## Purpose

Sprint 030 validates the approved ERP Core write behavior against the local API and local QA database target. The goal is to prove that the main commercial write paths work together before final testing.

## Approval Used

Melih approved Sprint 030 execution for a controlled ERP Core write test.

Approved target:

- Local API: `http://127.0.0.1:4100`
- Local guarded database target: `MELISA_ERP_V2`
- QA-only records with prefix: `QA-S030-*`

Allowed actions:

- Create QA customer records.
- Create QA supplier records.
- Create QA product records.
- Create QA finance account records.
- Create purchase drafts and finalize them.
- Create sales drafts and finalize them.
- Cancel finalized sales and purchase invoices through ERP API endpoints.
- Create one QA customer collection.
- Create one QA supplier payment.

Not allowed and not performed:

- Real business record repair or cleanup.
- Direct SQL update/delete/repair.
- Migration.
- Backup, restore or reset.
- Production deploy.
- WhatsApp or external sending.
- Secret exposure.

## Command Run

```powershell
$env:MELISA_API_BASE_URL='http://127.0.0.1:4100'; node scripts\sprint-030-approved-erp-core-write-smoke.mjs
```

## Evidence

Smoke stamp:

```text
QA-S030-1783601204159
```

Reversal flow evidence:

| Item | Value |
|---|---|
| Customer ID | 148 |
| Supplier ID | 10314 |
| Product ID | 19486 |
| Finance account ID | 9 |
| Finance account code | `QA-S030-1783601204159-REV-KASA` |
| Sales invoice ID | 10009 |
| Purchase invoice ID | 10008 |

Finance flow evidence:

| Item | Value |
|---|---|
| Customer ID | 149 |
| Supplier ID | 10315 |
| Product ID | 19487 |
| Finance account ID | 10 |
| Finance account code | `QA-S030-1783601204159-FIN-KASA` |
| Sales invoice ID | 10010 |
| Purchase invoice ID | 10009 |
| Collection movement ID | 10018 |
| Payment movement ID | 10019 |

## Validated Behavior

The controlled write smoke passed.

Validated purchase behavior:

- Purchase draft did not affect product stock.
- Purchase draft did not affect supplier balance.
- Purchase finalize increased product stock by 2.
- Purchase finalize increased supplier balance by TRY 20.
- Supplier movement type `purchase_invoice` was visible.
- Purchase cancel reduced product stock back to 0 in the reversal flow.
- Purchase cancel cleared supplier balance back to 0 in the reversal flow.
- Supplier movement type `purchase_invoice_cancel` was visible.

Validated sales behavior:

- Sales draft did not affect product stock.
- Sales draft did not affect customer balance.
- Sales finalize reduced product stock by 2.
- Sales finalize increased customer balance by TRY 20.
- Customer movement type `sales_invoice` was visible.
- Sales cancel restored product stock by 2 in the reversal flow.
- Sales cancel cleared customer balance back to 0 in the reversal flow.
- Customer movement type `sales_invoice_cancel` was visible.

Validated finance behavior:

- Customer collection cleared the QA customer balance.
- Customer collection increased the QA finance account balance to TRY 20.
- Customer movement type `collection` was visible.
- Supplier payment cleared the QA supplier balance.
- Supplier payment cleared the QA finance account balance back to 0.
- Supplier movement type `payment` was visible.

Final expected QA state:

| Area | Expected |
|---|---|
| Reversal product stock | 0 |
| Reversal customer balance | 0 |
| Reversal supplier balance | 0 |
| Reversal QA finance account balance | 0 |
| Finance product stock | 0 |
| Finance customer balance | 0 |
| Finance supplier balance | 0 |
| Finance QA finance account balance | 0 |

## Tests Run

```powershell
node --check scripts\sprint-030-approved-erp-core-write-smoke.mjs
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4100/api/health
$env:MELISA_API_BASE_URL='http://127.0.0.1:4100'; node scripts\sprint-030-approved-erp-core-write-smoke.mjs
```

Additional final verification was run after documentation and smoke-script updates:

```powershell
npm.cmd --prefix apps\web-admin run build
npm.cmd --prefix apps\web-admin run smoke:final-erp
```

## Result

Sprint 030 is completed.

ERP Core write behavior has controlled QA evidence for purchase, sales, cancellation, reversal, collection and payment.

## Remaining Risk

This sprint validates the controlled local API path only. It does not prove production deployment, backup/restore, import apply, terminal field sync, WhatsApp sending, or official accounting readiness.

QA evidence records are retained intentionally for traceability.

## Next Recommended Sprint

```text
Plan P1 P0/P1 Findings Fix Pass.
```

Business reason:

- Approved ERP Core write behavior is now proven in the local QA path.
- The next practical step is to review final-testing findings and fix only evidence-backed P0/P1 issues before wider final testing.
