# Sprint 006 Report - Finance Collections And Payments

Date: 2026-07-08
Owner: Codex
Reviewer: ChatGPT
Approver: Melih
Branch: `codex/erp-ui-modernization`

## Goal

Validate that tahsilat and odeme entry is safe, traceable and understandable:

- A customer collection requires a selected customer.
- A supplier payment requires a selected supplier.
- Before/after cari balance impact is visible in the form.
- Saved transactions create the expected customer/supplier ledger movement.
- Saved transactions create the expected finance account movement.
- Finance account balances move in the expected direction.
- Audit rows exist for critical finance writes.

## Scope

This sprint reviewed and validated the existing finance API and web-admin finance entry screen:

- `POST /api/finance/collections`
- `POST /api/finance/payments`
- `GET /api/finance/accounts`
- `GET /api/finance/movements`
- `apps/web-admin/src/modules/finance/CollectionsOverviewScreen.jsx`
- `apps/web-admin/src/modules/finance/CollectionsEntryForm.jsx`
- `scripts/web-admin-finance-form-smoke.mjs`

The new API smoke creates isolated `SPR006-*` QA records through the API:

- one customer
- one supplier
- one customer collection
- one supplier payment

The records remain in the database as Sprint 006 audit evidence.

## Result

Status: Passed

Smoke command:

```powershell
$env:MELISA_API_BASE_URL='http://127.0.0.1:4100'
node scripts/sprint-006-finance-collections-payments-smoke.mjs
```

Successful run stamp:

```text
SPR006-1783508976139
```

Created evidence:

| Entity | ID |
|---|---:|
| Customer | 143 |
| Supplier | 10309 |
| Customer collection movement | 10008 |
| Supplier payment movement | 10009 |
| Finance account | `KASA-TRY` |

## Validated Behavior

| Check | Expected | Result |
|---|---|---|
| Collection without customer | rejected with `400` | Pass |
| Payment without supplier | rejected with `400` | Pass |
| Customer baseline | balance `0` | Pass |
| Supplier baseline | balance `0` | Pass |
| Collection customer balance | balance effect `-25`, balance becomes `-25` | Pass |
| Collection finance account | `KASA-TRY` changed from `-49987` to `-49962` | Pass |
| Collection movement | `customer_movements` row with `movement_type = collection` | Pass |
| Collection finance movement | visible through `/api/finance/movements` with `accountCode = KASA-TRY`, `paymentMethod = cash` | Pass |
| Collection audit | `audit_logs` row with `customer_collection_created` | Pass |
| Payment supplier balance | balance effect `-12`, balance becomes `-12` | Pass |
| Payment finance account | `KASA-TRY` changed from `-49962` to `-49974` | Pass |
| Payment movement | `supplier_movements` row with `movement_type = payment` | Pass |
| Payment finance movement | visible through `/api/finance/movements` with `accountCode = KASA-TRY`, `paymentMethod = cash` | Pass |
| Payment audit | `audit_logs` row with `supplier_payment_created` | Pass |
| Finance movement visibility | collection and payment visible through `/api/finance/movements` | Pass |

## UI Review

The existing finance entry screen already covers the Sprint 006 operator clarity requirement:

- The selected customer/supplier dropdown includes current balance.
- The side effect panel shows current balance, entered amount, expected after-save balance and result text before save.
- The form disables save until a cari and positive amount exist.
- A successful save reloads finance data, clears dirty state and prepares a receipt panel.
- The history table can reopen related cari cards and receipts.

The existing `scripts/web-admin-finance-form-smoke.mjs` remains focused on dirty-form safety. Sprint 006 adds API and database evidence instead of broad UI refactoring.

## Operational Finance Boundary

This ERP finance flow is operational finance/cari tracking. It is not an official accounting ledger.

The generated journal/accounting views are management/control views derived from operational customer, supplier and finance account movements. They do not replace official muhasebe fisleri, hesap plani, beyanname, e-fatura/e-arsiv, cek/senet or bank reconciliation.

## Checks Run

```powershell
node --check scripts/sprint-006-finance-collections-payments-smoke.mjs
npm.cmd --prefix apps/desktop run check
npm.cmd --prefix apps/web-admin run build
node scripts/web-admin-finance-form-smoke.mjs
$env:MELISA_API_BASE_URL='http://127.0.0.1:4100'; node scripts/sprint-006-finance-collections-payments-smoke.mjs
```

Build notes:

- Web-admin production build passed.
- Vite reported existing bundle-size and `lucide-react` module directive warnings.

## DB Writes

DB writes were performed by the Sprint 006 smoke against the configured local API/database with write guards active.

The writes were controlled and minimal:

- successful stamp `SPR006-1783508976139`
- earlier partial stamp `SPR006-1783508888094`
- two `SPR006-*` customer fixtures
- two `SPR006-*` supplier fixtures
- two `collection` movements
- two `payment` movements
- matching `finance_account_movements`
- matching `audit_logs`

No migrations, cleanup, reset, backup, production action, external message or deployment was run.

## Known Notes

- The smoke validates collection/payment mechanics with isolated `SPR006-*` cari records. Because the fixtures start at zero balance, the resulting negative balances represent advances. Invoice debt creation remains covered by Sprint 005.
- The first smoke attempt used stamp `SPR006-1783508888094`. It completed the controlled API writes, then failed only because the script tried to open a direct SQL connection from its own process. The script was changed to verify evidence through authenticated API endpoints and passed with stamp `SPR006-1783508976139`.
- This sprint does not implement bank reconciliation, official accounting, cek/senet, e-fatura/e-arsiv or full muhasebe fisleri.
- The smoke intentionally does not print SQL credentials, tokens or `.env.local` values.

## Definition Of Done

- Collection/payment selected-cari guards are verified.
- Customer/supplier balance impact is verified.
- Finance account balance direction is verified.
- Customer/supplier movement rows are verified.
- Finance account movement rows are verified.
- Audit evidence is verified.
- Operational finance boundary is documented.

## Next Recommended Sprint

Sprint 007 should focus on Backup, Restore, And Reset Safety.

Business reason:

- ERP Core transaction loops now have evidence through Sprint 005 and Sprint 006.
- Backup/restore discipline is the next critical production-readiness risk before broader operations work.
