# Melisa ERP v2 Production Environment Checklist

Date: 2026-07-09

Purpose: list production environment variable names and verification rules without storing or exposing secret values.

Do not paste actual values into this file, chat, GitHub issues, screenshots, or commit messages.

## Rules

- Store real values only on the protected deployment host or approved secret store.
- Never commit `.env.local`.
- Never expose SQL passwords, JWT secrets, WhatsApp keys, tokens, cookies or connection strings.
- Production env changes require explicit Melih approval.
- `VITE_*` and `EXPO_PUBLIC_*` values are bundled into client/runtime surfaces and must not contain secrets.

## API Environment

| Variable | Secret? | Production rule |
|---|---:|---|
| `API_PORT` | No | Set to approved API port |
| `APP_NAME` | No | `melisa-erp-api` or approved production label |
| `NODE_ENV` | No | Must be `production` |
| `API_VERSION` | No | Match release/version note |
| `CORS_ORIGINS` | No | Production HTTPS origins only; no broad wildcard |
| `REQUEST_BODY_LIMIT` | No | Set intentionally for import/upload needs |
| `RATE_LIMIT_ENABLED` | No | Must be `true` |
| `RATE_LIMIT_WINDOW_MS` | No | Confirm with operator |
| `RATE_LIMIT_MAX` | No | Confirm with operator |
| `SLOW_REQUEST_MS` | No | Confirm monitoring threshold |
| `SQL_SERVER` | Sensitive metadata | Store on host only |
| `SQL_PORT` | Sensitive metadata | Store on host only |
| `SQL_DATABASE` | No | Must be `MELISA_ERP_V2` |
| `SQL_ODBC_DRIVER` | No | Must match installed server driver |
| `SQL_USER` | Yes | Least-privilege production SQL user |
| `SQL_PASSWORD` | Yes | Protected secret, never logged |
| `SQL_TRUSTED_CONNECTION` | No | Confirm production auth strategy |
| `SQL_ENCRYPT` | No | Review with SQL certificate/trust policy |
| `SQL_TRUST_SERVER_CERTIFICATE` | No | Must be reviewed before production |
| `SQL_READ_ONLY` | No | `false` only for approved write-capable production API |
| `JWT_ACCESS_SECRET` | Yes | Strong 32+ chars, protected secret |
| `JWT_REFRESH_SECRET` | Yes | Strong 32+ chars, protected secret |
| `JWT_ACCESS_EXPIRES_IN` | No | Confirm session policy |
| `JWT_REFRESH_EXPIRES_IN` | No | Confirm session policy |
| `WHATSAPP_ENABLED` | No | Must remain `false` unless external sending approved |
| `WHATSAPP_PROVIDER` | No | Set only if WhatsApp is approved |
| `WHATSAPP_API_URL` | Sensitive metadata | Required only if WhatsApp approved |
| `WHATSAPP_API_KEY` | Yes | Required only if WhatsApp approved |
| `WHATSAPP_INSTANCE` | Sensitive metadata | Required only if WhatsApp approved |
| `WHATSAPP_PUBLIC_API_URL` | No | Required only if WhatsApp approved |
| `WHATSAPP_TIMEOUT_MS` | No | Required only if WhatsApp approved |
| `WHATSAPP_SEND_DELAY_MS` | No | Required only if WhatsApp approved |

## Web Admin Environment

| Variable | Secret? | Production rule |
|---|---:|---|
| `VITE_API_BASE_URL` | No | Production API base URL |
| `VITE_APP_ENV` | No | `production` |
| `VITE_ENABLE_DEBUG_PANEL` | No | Must be `false` |
| `VITE_DEMO_MODE` | No | Must be `false` |
| `VITE_LOCAL_PASSWORDLESS_LOGIN` | No | Must be `false` in production |

## Terminal App Environment

| Variable | Secret? | Production rule |
|---|---:|---|
| `EXPO_PUBLIC_API_BASE_URL` | No | Production/LAN API URL for devices |
| `EXPO_PUBLIC_DEVICE_NAME` | No | Device label; no secret |
| `EXPO_PUBLIC_TERMINAL_CODE` | No | Device code; verify with terminal inventory |
| `EXPO_PUBLIC_APP_ENV` | No | `production` when field-ready |
| `TERMINAL_API_BASE_URL` | No | Test script override only |
| `TERMINAL_API_TOKEN` | Yes | Test script token; do not use `open-admin` in production |
| `TERMINAL_RUN_WRITE_TEST` | No | Must not be true without approval |
| `TERMINAL_TEST_CUSTOMER_CODE` | No | QA/test only |
| `TERMINAL_TEST_PRODUCT_QUERY` | No | QA/test only |
| `TERMINAL_TEST_CODE` | No | QA/test only |
| `TERMINAL_TEST_QUANTITY` | No | QA/test only |

## Desktop/Electron Environment

| Variable | Secret? | Production rule |
|---|---:|---|
| `MELISA_API_HEALTH_URL` | No | Target API health URL |
| `MELISA_WEB_URL` | No | Target web-admin URL |
| `MELISA_LOCAL_PASSWORDLESS_LOGIN` | No | Must be `false` outside local dev |

## Verification Checklist

| Check | Status |
|---|---|
| API env exists only on target host or approved secret store | Pending |
| Web-admin env is set before build | Pending |
| Terminal env is set for physical device build/test | Pending |
| No `.env.local` is committed | Pending |
| No secret values are copied into docs/chat/screenshots | Pending |
| JWT secrets are strong and unique | Pending |
| SQL user is least-privilege | Pending |
| CORS origins are production-only | Pending |
| Local passwordless login is disabled | Pending |
| WhatsApp sending is disabled unless approved | Pending |

## Approval Gate

Changing or creating production env values requires explicit Melih approval.

Use this approval shape:

```text
I approve production env setup for [target host].
Secrets will be entered outside Git/chat/docs.
No deploy, migration, backup, restore or external sending is approved by this env setup alone.
```
