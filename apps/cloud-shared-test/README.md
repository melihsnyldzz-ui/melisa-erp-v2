# Shared synthetic Cloud TEST

Existing scope: ERP09 sales/collection, incoming-goods receiving, CRM06 catalog/order draft. This is a separate synthetic source adapter, not the Windows/shared TEST runtime or a new completion tracker. Human/device acceptance remains pending.

The ERP entry mounts the existing `createWorkReceiving`, `createWorkSales` and `createWorkCollections` controllers. CRM companion PR20 uses the existing `CatalogBuilder`, `ERPOrderDialog` and `NativeOrderReceiptDisplay`. Each uses `/api/cloud-test` against one server database. Business records are never sourced from browser storage; existing UI retry/selection journals remain browser-local.

## Sources and validation

ERP source base: PR23 branch `codex/erp-finish-20261004` at `5ab4f84273430562b881a6dbd56a64b74541b7b4`. CRM source base: PR19 branch `codex/crm-personnel-inbox-current-20261018` at `03a86097c3fd25551f1faab34881f60ec0fea75b`. Candidate19 and local/shared TEST are untouched; PR31/32 are not repeated. No main merge.

Node 24 is required. Run the isolated backend tests and ERP build:

```sh
node scripts/ci/run.mjs cloud-shared
node --test apps/sites-workflow/src/cloudTest/cloudTest.test.mjs
```

In the CRM companion checkout, install its existing locked frontend and gateway dependencies without lifecycle scripts, then run:

```sh
node scripts/ci/build-cloud.mjs
node --test apps/frontend/tests/cloud-test-api.test.mjs
```

## Loopback QA

Build outputs are `apps/sites-workflow/dist/cloud-test` and the companion CRM `apps/frontend/dist/cloud-test`. Pass absolute build paths and a dedicated new database path:

```sh
node apps/cloud-shared-test/server.mjs /tmp/melisa-synthetic.sqlite /absolute/erp/build /absolute/crm/build
```

The printed loopback URL serves `/erp/`, `/crm/`, and `/terminal/`. The terminal entry mounts the same real receiving/sales controllers in the responsive shell; it is not a native Android device test. Simulated personnel15, manager16, Angela17 and other personnel18 are fixed synthetic roles; this never changes real authentication. CRM dialog input must be synthetic only; its username/password are not transmitted.

Two products101/102 start with10/8 pieces; customer501 belongs to personnel15/Angela17, customer502 to18; supplier601 is synthetic. Four received pieces of101 add stock only at manager approval. A CRM order for2 pieces creates no stock/debt/collection/reservation effect. Sale finalization then yields stock12 and debt50TRY; manager collection20TRY leaves debt30TRY. UUID journal/revisions prevent repeated effects. SQLite reopen and D1 CAS/concurrent handles are covered by tests. There is no reset/delete API.

The optional `browser-smoke.mjs` uses an already installed Playwright Core entry and Chromium executable. It creates its own fresh synthetic SQLite file and loopback host, tests the real UI at390×844, writes only synthetic screenshots/result JSON, then closes the browser/server:

```sh
node apps/cloud-shared-test/browser-smoke.mjs /absolute/erp/build /absolute/crm/build /absolute/playwright-core/index.mjs /absolute/chromium /tmp/melisa-browser-evidence
```

## Owner-private Sites handoff

```sh
node apps/cloud-shared-test/build-worker.mjs /absolute/erp/build /absolute/crm/build /tmp/melisa-cloud-worker
```

The output contains a standalone ESM `server/index.js` with both frontend builds embedded, plus `drizzle/0001_synthetic.sql` and `drizzle/meta/_journal.json`. The SQL is copied byte-for-byte from source `migrations/0001_synthetic.sql`; the journal declares one SQLite migration and two statement-separated schema operations. There is no seed or data mutation in that migration. It has no Node imports or real ERP providers. Hosting requires a dedicated D1 binding named `DB`, that migration applied through the supported Sites migration path, and owner-private Site access. The Worker also requires Sites' authenticated visitor identity header; the opaque synthetic role session is separate. Do not expose this role simulator publicly or reuse a real database binding.

For the parent's supported Worker ESM starter: copy generated `server/index.js` to its `worker/index.js`, and generated **entire `drizzle/` tree to the Site project root `drizzle/` before invoking the native build/source helper**. The native packager must then preserve it at `dist/.openai/drizzle/`. Validate both tables were migrated before testing the hosted API; schemaManaged mode intentionally returns503 if absent. Do not deploy the Worker bundle alone. The journal/SQL reader layout and statement separator were checked against the [Drizzle 0.44.7 migration reader](https://github.com/drizzle-team/drizzle-orm/blob/0.44.7/drizzle-orm/src/migrator.ts); native Sites packaging/deployment must still be checked by the parent.

The managed runtime accepts the known `__drizzle_migrations` bookkeeping table only after checking its three expected columns; a foreign table using that name is rejected before seeding. Runtime performs no DDL. The real Drizzle reader was run against the generated artifact and applied both statements to a fresh SQLite database: exactly `synthetic_state` and `synthetic_sessions`, zero rows before runtime initialization.

This environment lacks the required installed Sites `project-setup.mjs`, `set-project-id.mjs`, and `site-workflow.mjs` helpers. No Site registration, source-helper package, save-version, or deployment has been attempted. The application output is **not yet a verified Sites archive**. The owning parent can use the supported Worker ESM starter/helper in its authorized Sites environment, set the actual returned project ID and D1 declaration, preserve private access, package/push the exact source, then call the native private save/deploy operation. Do not invent an ID, credential, helper, or deployment result.

The local/API/build results are separate from hosted browser access, real Windows/Vega/TEST integration, physical terminal/phone testing and human acceptance. No LIVE, Vega, T1, commercial/customer data, messages, SQL/config/service/auth changes or paid API is involved.
