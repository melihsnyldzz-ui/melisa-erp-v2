# Melisa ERP v2 Production Deployment Runbook

Date: 2026-07-09

Purpose: define the production deployment checklist for Melisa ERP v2 without executing deployment, backup, restore, migration, reset, cleanup, import apply, WhatsApp sending, or any production write action.

This runbook is a preparation document. Every production action still requires explicit Melih approval.

## Production Status

Current status: Not deployed to production by this runbook.

ERP Core status: Accepted with warnings.

Production readiness status: Blocked until the P0 items in `production-readiness-gate-sprint-034-report.md` are closed.

## Roles

| Role | Responsibility |
|---|---|
| Melih | Final production approval and business go/no-go |
| Deployment operator | Runs approved deploy commands on the target host |
| Database operator | Handles SQL Server backup, restore verification and migration approval |
| Codex | Prepares docs, checklists and safe commands; does not run production actions without approval |
| ChatGPT/Reviewer | Reviews plan, risk, checklist and evidence |

## Required Human Approvals

Separate explicit approval is required for:

- Production deploy.
- Production environment/secret changes.
- SQL backup creation.
- Restore verification.
- Production restore.
- SQL migration.
- Reset, cleanup, archive restore or destructive SQL.
- Import apply.
- WhatsApp or external message sending.
- Terminal sale send against production.

Approval text must name:

- Target environment.
- Exact action.
- Whether DB writes are allowed.
- Whether backup/rollback is required first.
- Who is responsible for checking the result.

## Pre-Deployment Checklist

| Gate | Required evidence | Status |
|---|---|---|
| Production host selected | Hostname/IP and access owner recorded outside this repo | Pending |
| Reverse proxy selected | IIS/Nginx/Caddy/other decision recorded | Pending |
| HTTPS plan ready | Certificate and renewal owner recorded | Pending |
| Network policy ready | API, web-admin and SQL access rules recorded | Pending |
| Production env names reviewed | See `production-env-checklist.md` | Ready as checklist |
| Production secrets configured | Values stored outside Git/chat/docs | Pending |
| SQL backup path selected | Restricted-access path recorded outside Git | Pending |
| Backup job planned | Schedule and retention owner recorded | Pending |
| Restore verification planned | Staging restore target selected | Pending |
| Rollback owner assigned | Named human owner | Pending |
| User/role matrix reviewed | Admin and operator permissions confirmed | Pending |
| Terminal deployment plan reviewed | Device/API URL strategy confirmed | Pending |

## Build And Artifact Steps

Safe local verification commands:

```powershell
npm.cmd --prefix apps\web-admin run build
npm.cmd --prefix apps\web-admin run smoke:final-erp
```

Production artifact notes:

- Web-admin build output is `apps/web-admin/dist`.
- API runtime is `apps/api`.
- Terminal app is a separate physical-device acceptance path.
- Electron desktop shell is a local packaging path and does not replace web/API production readiness.

Do not copy `.env.local`, secrets, backup files, SQL dumps or local uploads into Git.

## API Deployment Checklist

| Item | Status |
|---|---|
| `NODE_ENV=production` set | Pending |
| API process manager selected | Pending |
| API start command verified on target host | Pending |
| `/api/health` reachable from expected network | Pending |
| `/api/sql/health` protected and reachable by authorized user | Pending |
| Logs path and retention policy selected | Pending |
| Rate limit enabled | Pending |
| CORS origin list production-only | Pending |
| WhatsApp disabled unless explicitly approved | Pending |

## Web-Admin Deployment Checklist

| Item | Status |
|---|---|
| `VITE_API_BASE_URL` points to production API | Pending |
| `VITE_DEMO_MODE=false` | Pending |
| `VITE_ENABLE_DEBUG_PANEL=false` | Pending |
| `VITE_LOCAL_PASSWORDLESS_LOGIN=false` | Pending |
| Build artifact generated | Pending |
| Static hosting/reverse proxy route configured | Pending |
| Browser smoke test completed | Pending |

## SQL Server Checklist

| Item | Status |
|---|---|
| Target DB confirmed as `MELISA_ERP_V2` | Pending |
| Vega DB excluded from production flow | Pending |
| SQL least-privilege user configured | Pending |
| SQL encryption/trust policy reviewed | Pending |
| Production migration staged and tested | Pending |
| Pre-deploy backup approved and created | Pending approval |
| Restore verification completed on staging | Pending approval |

## Rollback Checklist

Before production deploy:

1. Record current Git commit hash.
2. Record web-admin artifact version.
3. Confirm backup file name and location outside Git.
4. Confirm restore verification result.
5. Confirm rollback owner.
6. Confirm maintenance window.

Rollback is not:

- Direct destructive SQL.
- Manual table deletion.
- Ad hoc reset.
- Unverified backup restore.

## Post-Deployment Smoke

Run only after approved deploy:

| Check | Expected |
|---|---|
| API health | OK |
| SQL health | OK for authorized user |
| Web-admin loads | OK |
| Login/logout | OK |
| Stock list read | OK |
| Customer list read | OK |
| Supplier list read | OK |
| Dashboard summary | OK |
| Final smoke pack | 0 failed |

Write checks in production require separate approval.

## Stop Conditions

Stop deployment immediately if:

- Secret value appears in logs, UI, chat, docs or screenshots.
- Target DB is not `MELISA_ERP_V2`.
- Backup path or restore verification is missing.
- CORS allows unintended origins.
- API runs without JWT secrets.
- SQL permissions are broader than approved.
- Any smoke check fails.
- WhatsApp or external sending is enabled without approval.

## Next Gate

After this runbook is reviewed, the next safe gate is:

```text
Plan P1 Backup Restore Verification Plan.
```

The backup/restore gate should still be documentation/planning first unless Melih explicitly approves a real backup or restore verification run.
