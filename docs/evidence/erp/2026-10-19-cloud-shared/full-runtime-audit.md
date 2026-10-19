# Full ERP, CRM and terminal correction — 19 October 2026

The user rejected the narrow Cloud adapter as the full ERP installation and explicitly requested the full existing ERP, CRM and terminal. Only the synthetic dataset may be small; product scope must not shrink. **Full installation is BLOCKED on missing isolated backend/storage infrastructure.** No replacement mock, additional menu, demo-mode switch or full-installation claim was produced.

## Existing application versus the published adapter

Sources were inspected read-only: ERP PR55 `aa2035b4bf24062e107d0365452e8fc0d61d22dc`, current integrated ERP candidate PR54 `691f889aa9e87f1c0b840963621add48387699f9` including PR53 layout `7abf962a6446eb3a800babd5b54312a8b913d814`, and CRM PR20 `f5ad566b852425ed21d3ec9e87b783b85e90b890`. The local/shared TEST candidate was not modified or installed. PR55's base is the older PR23 `5ab4f84273430562b881a6dbd56a64b74541b7b4`; 36 workflow files differ from PR54, including office layout, receiving recovery, reports and collections. Those updates were not silently merged into the Cloud package.

The actual shared ERP web startup serves `ornek-akis.html` and `terminal.html` through `apps/api/src/services/sharedCopyWebApplication.mjs`. Hub landing is a separate option. The source `index.html` redirects to `is-akisi-taslagi.html`, whose entry is `src/workflow/testSales.js`; it is not the shared business runtime. The React `App.jsx`/Workspace is under `legacy-admin.html`, with 55 registered screens. Registration or a visible menu does not establish backend functionality. The complete route and registered-screen inventory is [full-runtime-audit.json](full-runtime-audit.json).

The machine inventory also records 31 CRM `liveApi` methods and literal source route declarations (345 ERP,53 CRM, including middleware `use` entries). These are source declarations, not counts of successfully mounted/accepted endpoints; dynamic registrations and runtime authorization remain subject to actual backend verification.

The current business ERP has these 15 hash routes:

| Existing route | Existing controller | PR55 narrow entry |
| --- | --- | --- |
| home | workHome | Absent |
| stock | workCatalog | Absent |
| goods | workReceiving | Narrow synthetic API |
| purchases | workPurchases | Absent |
| sales | workSales | Narrow synthetic API |
| receipts | workSales receipt view | Narrow synthetic API |
| customers | workCustomers | Absent |
| suppliers | workSuppliers | Absent |
| collections | workCollections | Narrow synthetic API |
| supplier-payments | workSupplierPayments | Absent |
| count | workCount | Absent |
| returns | workSupplierReturns | Absent |
| approvals | native approval summary in liveData | Absent |
| reports | workReports | Absent |
| settings | workSystemSettings | Absent |

PR55 `src/cloudTest/main.js` mounts only receiving, sales and collections. Its `/` and `/terminal/` aliases point to `cloud.html`; the latter hides some controls and is not `personnelTerminal.js`. The backend `apps/cloud-shared-test/application.mjs` implements only receiving, CRM drafts, sale finalization and collection families.

Full CRM is `apps/frontend/src/main.jsx` → `App.jsx`: inbox/conversations, assignments, customers, management, catalog, drafts, media and translation/provider features. PR20 `cloudTest/main.jsx` mounts only `CatalogBuilder`, `ERPOrderDialog` and receipt display. The normal CRM asset Worker proxies `/api/live/` to a configured gateway; it does not contain that gateway. No CRM source was edited in this audit. If runtime becomes available, the CRM owner should own `apps/frontend` full-entry build and gateway-contract verification; the shared backend/origin/deploy changes must retain one writer.

The full web terminal entry `terminal.html` → `personnelTerminal.js` includes six ordinary actions (receiving, sales, assigned CRM, products, count and returns), or the separate worktest set including packing. Its CRM iframe/session bridge is not supplied by a responsive ERP shell. Native `apps/terminal-native` is Kotlin/Compose, JDK17/SDK36, with an APK installation and hardware acceptance path. Its worktest build permits only `http://192.168.1.46:5234` or `http://127.0.0.1:5234`; another origin is rejected. The older Expo `apps/terminal-app` is a different source. No APK, physical device, scanner or native session-vault installation occurred here.

## Proven runtime and storage gap

