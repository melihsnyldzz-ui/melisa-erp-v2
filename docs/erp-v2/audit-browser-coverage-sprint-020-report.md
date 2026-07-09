# Sprint 020: Audit Browser And Audit Coverage

Date: 2026-07-09
Owner: Codex
Reviewer: ChatGPT
Approver: Melih

## Business Goal

Make critical ERP write traces visible before final testing. Operators should be able to review recent audit events and see which critical ERP areas have audit coverage.

## Scope Completed

- Added read-only audit log API:
  - `GET /api/audit/logs`
  - `GET /api/audit/coverage`
- Protected both endpoints with `audit.view`.
- Added a dedicated web-admin screen:
  - `Güvenlik > Audit Log`
- Added server-side audit filters:
  - search
  - action
  - entity type
  - source
  - date range
  - limit up to 500
- Added coverage map for critical areas:
  - sales invoices
  - purchase invoices
  - finance collections/payments
  - product/stock
  - customer/supplier cards
  - import
  - auth/settings
  - sales offer/order pipeline
  - terminal submit
- Added Excel and print/PDF actions for the audit log screen.

## Safety Boundaries

- Read-only API only.
- No DB writes.
- No direct SQL outside application services.
- No cleanup, reset, restore, migration, deploy, import apply, or WhatsApp sending.
- No `.env.local` or secret values exposed.

## Smoke Results

Temporary local API was started on port `4111` with local passwordless login enabled only for the smoke process.

Result:

- Login: passed
- `GET /api/audit/logs?limit=5`: passed
- `GET /api/audit/coverage`: passed
- Coverage areas returned: 9
- Fully covered areas at smoke time: 3
- Partially covered areas at smoke time: 4
- Missing areas at smoke time: 2

The missing/partial result is expected for areas that have not yet been exercised in the local database.

## Build / Checks

- `node --check` for new API service/controller/route files: passed
- `npm.cmd --prefix apps/web-admin run build`: passed
- Web build completed with existing bundle-size and lucide module directive warnings only.

## Acceptance Criteria

- Audit log is no longer only embedded inside auth admin overview.
- Admin users with `audit.view` can open a dedicated Audit Log screen.
- Critical write coverage is visible as covered, partial, or missing.
- The new audit screen is read-only and cannot trigger risky operations.

## Remaining Gaps

- Coverage currently checks whether audit events exist in the database; it does not yet prove every code path is fail-closed if audit writing fails.
- Snapshot detail is summarized in the table; a full detail drawer/modal can be added later if needed.
- Some partial/missing coverage depends on test data and which flows have been executed locally.

## Next Recommended Sprint

Sprint 021 should be a whole ERP screen completion audit:

- open every menu screen
- identify broken, weak, duplicate, mock/demo, or unfinished screens
- classify each as keep, fix, hide, or move later
- produce the final P0/P1 UI completion list before final testing
