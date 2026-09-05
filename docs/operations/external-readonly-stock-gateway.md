# External Read-Only Stock Gateway

## Goal
Expose only the minimum stock-reading surface needed by an external assistant without exposing the normal ERP API or SQL Server.

## Architecture

VEGA / MELISA read-only SQL -> Bionic stock service -> isolated gateway on 127.0.0.1:4112 -> HTTPS tunnel -> external assistant.

The normal ERP API port must not be forwarded by the tunnel.

## Public whitelist

Only these routes exist on the isolated gateway:

- `GET /openapi.json`
- `GET /health`
- `GET /stock-codes/count?source=vega`
- `GET /stock-codes?source=vega&search=...&limit=...`
- `GET /stock-codes/:stockCode?source=vega`

There is intentionally no generic SQL route, table/schema discovery, write route, auth/admin route, CRM route, finance route, messaging route, or shipping route.

## Local secrets

Configure only in local environment / approved secret storage. Never commit values.

```text
EXTERNAL_READ_ONLY_ENABLED=true
EXTERNAL_READ_ONLY_HOST=127.0.0.1
EXTERNAL_READ_ONLY_PORT=4112
EXTERNAL_READ_ONLY_API_KEY=<strong-random-secret>
EXTERNAL_READ_ONLY_PUBLIC_BASE_URL=https://<public-https-host>
EXTERNAL_READ_ONLY_MAX_ROWS=100
EXTERNAL_READ_ONLY_RATE_LIMIT_PER_MINUTE=60
```

The database account behind the stock service must remain SELECT-only. The gateway API key is an additional HTTP-layer guard; it is not a replacement for database least privilege.

## Start locally

From `apps/api`:

```powershell
npm run start:external-readonly
```

The server binds to `127.0.0.1` by default. Verify that port 4112 is not listening on a LAN/public interface.

## HTTPS tunnel test

With `cloudflared` installed and local environment variables loaded:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-external-readonly-tunnel.ps1
```

For a temporary quick tunnel, cloudflared prints a public HTTPS URL. Set `EXTERNAL_READ_ONLY_PUBLIC_BASE_URL` to the final HTTPS origin before using `/openapi.json` as an integration schema.

For long-lived use, prefer an authenticated named tunnel/domain and access policy. Do not expose SQL Server and do not forward the normal ERP API port.

## Acceptance checks

1. `GET /openapi.json` contains only the five whitelisted paths above.
2. Calls without `x-melisa-read-key` fail with 401.
3. Calls with the correct key can read health, count, list and one stock card.
4. Unknown paths return 404.
5. `POST /query`, `/tables`, normal ERP routes and all write routes are unavailable on port 4112.
6. Database permission checks remain SELECT allowed and INSERT/UPDATE/DELETE/ALTER/CREATE denied.
7. Default business source is Vega in the external route contract.
8. No secrets appear in Git, logs or API responses.

## Source compatibility note

The external gateway forwards `source=vega|melisa` into the Bionic stock service. The live runtime must contain the already-verified source-aware Bionic implementation before production use. If the source-aware Vega change exists only locally, commit/review it separately and reconcile it before enabling the tunnel.
