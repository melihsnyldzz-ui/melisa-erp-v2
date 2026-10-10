# Melisa Hub frontend

Buildless internal portal at `/melisa-hub/`. The serving application must deliver `index.html`, `hub.css`, `hub.mjs`, and `catalog.mjs` with correct content types. It must expose the following two same-origin, no-cache JSON routes after the network/environment audit. These JSON documents contain only sanitized navigation and health metadata; never credentials, database connection strings, customer data, private filesystem paths, or raw evidence.

## Configuration contract

```json
{
  "environment": "ISOLATED_TEST_COPY",
  "checkedAt": "2026-10-11T12:00:00.000Z",
  "erp": {"enabled": true, "validated": true},
  "crm": {"enabled": true, "validated": true, "port": 62700},
  "test125": {"enabled": false, "validated": false, "url": null},
  "live": {"enabled": false, "validated": false, "url": null},
  "links": [],
  "access": {"verified": false}
}
```

`GET /melisa-hub/config.json`: missing/invalid config, a different environment, or invalid/future `checkedAt` keeps app navigation closed. ISO timestamps should reflect a real configuration audit. ERP requires explicit `erp.enabled: true` and `erp.validated: true`; absent/false flags close TEST navigation. Config is re-read on manual refresh, reconnect and every five minutes while visible. CRM requires explicit `enabled` and `validated` flags; it uses the current origin hostname with the audited port `62700`. HTTPS cannot open this HTTP-only direct-port configuration. A future same-origin reverse proxy can instead supply `crm.path`, such as `/crm/`, after its login/session behavior is verified.

TEST125 requires `enabled: true`, `validated: true`, and a URL on the current hostname and protocol, either the current port or audited port `5194`. For hostname-independent configuration, an audited backend can return the current request hostname after validating its Host header. No blind substitution is performed by the frontend. LIVE requires the same explicit flags, a URL on the current origin, and a user acknowledgment in the live warning dialog. LIVE origins/ports beyond this contract need a reviewed implementation change; flags cannot unlock chat/accounting or another arbitrary port. No public localhost destination is accepted.

Optional `access: {verified:true, summary:"...", clientVerification:"..."}` provides a sanitized factual network audit summary. Only describe an actual observed result. Keep company and client verification distinct. A LAN address from home needs a configured subnet route; otherwise supply the audited Tailscale IP or MagicDNS route in the summary. Private management report/video URLs are never published by this portal.

## Status contract

```json
{
  "checkedAt": "2026-10-11T12:00:00.000Z",
  "services": {
    "erp": {"state": "reachable", "detail": "HTTP 200; kullanıcı girişi ayrıca kontrol edilir."},
    "crm": {"state": "unknown", "detail": ""},
    "terminal": {"state": "unknown", "detail": ""},
    "training": {"state": "unknown", "detail": ""},
    "test125": {"state": "unknown", "detail": ""},
    "live": {"state": "unknown", "detail": ""}
  },
  "acceptance": "pending"
}
```

`GET /melisa-hub/status.json`: allowed states are `reachable`, `unreachable`, and `unknown`. Unknown/absent checks stay unknown. Results older than five minutes are displayed as unverified. The portal polls only this endpoint every 30 seconds when visible, with an eight-second request deadline. Checks must use a fixed read-only route allowlist, not user-provided destinations or commercial endpoints. HTTP reachability does not establish login, permissions, transaction correctness, a home client's route, or human acceptance. The UI always keeps actual human/device acceptance pending; `acceptance` cannot silently mark it complete.

## Extension

`catalog.mjs` holds static page metadata and the eight lesson IDs, verified against `src/training-guide/lessons.mjs`. Static future pages and optional runtime `links` use this shape:

```json
{"title":"Yeni ekran", "description":"Kısa Türkçe açıklama", "path":"/approved-screen.html", "service":"approved-service", "environment":"ISOLATED_TEST_COPY", "verified":true}
```

Extensions must be same-origin TEST routes. They cannot supply LIVE links, private files, scripts, credentials, protocol-relative addresses, or arbitrary ports. The helper exports `safeInternalUrl`, `crmUrl`, `isPrivateHost`, and `availability` for focused checks. The portal never reads authentication storage or issues commercial writes; ERP/CRM continue to own their normal login and authorization.
