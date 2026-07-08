# Sprint 005 Report - Sales And Purchase Commercial Truth

Date: 2026-07-08
Owner: Codex
Reviewer: ChatGPT
Approver: Melih
Branch: `codex/erp-ui-modernization`

## Goal

Validate that sales and purchase documents behave as commercial truth:

- Draft documents do not affect stock or ledgers.
- Finalized purchase invoices increase stock, update cost and affect supplier balance.
- Finalized sales invoices decrease stock and affect customer balance.
- Cancelled invoices reverse their commercial effects.
- Duplicate finalize/cancel attempts are blocked.

## Scope

This sprint used isolated QA data created through the API:

- `SPR005-*` customer
- `SPR005-*` supplier
- `SPR005-*` product
- one purchase invoice
- one sales invoice

The smoke test leaves the QA records and cancelled invoices as audit evidence. Net product stock, customer balance and supplier balance return to zero at the end of the successful run.

## Result

Status: Passed

Smoke command:

```powershell
$env:MELISA_API_BASE_URL='http://127.0.0.1:4100'
node scripts/sprint-005-commercial-truth-smoke.mjs
```

Successful run stamp:

```text
SPR005-1783502171370
```

Created evidence:

| Entity | ID |
|---|---:|
| Customer | 141 |
| Supplier | 10307 |
| Product | 19481 |
| Sales invoice | 10004 |
| Purchase invoice | 10004 |

## Validated Behavior

| Check | Expected | Result |
|---|---|---|
| Product baseline | stock `0`, average cost `10` | Pass |
| Customer baseline | balance `0` | Pass |
| Supplier baseline | balance `0` | Pass |
| Purchase draft | no stock or supplier ledger effect | Pass |
| Purchase finalize | stock `3`, average cost `10`, supplier balance `30` | Pass |
| Purchase finalize ledger | `purchase_invoice` supplier movement exists | Pass |
| Duplicate purchase finalize | rejected with `409` | Pass |
| Sales draft | no stock or customer ledger effect | Pass |
| Sales finalize | stock `2`, customer balance `15` | Pass |
| Sales finalize ledger | `sales_invoice` customer movement exists | Pass |
| Duplicate sales finalize | rejected with `409` | Pass |
| Sales cancel | stock restored to `3`, customer balance restored to `0` | Pass |
| Sales cancel ledger | `sales_invoice_cancel` customer movement exists | Pass |
| Duplicate sales cancel | rejected with `409` | Pass |
| Purchase cancel | stock restored to `0`, average cost recalculated to `0` | Pass |
| Purchase cancel ledger | `purchase_invoice_cancel` supplier movement exists | Pass |
| Duplicate purchase cancel | rejected with `409` | Pass |

## Checks Run

```powershell
node --check scripts/sprint-005-commercial-truth-smoke.mjs
npm.cmd --prefix apps/web-admin run build
$env:MELISA_API_BASE_URL='http://127.0.0.1:4100'; node scripts/sprint-005-commercial-truth-smoke.mjs
```

Build notes:

- Web-admin production build passed.
- Vite reported existing bundle-size and `lucide-react` module directive warnings.

## Known Notes

- The API returns invoice statuses as uppercase values such as `FINALIZED` and `CANCELLED`; the smoke script accepts status values case-insensitively.
- A first smoke attempt failed only because the test expected lowercase status. The partially finalized QA purchase invoice was immediately cancelled through the API, restoring its isolated product stock and supplier balance.
- This sprint validates commercial behavior through API-level smoke. It does not replace a later full end-to-end UI workflow test.

## Definition Of Done

- Controlled API write smoke is repeatable.
- Draft/finalize/cancel effects are verified for sales and purchase.
- Stock, average cost, customer ledger and supplier ledger effects are covered.
- Duplicate commercial actions are guarded.
- Sprint result is documented.

## Next Recommended Sprint

Sprint 006 should focus on Finance Collections And Payments.

Business reason:

- Sales and purchase commercial truth now has API evidence.
- The next risk is whether cash/bank collection and payment operations correctly affect customer/supplier balances, finance account balances and reporting.
