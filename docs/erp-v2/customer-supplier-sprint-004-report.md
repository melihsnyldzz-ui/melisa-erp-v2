# Sprint 004 Report - Customer And Supplier Ledger Reliability

Date: 2026-07-07
Branch: `codex/erp-ui-modernization`
Owner: Codex
Reviewer: ChatGPT
Approver: Melih

## Status

Completed within the approved safe scope.

No live write, delete, import, cleanup, migration, or balance correction was performed. `.claude/` was not touched.

## Business Goal

Make customer receivables and supplier payables reliable enough for ERP Core validation.

Management and accounting must be able to trust customer/supplier lists, movement screens and statements before sales, purchase and finance flows can be accepted as business truth.

## Completed Work

- Removed hidden SQL write behavior from `GET /api/customers`.
- Kept cash customer creation/update logic available for invoice workflows, but customer list reads no longer call it.
- Added explicit `supplier.view` and `supplier.edit` granular permissions.
- Moved supplier list/detail/movement/statement routes from customer permissions to supplier permissions.
- Moved supplier card save permission from `customer.edit` to `supplier.edit`.
- Increased supplier list API max limit from 300 to 500.
- Updated supplier list UI calls from 300 to 500 rows.
- Updated supplier statement suggestions from 120 to 500 supplier rows.
- Increased customer and supplier movement/statement max limits to 500 so statement screens can request 250 rows as intended.

## Permission Boundary Summary

| Area | Before | After |
|---|---|---|
| Supplier list route | Auth-only plus duplicate route risk | `supplier.view` |
| Supplier detail route | Auth-only | `supplier.view` |
| Supplier create/update route | `customer.edit` | `supplier.edit` |
| Supplier movements route | `customer.view` | `supplier.view` |
| Supplier statement route | `customer.view` | `supplier.view` |
| Supplier card save UI | `customer.edit` | `supplier.edit` |

Full-access roles such as `admin`, `owner_manager` and `owner_partner` receive the new supplier permissions through role defaults.

## Read-Only API Smoke Results

The API was restarted with the current code and read-only GET endpoints were called using local passwordless admin access token. The passwordless auth path returns an access token only and does not create refresh-token rows.

| Endpoint | Result | Count | Total | Max limit | Source |
|---|---:|---:|---:|---:|---|
| `GET /api/customers?page=1&limit=500&activeOnly=false` | Passed | 139 | 139 | 500 | `sql-select-only` |
| `GET /api/suppliers?page=1&limit=500&activeOnly=false` | Passed | 154 | 154 | 500 | `sql-select-only` |
| `GET /api/customer-movements?limit=250` | Passed | 5 | 5 | 500 | `sql-customer-movements` |
| `GET /api/supplier-movements?limit=250` | Passed | 4 | 4 | 500 | `sql-supplier-movements` |
| `GET /api/customer-statement?limit=250` | Passed | 5 | 5 | 500 | `sql-customer-statement` |
| `GET /api/supplier-statement?limit=250` | Passed | 4 | 4 | 500 | `sql-supplier-statement` |

## Tests Run

- `node --check apps/api/src/services/permissionCatalog.js`
- `node --check apps/api/src/routes/customerRoutes.js`
- `node --check apps/api/src/routes/supplierRoutes.js`
- `node --check apps/api/src/routes/movementRoutes.js`
- `node --check apps/api/src/services/customerService.js`
- `node --check apps/api/src/services/supplierService.js`
- `node --check apps/api/src/services/movementService.js`
- `node --check apps/api/src/controllers/customerController.js`
- `node --check apps/api/src/controllers/supplierController.js`
- `node --check apps/api/src/controllers/movementController.js`
- `npm.cmd --prefix apps/web-admin run build`
- Read-only API smoke for customer/supplier lists, movements and statements.
- `git diff --check`

## Test Notes

The web-admin build passed. Vite still reports existing non-blocking warnings about `lucide-react` module directives and large chunk size.

## Tests Not Run

No customer/supplier create, update, delete, import, cleanup or balance correction was run because those are write operations and require explicit approval.

## Documentation Updated

- `docs/erp-v2/current-status.md`
- `docs/erp-v2/customer-supplier-sprint-004-report.md`

## Remaining Risks

- Imported customer/supplier data may still contain dirty names, duplicate-looking records or historical balance inconsistencies.
- Non-admin roles that need supplier access must be granted `supplier.view` / `supplier.edit` in the permissions data.
- Full balance reconciliation against accounting documents still belongs to later sales/purchase/finance validation sprints.

## Next Sprint Recommendation

Complete Sprint 005: Sales And Purchase Commercial Truth.
