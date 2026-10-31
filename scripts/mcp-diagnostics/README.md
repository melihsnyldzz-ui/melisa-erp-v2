# Current business TEST diagnostics over the existing MCP connection

The three read-only tools extend the already installed Deploy Control MCP transport.
They observe the 5244 business web, 4144 ERP API, 4146 native reader, and
`MELISA_ERP_SIRKET_TEST_20260929_01`. They do not deploy ERP, submit/retry sales,
edit a browser journal, or enable any of the old blocked deploy operations.

| Tool | Input | Evidence returned |
| --- | --- | --- |
| `get_runtime_status` | none | Process identity before/after health reads; API/native package and source; independently verified read-only SQL identity. Web version is explicitly unavailable. |
| `diagnose_sale_request` | original `requestId` UUID | Journal/creation link and invoice relationship; bounded, exact-UUID structured log error codes, when recorded. |
| `verify_sale_effects` | original `requestId` UUID | Invoice status, per-product exact stock movements, correct currency/customer account ledger, finalized cancellation reversal. A cancelled invoice without movements remains unknown. |

Missing journal entries, SQL errors, lock contention and unavailable evidence return
`unknown`. A draft is not a completed sale. A consistent SQL result is not normal
screen acceptance. The tools never authorize a retry. Raw payloads, SQL text,
credentials, customer names and balances are not returned.

## Installation boundary

Use a private JSON binding outside Git with `version: 1`, `port: 4213`, `database`,
absolute `powerShell`, `tokenFile`, read-only `runtimeConfig`, `legacyConfig`,
`legacyMapping`, `services`, up to four explicit `logFiles`, and SHA-256-pinned
`library.server`, `library.tools`, and `library.observer` (`path`, `sha256`).
Each service supplies its fixed `role`, `port`, `executable`, `script`, and API/native
`runtimeConfig`. No tool caller controls these values. Never put credentials in
arguments, logs, a source checkout or this binding; reuse the existing token file
and read-only runtime credentials by reference.

The extension uses the existing authenticated loopback transport and secure tunnel.
That transport retains bearer-token, Host/Origin, request-size and rate checks.
All existing mutating observer methods still reject with `EXTERNAL_TEST_OBSERVE_ONLY`.
`get_deploy_status` retains the old mapping, marks it as legacy, and includes
`currentBusinessTest` separately.

Run `server.mjs` with `MELISA_MCP_BINDING_FILE` set to the private binding. Only the
dedicated MCP listener/supervisor may be replaced; API, native, web, SQL settings,
runtime credentials, old source copies, and business data stay untouched.
Keep a verified before-image of the MCP launch selection for a bounded rollback.

## SQL reading

The fixed reader uses `tcp:Semih,1433` on host SEMIH because the installed SQL
certificate names Semih. Encryption and certificate verification remain enabled.
After connecting it checks server, database, existing read-only login, privileges,
and SELECT/INSERT/UPDATE/DELETE permissions for all seven queried tables.
Only parameterized, fixed SELECTs run; there is no arbitrary SQL tool or writer
credential. Session-local lock timeout is 500 ms. A short SERIALIZABLE read
transaction keeps journal/invoice/effects consistent without changing shared DB
isolation settings. Journal reads use its UUID primary key; no history JSON scan
or unindexed request-to-invoice fallback runs. New queries stop after a 1.5 second
transaction budget; each command has a 1 second timeout. Process timeout is 12 seconds.
Any contention/error closes the connection and returns unknown.

## Verification

`node --test scripts/mcp-diagnostics/diagnostics.test.mjs`

These offline tests also run in the existing quality CI task. They cover identity
and argument rejection, safe journal linking, exact decimal effects, cancellation,
duplicate/missing/wrong-account movements, unknown outcomes, data redaction and
preservation of blocked legacy writes. Real MCP transport and installed-target
readback are separate from these fixture tests and from business sale acceptance.
