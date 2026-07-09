# Sprint 023: Invoice Fixture And Mock Boundary Cleanup

Date: 2026-07-09

Status: Completed

Branch: `supervisor-live-smoke-001`

## Goal

Remove invoice-screen mock/default ambiguity before final human testing.

Operators should not see sample invoice rows, sample customers, sample suppliers, or mock prices while a live sales or purchase invoice is loading.

## Scope Completed

- Removed the old sales invoice mock default data file.
- Removed the old purchase invoice mock default data file.
- Updated the sales invoice screen to start from an empty invoice and empty item list.
- Updated the purchase invoice screen to start from an empty invoice and empty item list.
- Kept demo invoice responses isolated behind `VITE_DEMO_MODE`.
- Added a focused invoice-boundary smoke test.
- Added invoice-boundary smoke to the final ERP smoke pack.

## Business Result

The sales and purchase invoice screens now avoid showing fake fixture rows while real API data is loading.

This lowers the risk that an operator or reviewer mistakes sample data for live ERP transactions during final testing.

## Out Of Scope

- No SQL migrations.
- No DB writes.
- No invoice business-rule change.
- No changes to finalized/cancelled invoice behavior.
- No import apply, cleanup, backup, restore, or reset.
- No WhatsApp, SMS, email, catalog publish, or external sending.
- No large UI redesign.

## Tests Run

```powershell
node --check scripts\web-admin-invoice-boundary-smoke.mjs
npm.cmd --prefix apps\web-admin run smoke:invoice-boundary
npm.cmd --prefix apps\web-admin run build
npm.cmd --prefix apps\web-admin run smoke:final-erp
```

## Test Result

Invoice boundary smoke:

| Check | Result |
|---|---|
| Sales invoice screen does not import mock invoice defaults | Pass |
| Purchase invoice screen does not import mock invoice defaults | Pass |
| Sales invoice screen starts from empty invoice state | Pass |
| Purchase invoice screen starts from empty invoice state | Pass |
| Old sales invoice mock data file is removed | Pass |
| Old purchase invoice mock data file is removed | Pass |
| Demo invoice data remains gated behind demo mode service calls | Pass |

Final ERP smoke:

| Status | Count |
|---|---:|
| Passed | 17 |
| Failed | 0 |
| Warnings | 1 |
| Skipped | 1 |
| Total | 19 |

The warning is the known live API read-only warning when the approved local test API is not serving the expected route at `http://127.0.0.1:4100`.

The skipped check is the controlled write smoke, which remains gated by `FINAL_ERP_WRITE_SMOKE_APPROVED=true`.

## Remaining Findings

No P1 invoice fixture/mock boundary blocker remains from this sprint.

Remaining final-testing polish items:

- CRM and WhatsApp screens should clearly show whether they are ERP Core, planned, or moved out of ERP.
- Terminal failed-sync/device operation should get a focused validation pass.
- Settings and definitions should get a business review with Melih.
- A live API read-only smoke should be rerun in the approved local test setup.

## Next Recommended Sprint

Sprint 024 should focus on CRM and WhatsApp final-testing labels.

Business reason:

- ERP Core should stay clear before final testing.
- CRM and WhatsApp features are partly planned or boundary-controlled.
- Operators need obvious labels so they do not treat planned automation as active live ERP behavior.
