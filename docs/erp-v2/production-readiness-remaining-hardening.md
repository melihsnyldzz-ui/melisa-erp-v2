# Melisa ERP v2 Production Readiness Remaining Hardening

Date: 2026-07-09

Purpose: define the remaining non-destructive production readiness work while backup/restore execution waits for exact approval.

This document does not approve or execute production deploys, SQL backups, restores, reset, cleanup, migrations, import apply, WhatsApp sending, or destructive scripts.

## Current Decision

Status: Non-destructive hardening can continue.

Backup/restore verification remains blocked until Melih provides exact execution approval using the wording in `approved-backup-restore-verification-run.md`.

## Production Readiness Summary

| Area | Current status | Blocking level | Safe next action |
|---|---|---:|---|
| Backup/restore verification | Packet ready, not executed | P0 | Await exact approval or keep preparing operator checklist |
| Production host/network/HTTPS | Runbook drafted, target not verified | P0 | Confirm host/network checklist without deploy |
| Production env/secrets | Checklist exists, values not verified | P0 | Verify names and ownership only, no values |
| Migration path | Not staging-proven | P0 | Create staging migration rehearsal checklist |
| SQL least privilege/certificate policy | Not verified | P0 | Create review checklist, no credential changes |
| Admin/user onboarding | Not confirmed for production | P0 | Create permission sign-off matrix |
| Monitoring/log retention | Partially planned | P1 | Create monitoring and log-retention checklist |
| Terminal physical-device acceptance | Not fully proven | P1 | Create device acceptance checklist |
| Import risk acceptance | Partially documented | P1 | Create import operator safety checklist |
| Training notes | Partial | P1 | Create concise operator quick-start/update notes |

## Non-Destructive Work Queue

These can proceed without live DB writes, secret exposure, production deploys, or destructive scripts.

### PRH-001 - Production Host And Network Checklist

Goal: confirm the target production host assumptions before deployment.

Output:

- Host role.
- Windows/Linux decision.
- Port policy.
- HTTPS/reverse proxy plan.
- LAN/VPN/external access decision.
- Operator who owns the host.

Do not:

- Deploy.
- Change firewall.
- Change DNS.
- Publish externally.

### PRH-002 - Production Env Ownership Checklist

Goal: verify which environment variable names are needed and who owns the values.

Output:

- Required env var names.
- Owner for each value.
- Storage location policy.
- Rotation/responsibility notes.

Do not:

- Print secret values.
- Commit `.env`.
- Change production secrets.

### PRH-003 - Migration Rehearsal Checklist

Goal: prepare a staging-only migration rehearsal path.

Output:

- Current migration list.
- Target staging DB.
- Pre-migration backup requirement.
- Rollback decision point.
- Post-migration smoke list.

Do not:

- Run migrations.
- Alter SQL schema.
- Touch production DB.

### PRH-004 - SQL Least-Privilege Review Checklist

Goal: make sure production SQL access is not overprivileged.

Output:

- Required API permissions by action class.
- Disallowed permissions.
- Certificate/trust policy question list.
- Owner sign-off area.

Do not:

- Create users.
- Change passwords.
- Change SQL Server security.

### PRH-005 - Permission Sign-Off Matrix

Goal: define who should have admin, finance, import, sales, purchase, stock and audit permissions.

Output:

- Role list.
- Business owner per role.
- Critical permissions.
- Approval notes.

Do not:

- Change users.
- Grant/revoke permissions.

### PRH-006 - Monitoring And Log Retention Checklist

Goal: define what should be monitored after production launch.

Output:

- `/api/health`.
- `/api/sql/health`.
- Import failures.
- Finalize failures.
- Audit failures.
- Terminal failed sync.
- Log retention policy.

Do not:

- Install monitoring agent.
- Change production logging.

### PRH-007 - Terminal Device Acceptance Checklist

Goal: make terminal readiness testable on physical devices.

Output:

- Device list.
- Login test.
- Product lookup test.
- Sale draft/send boundary.
- Failed sync handling.
- Offline/online note.

Do not:

- Send real terminal sale unless separately approved.

### PRH-008 - Import Operator Safety Checklist

Goal: reduce risk before operators use CSV/XLSX import.

Output:

- Preview-before-apply rule.
- Duplicate warning review.
- Suspicious row review.
- Finance reconciliation warning.
- Approval point for apply.

Do not:

- Apply imports.
- Clean production data.

## Recommended Sprint Order

1. `Plan P1 Production Host Network Checklist.`
2. `Plan P1 Production Env Ownership Checklist.`
3. `Plan P1 Migration Rehearsal Checklist.`
4. `Plan P1 SQL Least Privilege Review Checklist.`
5. `Plan P1 Permission Sign-Off Matrix.`
6. `Plan P1 Monitoring And Log Retention Checklist.`
7. `Plan P1 Terminal Device Acceptance Checklist.`
8. `Plan P1 Import Operator Safety Checklist.`

Backup/restore execution can interrupt this order only if exact approval is provided.

## Next Safe Step

```text
Plan P1 Production Host Network Checklist.
```

This is the safest non-destructive next step while backup/restore execution approval is pending.
