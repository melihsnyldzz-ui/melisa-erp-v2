# Melisa ERP v2 Production Host Network Checklist

Date: 2026-07-09

Purpose: define the production host, network, access and HTTPS decisions that must be confirmed before Melisa ERP v2 is deployed.

This document is a checklist only. It does not approve or execute deployment, DNS changes, firewall changes, reverse proxy changes, SQL backup, restore, migration, reset, cleanup, import apply, WhatsApp sending, or production writes.

## Current Decision

Status: Pending human host/network confirmation.

ERP Core is accepted with warnings, but production readiness remains blocked until the production host, network, HTTPS, env, backup/restore, migration and user/permission gates are closed.

## Host Decision Checklist

| Item | Required answer | Current status |
|---|---|---|
| Production host type | Windows server / Linux server / local Windows PC / cloud VM | Pending |
| Host owner | Named human owner | Pending |
| Deployment operator | Named human operator | Pending |
| Database location | Same host / separate SQL Server host | Pending |
| Runtime mode | Web/API service / Electron local shell / hybrid | Pending |
| Access pattern | LAN only / VPN / public internet / mixed | Pending |
| Maintenance window owner | Named human owner | Pending |

## Network And Port Checklist

| Service | Default local/dev value | Production decision | Notes |
|---|---|---|---|
| Web-admin | Vite dev server, usually `5173` | Pending | Production should normally be static build behind approved host/proxy |
| API | Express API, usually `4100` | Pending | Must not be exposed publicly without auth, CORS and rate-limit review |
| SQL Server | Local/SQL Server instance | Pending | Should not be exposed to public internet |
| Terminal app API URL | Configured per device | Pending | Device acceptance is a separate checklist |
| Electron shell | Local desktop wrapper | Pending | Does not replace production API/web readiness |

## HTTPS And Reverse Proxy Checklist

| Item | Current status | Required before production |
|---|---|---|
| Reverse proxy choice | Pending | IIS / Nginx / Caddy / other |
| HTTPS certificate source | Pending | Certificate owner and renewal method |
| API route policy | Pending | Example: `/api/*` proxied to API service |
| Web static route policy | Pending | Web-admin static artifact path |
| Max request size policy | Pending | Especially for imports/uploads |
| WebSocket/long-polling policy | Pending | If future integrations require it |
| Redirect HTTP to HTTPS | Pending | Required if public or mixed access |

## Access Policy Checklist

| Access type | Required decision |
|---|---|
| Admin access | Who can access admin screens |
| Operator access | Which staff can use daily ERP |
| External access | Whether ERP is reachable outside LAN/VPN |
| IP allowlist | Whether LAN/VPN/IP restriction is needed |
| CORS origins | Exact production web origins only |
| Debug panel | Must be disabled in production |
| Local passwordless login | Must be disabled in production |
| WhatsApp sending | Disabled unless separately approved |

## Production Safety Defaults

These defaults should be used unless Melih explicitly approves otherwise:

- ERP should start LAN/VPN-first, not public internet-first.
- SQL Server should not be exposed to public internet.
- Web-admin should be served from a production build, not Vite dev server.
- API should run behind a process manager or service wrapper.
- HTTPS should be enabled before public access.
- Production CORS should allow only approved origins.
- Debug/local login flags should be disabled.
- WhatsApp/external sending should remain disabled.

## Evidence To Record Before Deployment

Before production deployment, record:

- Host label/name.
- Host owner.
- Deployment operator.
- Database host/location.
- Web-admin URL.
- API base URL.
- Network access decision.
- Reverse proxy decision.
- HTTPS/certificate owner.
- CORS origins.
- Maintenance window.
- Rollback owner.

Do not record:

- Passwords.
- API keys.
- JWT secrets.
- SQL connection strings.
- `.env.local` contents.
- Private certificate keys.

## Stop Conditions

Stop before deployment if:

- Host owner is not known.
- API base URL is not decided.
- SQL Server exposure is unclear.
- CORS origins are not production-specific.
- HTTPS decision is missing for public/mixed access.
- Debug panel or local passwordless login would be enabled in production.
- Backup/restore verification is still missing and production go-live is being requested.
- Any action would expose secrets or commit `.env` files.

## Human Sign-Off

```text
Production Host Network Checklist Sign-Off
Host:
Host owner:
Deployment operator:
Database location:
Access pattern:
Web-admin URL:
API base URL:
Reverse proxy:
HTTPS owner:
CORS origins:
Maintenance window:
Rollback owner:
Decision: pending / approved / rejected
Notes:
```

## Next Safe Step

```text
Plan P1 Production Env Ownership Checklist.
```

This next step should verify environment variable names and ownership without reading, printing, changing, or committing secret values.
