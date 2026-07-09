# Sprint 035 Report - Production Deployment Runbook And Env Checklist

Date: 2026-07-09
Owner: Codex
Reviewer: ChatGPT
Approver: Melih
Status: Completed

## Purpose

Sprint 035 creates the first practical production deployment runbook and environment checklist after the production readiness gate.

This sprint is documentation-only. It does not deploy, configure production env values, run migrations, create backups, restore databases, reset data, send WhatsApp messages, or expose secrets.

## Completed Scope

- Created `docs/erp-v2/production-deployment-runbook.md`.
- Created `docs/erp-v2/production-env-checklist.md`.
- Listed deployment, rollback, SQL, API, web-admin, terminal and desktop readiness gates.
- Listed environment variable names without values.
- Repeated explicit approval requirements for risky production actions.
- Updated ERP documentation index, current status and roadmap.

## Key Decision

Production deploy is still not approved by this sprint.

The next safe production-readiness gate should focus on backup/restore verification planning before any real production deployment.

## Tests Run

```powershell
npm.cmd --prefix apps\web-admin run build
npm.cmd --prefix apps\web-admin run smoke:final-erp
```

Result:

- Web-admin production build passed.
- Final ERP smoke pack passed with 23 passed, 0 failed, 1 warning, 1 skipped.
- The warning/skip remain accepted for routine safe smoke because this sprint does not execute production writes or approved write checks.

## Result

Sprint 035 is completed.

ERP now has a practical production deployment runbook and secret-safe env checklist, but remains blocked from production until the P0 production blockers are closed.

## Next Recommended Sprint

```text
Plan P1 Backup Restore Verification Plan.
```

Business reason:

- Backup/restore confidence is the highest production-risk item after deployment/env planning.
- The next sprint should stay planning/checklist-first unless Melih explicitly approves a real backup or restore verification action.
