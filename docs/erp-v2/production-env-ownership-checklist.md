# Melisa ERP v2 Production Env Ownership Checklist

Date: 2026-07-09

Purpose: define who owns production environment variables, where values should live, and how they should be reviewed without exposing secret values.

This document is a checklist only. It does not read, print, change, generate, rotate, validate or commit secret values. It does not approve deployment, migration, backup, restore, reset, cleanup, import apply, WhatsApp sending, or production writes.

## Current Decision

Status: Pending human env ownership confirmation.

Production env names are documented in `production-env-checklist.md`, but production readiness still requires owner sign-off for each group and confirmation that real values are stored outside Git/chat/docs.

## Ownership Groups

| Group | Examples | Owner required | Storage rule |
|---|---|---:|---|
| API runtime | `NODE_ENV`, `API_PORT`, `APP_NAME`, `API_VERSION` | Yes | Deployment host/service config |
| CORS and request policy | `CORS_ORIGINS`, `REQUEST_BODY_LIMIT`, rate limit settings | Yes | Deployment host/service config |
| SQL connection metadata | `SQL_SERVER`, `SQL_PORT`, `SQL_DATABASE`, `SQL_ODBC_DRIVER` | Yes | Deployment host/approved secret store |
| SQL credentials | `SQL_USER`, `SQL_PASSWORD` | Yes | Approved secret store or protected host env only |
| JWT secrets | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Yes | Approved secret store or protected host env only |
| WhatsApp integration | `WHATSAPP_*` | Yes if enabled | Disabled unless separately approved |
| Web-admin public config | `VITE_*` | Yes | Build-time env; no secrets |
| Terminal public config | `EXPO_PUBLIC_*` | Yes | Device build/runtime config; no secrets |
| Terminal test token | `TERMINAL_API_TOKEN` | Yes if used | Test-only secret; not production operator token |
| Desktop/Electron config | `MELISA_*` | Yes | Local deployment config; no secrets unless approved |

## Required Owner Sign-Off

| Area | Required owner | Current status |
|---|---|---|
| API runtime owner | Named human | Pending |
| SQL credentials owner | Named human | Pending |
| JWT secret owner | Named human | Pending |
| Web-admin build config owner | Named human | Pending |
| Terminal config owner | Named human | Pending |
| WhatsApp config owner | Named human or disabled decision | Pending |
| Env storage owner | Named human | Pending |
| Rotation owner | Named human | Pending |
| Incident owner | Named human | Pending |

## Storage Policy

Allowed:

- Protected production host environment variables.
- Approved secret manager.
- Password manager controlled by Melih/authorized operator.
- Deployment platform secret store.

Not allowed:

- Git.
- `.env.local` committed to the repo.
- Chat messages.
- Screenshots.
- Documentation files.
- Issue/PR comments.
- Terminal output pasted into docs.

## Secret Handling Rules

- Do not print secret values.
- Do not ask the AI agent to reveal secret values.
- Do not paste secret values into Codex, ChatGPT, Claude or GitHub.
- `VITE_*` and `EXPO_PUBLIC_*` values are public-facing and must never contain secrets.
- Production WhatsApp variables remain unused unless external sending is separately approved.
- Production SQL user must be least-privilege and must not use broad admin credentials unless separately approved and documented.

## Review Checklist

| Check | Status |
|---|---|
| Env variable names reviewed | Ready |
| Secret value storage location selected | Pending |
| Owner assigned for API env | Pending |
| Owner assigned for SQL env | Pending |
| Owner assigned for JWT secrets | Pending |
| Owner assigned for web-admin build env | Pending |
| Owner assigned for terminal env | Pending |
| Owner assigned for WhatsApp disabled/enabled decision | Pending |
| Rotation policy selected | Pending |
| Incident response owner assigned | Pending |
| `.env.local` confirmed uncommitted | Pending |
| Public env variables checked for no secrets | Pending |

## Human Sign-Off

```text
Production Env Ownership Sign-Off
Target host:
API env owner:
SQL env owner:
JWT secret owner:
Web-admin env owner:
Terminal env owner:
WhatsApp env owner or disabled decision:
Storage location type:
Rotation owner:
Incident owner:
Decision: pending / approved / rejected
Notes:
```

## Stop Conditions

Stop before production env setup if:

- A secret value appears in chat, docs, screenshots, Git output or commit content.
- Owner for SQL credentials is missing.
- Owner for JWT secrets is missing.
- Storage location is not approved.
- `VITE_*` or `EXPO_PUBLIC_*` would contain a secret.
- `WHATSAPP_ENABLED=true` is requested without explicit external sending approval.
- `VITE_LOCAL_PASSWORDLESS_LOGIN` would be true in production.
- `SQL_DATABASE` is not `MELISA_ERP_V2`.

## Next Safe Step

```text
Plan P1 Migration Rehearsal Checklist.
```

This next step should prepare a staging-only migration rehearsal checklist without running migrations or touching production SQL.
