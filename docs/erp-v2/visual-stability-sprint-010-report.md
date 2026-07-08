# Sprint 010 - Visual Stability And Daily Usability Report

Date: 2026-07-08
Branch: `supervisor-live-smoke-001`

## Status

Completed.

## Scope Completed

- Added stronger compact desktop layout guards for daily web-admin screens.
- Kept dashboard, product card, sales invoice, purchase invoice and finance action areas visible at office-width desktop sizes.
- Forced sales and purchase invoice work areas to collapse to a single column before the 1366px office target can hide side panels or action controls.
- Updated the layout smoke contract to cover:
  - 1366px and 1180px shell width budgets.
  - toolbar/action wrapping on compact desktop.
  - stock 360 and invoice layout collapse rules.
  - supplier/customer list row limits and table stability.
  - product supplier suggestion limits.
  - purchase invoice supplier/product guard coverage.
- Captured browser screenshots for the demo/read-only Operation Desk at:
  - 1366x768.
  - 1920x1080.

## Safety Boundary

No production actions were performed.

The sprint did not run:

- DB writes.
- SQL migrations.
- destructive SQL.
- backup, restore, reset, or cleanup scripts.
- WhatsApp or external message sending.
- production deploys.

Browser verification used `VITE_DEMO_MODE=true`, so API/SQL calls were disabled and no ERP data was changed.

## Files Changed

- `apps/web-admin/src/styles/erp-modern.css`
- `scripts/web-admin-layout-smoke.mjs`
- `docs/erp-v2/current-status.md`
- `docs/erp-v2/master-roadmap-v3.md`
- `docs/erp-v2/visual-stability-sprint-010-report.md`

## Tests And Checks

- `npm.cmd --prefix apps/web-admin run smoke:layout`
- `npm.cmd --prefix apps/web-admin run smoke:navigation`
- `npm.cmd --prefix apps/web-admin run smoke:finance-form`
- `npm.cmd --prefix apps/web-admin run smoke:list-scope`
- `npm.cmd --prefix apps/web-admin run smoke:action-clarity`
- `npm.cmd --prefix apps/web-admin run build`
- Chrome headless screenshot at 1366x768 against `http://127.0.0.1:5177/` with `VITE_DEMO_MODE=true`.
- Chrome headless screenshot at 1920x1080 against `http://127.0.0.1:5177/` with `VITE_DEMO_MODE=true`.

## Results

- Layout smoke: passed.
- Navigation smoke: passed.
- Finance form smoke: passed.
- List scope smoke: passed.
- Action clarity smoke: passed.
- Web-admin build: passed.
- 1366x768 Operation Desk screenshot: passed visual check; toolbar, sidebar, KPI cards and status bar render without overlap.
- 1920x1080 Operation Desk screenshot: passed visual check; dense ERP layout remains readable and action controls stay visible.

The build still reports the existing Vite warnings for ignored `use client` directives from `lucide-react` and a large JavaScript chunk. These are not introduced by Sprint 010.

## Known Limits

- Browser screenshot verification covered the Operation Desk in demo mode. Other critical screens are protected by the focused static layout smoke, but were not individually clicked through with a full browser automation suite because no browser automation CLI was available in this session.
- The screenshot artifacts are local runtime evidence under `.codex_tmp/` and are not intended for commit.
- This sprint does not redesign daily screens, add new modules, or validate live DB-backed data density.

## Human Approval Used

No special Melih approval was required because the sprint stayed UI/static/demo-only and did not run risky operations.

## Next Sprint Recommendation

Recommended sprint: Sprint 011 - Product Media Workflow.

Reason: ERP Core stabilization now has visual guardrails for daily office use. The next documented roadmap item is controlled product media coverage, with dry-run/report/apply discipline and no unreviewed bulk media changes.
