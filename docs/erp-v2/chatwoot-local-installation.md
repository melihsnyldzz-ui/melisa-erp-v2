# Chatwoot Local Installation

Chatwoot Community Edition is deployed as an isolated Docker Compose stack on the ERP server computer.

## Runtime

- Chatwoot web: `http://192.168.1.46:3100`
- Image: `chatwoot/chatwoot:v4.14.2-ce`
- Internal PostgreSQL with pgvector
- Internal Redis 7
- Persistent database, Redis and attachment volumes
- Turkish default locale
- Local attachment storage

PostgreSQL and Redis are not published to the LAN. Only port 3100 is published for the Chatwoot web interface.

## First login

The first administrator account has been created and public account signup is disabled with `ENABLE_ACCOUNT_SIGNUP=false`.

## Evolution WhatsApp inbox

The connected Evolution API instance `sirket-hatti-1` is linked to Chatwoot account `2` as the API inbox `Melisa WhatsApp Satis`.

- Evolution API: `http://192.168.1.46:8080`
- Chatwoot inbox webhook: `http://192.168.1.46:8080/chatwoot/webhook/sirket-hatti-1`
- Inbox type: `Channel::Api`
- `SAFE_FETCH_ALLOW_PRIVATE_NETWORK=true` is required in the local Chatwoot environment because the Evolution webhook is intentionally hosted on the private LAN. Keep this setting limited to the trusted local installation; do not expose arbitrary webhook editing to untrusted users.
- New incoming WhatsApp conversations are forwarded to Chatwoot.
- Replies written in this inbox are routed back through Evolution API.
- Bulk contact and historical-message imports are disabled. This avoids creating large or duplicate datasets during initial rollout.
- When history import is disabled, Evolution must keep `CHATWOOT_IMPORT_DATABASE_CONNECTION_URI=postgres://user:password@hostname:port/dbname`. Leaving the variable unset activates Evolution's fallback `host:5432` connection; WhatsApp delivery may succeed but Chatwoot can incorrectly mark the message failed after a `Net::ReadTimeout`.
- The Chatwoot administrator is assigned to the inbox.

### Country routing teams

Country queues use the Turkish country name with a compact flag in the team name, for example `Türkiye 🇹🇷` and `Almanya 🇩🇪`. New individual conversations are routed from the verified phone-number prefix. Group conversations use `Gruplar 🌐` because a group itself has no country phone number.

Create or repair the teams and automation rules:

```powershell
node scripts\configure-chatwoot-country-routing.mjs
```

The script is idempotent, does not print access tokens, and routes existing conversations without removing their current labels or individual agent assignments.

Do not copy the Evolution API key or the Chatwoot personal access token into documentation, logs, screenshots, or source control.

## ERP CRM second password

ERP and terminal users must first authenticate with their personal ERP account. WhatsApp CRM then asks for the separate CRM password. The local service stores only `WHATSAPP_CRM_ACCESS_PASSWORD_HASH`; the plain password must not be committed or written into documentation. Unlock tokens expire after the configured `WHATSAPP_CRM_ACCESS_TOKEN_EXPIRES_IN` duration and are bound to the ERP user that unlocked the screen.

## Operations

Install or repair:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-chatwoot-local.ps1
```

Start:

```powershell
docker compose -f infra\chatwoot\docker-compose.yml up -d
```

Stop:

```powershell
docker compose -f infra\chatwoot\docker-compose.yml stop
```

Chatwoot is included in the ERP server watchdog after the generated `.env` exists.
