# Sprint 025 Report: Terminal Failed Sync And Device Validation

Date: 2026-07-09

Status: Completed

## Goal

Make terminal failed-sync and device-readiness boundaries understandable before final human testing.

## Completed Scope

- Added a visible final-testing note to Terminal Management explaining that the web-admin terminal screen is read-only.
- Added a failed-sync review note explaining that failed rows are operator review signals, not direct SQL cleanup instructions.
- Added a terminal app sync note explaining that Send can write through the API and Delete only removes the local device queue entry.
- Added a terminal settings readiness note explaining that API offline, empty cache, or failed queue means the device is not field-ready.
- Added focused smoke coverage for terminal boundary labels and terminal admin GET-only behavior.
- Added terminal boundary smoke to the final ERP smoke pack.

## Out Of Scope

- No live DB writes.
- No terminal send execution.
- No terminal queue deletion execution.
- No SQL cleanup.
- No migrations.
- No backup, restore, or reset.
- No production deploy.
- No WhatsApp or external message sending.

## Tests

Checks run:

- `node --check scripts\web-admin-terminal-boundary-smoke.mjs`
- `npm.cmd --prefix apps\web-admin run smoke:terminal-boundary`
- `npm.cmd --prefix apps\web-admin run build`
- `npm.cmd --prefix apps\web-admin run smoke:final-erp`

Result:

- Terminal boundary smoke: 9 passed, 0 failed.
- Web-admin production build: passed.
- Final ERP smoke pack: 19 passed, 0 failed, 1 warning, 1 skipped.
- Warning: live API read-only smoke returned route not found in the current local API context.
- Skipped: controlled write smoke because `FINAL_ERP_WRITE_SMOKE_APPROVED` was not enabled.

## Business Result

Operators can now distinguish between terminal visibility, local device queue cleanup, and API-backed ERP writes. This reduces the risk of treating failed sync rows as automatic cleanup work during final testing.

## Next Recommended Sprint

Plan P1 Settings And Definitions Business Review.
