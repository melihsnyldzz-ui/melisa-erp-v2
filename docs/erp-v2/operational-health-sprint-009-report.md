# Sprint 009 - Operational Health And Monitoring Report

Date: 2026-07-08
Branch: `codex/erp-ui-modernization`

## Status

Completed.

## Scope Completed

- Added a read-only web-admin Operational Health screen.
- Wired the screen to the protected `/api/monitoring/summary` endpoint.
- Added operator visibility for:
  - API uptime summary.
  - SQL connection status from the monitoring aggregate.
  - Pending and failed terminal sync counts.
  - Import and finalize audit event counts for the last 24 hours.
  - Recent audit events and monitoring anomaly notes.
- Registered the screen in the Operations menu as `Operasyon Sagligi`.
- Protected the screen with `audit.view`, matching the backend monitoring summary permission boundary.
- Added a focused static smoke test for Sprint 009 visibility and read-only constraints.

## Safety Boundary

No production actions were performed.

The sprint did not run:

- DB writes.
- SQL migrations.
- destructive SQL.
- backup, restore, reset, or cleanup scripts.
- WhatsApp or external message sending.
- production deploys.

The screen reads existing API data only and does not expose secrets, tokens, SQL credentials, `.env.local` values, or connection strings.

## Files Changed

- `apps/web-admin/src/modules/operations/OperationalHealthScreen.jsx`
- `apps/web-admin/src/services/monitoringApi.js`
- `apps/web-admin/src/components/workspace/Workspace.jsx`
- `apps/web-admin/src/data/mockNavigationData.js`
- `apps/web-admin/src/components/navigation/Sidebar.jsx`
- `apps/web-admin/src/config/roleViews.js`
- `apps/web-admin/package.json`
- `scripts/web-admin-operational-health-smoke.mjs`
- `docs/erp-v2/current-status.md`
- `docs/erp-v2/production-readiness-checklist.md`
- `docs/erp-v2/master-roadmap-v3.md`
- `docs/erp-v2/operational-health-sprint-009-report.md`

## Tests And Checks

- `npm.cmd --prefix apps/web-admin run smoke:operational-health`
- `npm.cmd --prefix apps/web-admin run smoke:navigation`
- `npm.cmd --prefix apps/web-admin run build`
- `node --check apps/api/src/services/monitoringService.js`
- `node --check apps/web-admin/src/modules/operations/OperationalHealthScreen.jsx` attempted; Node rejected `.jsx` extension before syntax parsing.

## Results

- Operational health smoke: passed.
- Navigation smoke: passed.
- Web-admin build: passed.
- API monitoring service syntax check: passed.
- Operational Health screen was validated by the Vite build. Direct `node --check` is not usable for `.jsx` in this environment because Node returns `ERR_UNKNOWN_FILE_EXTENSION`.

## Known Limits

- Import failure count is not yet a persisted failure-job metric. The screen shows the existing API note that import failures are currently observed through API error logs.
- Finalize failure count is not yet a persisted failed-finalize metric. The screen shows the existing API note that finalize failures are currently observed through API error logs.
- `/api/sql/health` remains a separate authenticated endpoint; Sprint 009 uses the monitoring summary aggregate for the operator screen and did not add live browser calls to SQL health directly.
- External uptime monitoring is still a production setup task.

## Human Approval Used

No special Melih approval was required because the sprint stayed read-only and did not run risky operations.

## Next Sprint Recommendation

Recommended sprint: Sprint 010 - Visual Stability And Daily Usability.

Reason: ERP Core now has an operator health surface. The next practical risk is whether daily screens stay usable at office desktop resolutions without overlapping controls or hidden actions.