| Dependency | Existing source evidence | Current Site gap |
| --- | --- | --- |
| ERP Node server | `apps/api/src/server.js`, `app.js`: Express middleware, listener, uploads | Current artifact only exports a Fetch Worker; it packages no full ERP API |
| ERP SQL Server | `config/database.js`: mssql and msnodesqlv8, trusted ODBC in TEST/copy mode | D1 is SQLite, not the existing SQL Server schema/procedures |
| Normal auth | `authService.js`: dbo.users/roles/permissions/refresh tokens | No isolated SQL-backed ERP identity store or approved cloud authority was supplied |
| Transactions and procedure proofs | `workSupplierPaymentStore.mjs`, `workInboundStore.mjs`: SERIALIZABLE, sp_getapplock, procedure/identity checks | Existing SQL semantics and proofs cannot be supplied by renaming a D1 binding |
| Write isolation | `writeGuardService.js`, isolated-copy bootstrap | New cloud target must be explicitly proven; existing TEST/production identities must not be impersonated |
| CRM gateway/storage | CRM `apps/gateway/src/server.js`, `services/db.js`, `repositories/crmRepository.js` | Node gateway and PostgreSQL-backed persistence are separate from the asset Worker; durable session/media paths also need a real persistence design |
| CRM conversations/providers | `chatwootInboxService.js`, send/translation services | No isolated synthetic conversation/provider service is supplied. Real messages, production credentials and paid calls remain forbidden |
| Terminal origin/session/packing | `personnelTerminalModel.mjs`, `workingCatalogSession.mjs`, terminal-persistent support | Current LAN origin, protected-session and packing contracts have no approved hosted full-runtime counterpart |
| Physical integration | `terminalReceiptPrintService.js` rejects non-Windows; native build/device permissions | A Site cannot establish Windows printer, scanner or physical Android installation |

This is not a claim that Express is universally impossible in Workers. Current [Workers Node compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/) supports many Node APIs and some partial/stub APIs. That does not provision this application's SQL Server, native ODBC, durable files, protected device bridges or isolated CRM provider. [D1 SQL documentation](https://developers.cloudflare.com/d1/sql-api/sql-statements/) explicitly describes SQLite conventions; it is not a SQL Server replacement.

Seven offline probes passed and recorded the actual incompatibilities in [full-runtime-probe.json](full-runtime-probe.json): fresh SQLite rejects the three representative SQL Server forms; the current TEST session resolver returns null for the hosted origin; the terminal CRM bridge rejects that origin; demo customer movements return `DEMO_DATASET_UNAVAILABLE`503; the demo operational queue is incomplete. No network, environment/credential read, actual SQL Server or production access was used. A separate read-only backend reviewer confirmed the source findings. Existing browser `operationsRepository.js` is localStorage plus a tab lock; enabling demo mode would neither provide a shared server database nor all features.

Reproduce with `node docs/evidence/erp/2026-10-19-cloud-shared/full-runtime-probe.mjs` from the repository root. The optional output path writes only that bounded offline result JSON. This diagnostic does not start any backend or connect to a database/service.

## Shortest safe continuation and exact blockers

Keep the current private Site and existing product screens. Provide an authorized private backend runtime capable of running the existing full Node services, plus a **separate synthetic SQL Server** with the actual schema/procedures and an isolation proof. Provide the CRM gateway's synthetic durable stores and a real isolated conversation/provider service, with no external customer delivery or paid API. Then integrate the approved full ERP candidate, full CRM entry and full web terminal against those services, preserve normal role/session/write checks, and verify all route families, persistence, replay and cross-personnel isolation. Native terminal packaging/origin authority and real device acceptance remain a distinct step.

No usable full backend endpoint, synthetic SQL Server deployment, approved new-target proof, CRM synthetic provider or credentials for such services were supplied or verified. New auth/origin/secret changes are outside this authorization. No credential was requested or copied; no existing Windows/shared TEST service was used as a substitute. The exact blocked action is **deploy and verify the full ERP/CRM/web-terminal runtime on the existing private Site**. Status: pending required infrastructure/authority, **not denied and not executed**. A D1 reimplementation of all business services would be a large port, not a configuration fix.

No new full-runtime deployment archive is offered: shipping the full HTML with missing APIs would reproduce the rejected delivery. The existing aa2035b4 Worker package/provenance remains the limited three-flow artifact only. This audit has no new application bundle, migration, reset, credential/security change or deployment.

## Hosted evidence retained, with its actual scope

Parent reports authenticated GUI checks on the same owner-private Site at **15:52–15:59 UTC**, using ERP `aa2035b4` and unchanged CRM `f5ad566b`: four received pieces approved → stock10→14; CRM2×25TRY draft handed to ERP; finalized sale → stock12/debt50TRY; collection20TRY → remaining30TRY; refresh persistence and personnel18 isolation passed. This is trusted parent readback, not independently replayed in this audit. It supersedes the earlier hosted startup failure only for those tested flows. It does **not** establish full ERP/CRM/terminal completion or human acceptance.

Original 49 ERP/25 CRM requirements and completion counts remain unchanged; human acceptance is pending. LIVE/Vega/production data, real messages, paid services, shared Windows TEST, main merge and deletion were untouched.
