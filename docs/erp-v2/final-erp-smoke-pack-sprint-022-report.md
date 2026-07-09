# Sprint 022: Final ERP Smoke Test Pack

Date: 2026-07-09

Status: Completed

Branch: `supervisor-live-smoke-001`

## Goal

Create one repeatable final ERP smoke command that can be run before final human testing.

The pack is intended to replace scattered manual checks with a clear pass/fail summary for the ERP Core validation path.

## Scope Completed

- Added `scripts/final-erp-smoke-pack.mjs`.
- Added `npm run smoke:final-erp` to the web-admin package.
- Included existing API syntax, web-admin navigation, list, layout, finance form, operational health, reporting, AI readiness, ERP Core read-only, ERP Core approval-plan, and production build checks.
- Added a live API read-only smoke section that reports a warning instead of failing when the local API is not running in the expected test setup.
- Kept controlled write smoke skipped by default unless `FINAL_ERP_WRITE_SMOKE_APPROVED=true` is explicitly set.
- Updated older Sprint 015, 016, 017, and 018 smoke expectations so they reflect the current Sprint 022 progression.

## Out Of Scope

- No SQL migrations.
- No direct DB writes.
- No import apply, cleanup, backup, restore, or reset.
- No production deploy.
- No WhatsApp, SMS, email, catalog publish, or external message sending.
- No new ERP business feature.
- No UI redesign.

## Final Smoke Result

Command:

```powershell
npm.cmd --prefix apps\web-admin run smoke:final-erp
```

Result:

| Status | Count |
|---|---:|
| Passed | 16 |
| Failed | 0 |
| Warnings | 1 |
| Skipped | 1 |
| Total | 18 |

Interpretation:

- Static and build smoke checks passed.
- The live API read-only smoke produced a warning because `http://127.0.0.1:4100` did not expose the expected local test route at run time.
- Controlled write smoke was skipped intentionally because `FINAL_ERP_WRITE_SMOKE_APPROVED` was not enabled.

## Checks Covered

- API audit controller syntax.
- API audit route syntax.
- API audit service syntax.
- Web-admin navigation smoke.
- Web-admin list scope smoke.
- Web-admin finance form smoke.
- Web-admin action clarity smoke.
- Web-admin empty state smoke.
- Web-admin operational health smoke.
- Web-admin layout smoke.
- Reporting decision support smoke.
- AI automation readiness smoke.
- ERP Core path static smoke.
- ERP Core read-only static smoke.
- ERP Core write approval plan smoke.
- Web-admin production build.
- Live API read-only smoke, warning-only when local test API is unavailable.
- Controlled write smoke, approval-gated and skipped by default.

## Evidence

Additional checks run:

```powershell
node --check scripts\final-erp-smoke-pack.mjs
node --check scripts\sprint-017-erp-core-read-only-smoke.mjs
node --check scripts\sprint-018-erp-core-write-smoke-approval-plan-smoke.mjs
npm.cmd --prefix apps\web-admin run smoke:erp-core-write-plan
npm.cmd --prefix apps\web-admin run smoke:final-erp
```

## Remaining Findings

No P0 smoke-pack blocker remains from Sprint 022.

Known P1/P2 findings should be fixed in later focused sprints:

- Invoice fixture and mock/demo naming boundary cleanup.
- CRM and WhatsApp labels that should be clearly marked as planned or moved outside ERP Core.
- Terminal device and failed-sync operational validation.
- Settings and definitions business review.
- Optional live API read-only smoke run against an approved local test setup.

## Next Recommended Sprint

Sprint 023 should focus on invoice fixture and mock/demo boundary cleanup.

Business reason:

- Final smoke now has one repeatable command.
- Remaining risk before final human testing is that operators may confuse fixture/demo/default labels with real ERP behavior.
- This should be resolved before broader manual acceptance testing.
