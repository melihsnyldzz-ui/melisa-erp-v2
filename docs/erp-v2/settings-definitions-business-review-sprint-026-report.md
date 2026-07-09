# Sprint 026 Report: Settings And Definitions Business Review

Date: 2026-07-09

Status: Completed

## Goal

Make settings, definitions, and currency-rate business effects clear before final human testing.

## Completed Scope

- Added a final-testing note to System Settings explaining that Save writes company, document series, VAT, and period-lock settings through the API.
- Clarified that cleanup, archive, and restore actions can affect test/demo data and require preview plus confirmation text.
- Added a period-lock business-rule note explaining that it changes whether sales, purchase, cancel, collection, payment, and stock-count operations are accepted.
- Added a final-testing note to Definitions explaining that Save writes product unit, customer type, payment/collection method, and currency definitions through the API.
- Clarified that Definitions does not run imports, migrations, or bulk correction of existing receipts.
- Added a currency-rate note explaining that saving USD/EUR rates affects new sales/purchase receipt currency snapshots and does not recalculate finalized receipts.
- Added focused smoke coverage for settings, definitions, currency-rate, and permission boundaries.
- Added settings/definitions boundary smoke to the final ERP smoke pack.

## Out Of Scope

- No settings save execution.
- No cleanup, archive, or restore execution.
- No currency-rate save execution.
- No SQL migration.
- No backup, restore, or reset.
- No production deploy.
- No permission model refactor.

## Tests

Checks run:

- `node --check scripts\web-admin-settings-definitions-boundary-smoke.mjs`
- `npm.cmd --prefix apps\web-admin run smoke:settings-definitions-boundary`
- `npm.cmd --prefix apps\web-admin run build`
- `npm.cmd --prefix apps\web-admin run smoke:final-erp`

Result:

- Settings/definitions boundary smoke: 7 passed, 0 failed.
- Web-admin production build: passed.
- Final ERP smoke pack: 20 passed, 0 failed, 1 warning, 1 skipped.
- Warning: live API read-only smoke returned route not found in the current local API context.
- Skipped: controlled write smoke because `FINAL_ERP_WRITE_SMOKE_APPROVED` was not enabled.

## Business Result

Operators can now see which settings screens change business behavior before using them in final testing. This reduces the risk of changing document series, VAT, period locks, definitions, currency rates, or test cleanup actions without understanding the effect.

## Next Recommended Sprint

Plan P1 Final Testing Runbook And Operator Readiness.
