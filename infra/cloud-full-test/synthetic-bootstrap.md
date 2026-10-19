# Fresh synthetic ERP source feasibility — not an installer

Pinned full ERP source: `691f889aa9e87f1c0b840963621add48387699f9` (PR54). Existing work remains on PR55. Original ERP09 / C01–C04–C05 and supporting P03 installation scope; 49/25 counts and human acceptance stay unchanged.

## Feasibility

The offline inventory scanned 751 implementation-source Git blobs, with individual SHA256/byte provenance: 426 exact textual object names, 281 literal CREATE candidates, 13 reviewed helper-created tables, 159 FK-reference candidates and 59 index candidates. These are source captures, not deployed object counts or T-SQL validation. 81 dynamic CREATE/ALTER templates remain unresolved; NO_CREATE_CAPTURED alone does not prove an object is absent.

A complete fresh installation cannot yet be derived safely. Independent read-only discovery also inspected the broader tracked source set and confirmed the 25 base-DDL gaps below. No absent columns, procedure behavior, FK/index rules or historic provenance were inferred from queries. All 16 literal dbo procedure execute calls examined by the reviewer had DDL source; this is not a claim that all dynamic modules/dependencies are complete.

## Exact reviewed missing starting DDL

Every name below is referenced by existing implementation. The listed location is one source witness, not an instruction to execute it.

| Base table | Source witness at pinned revision |
| --- | --- |
| `dbo.customer_route_assignments` | `apps/api/src/services/nativeCustomerRoutes.mjs:67` |
| `dbo.customer_routes` | `apps/api/src/services/nativeCustomerRoutes.mjs:67` |
| `dbo.invoice_return_items` | `apps/api/scripts/vega-native-migration-store.mjs:39` |
| `dbo.invoice_returns` | `apps/api/src/services/homeSummaryReadStoreFactory.mjs:13` |
| `dbo.terminal_device_customer_routes` | `apps/api/src/services/nativeCustomerRoutes.mjs:67` |
| `dbo.test_daily_accounts` | `apps/api/src/services/testDailyService.mjs:112` |
| `dbo.test_daily_drafts` | `apps/api/src/services/homeSummaryReadStoreFactory.mjs:12` |
| `dbo.test_daily_requests` | `apps/api/src/services/testDailyService.mjs:38` |
| `dbo.test_daily_scope` | `apps/api/src/services/invoiceDraftService.js:3155` |
| `dbo.test_finance_accounts` | `apps/api/src/services/testFinanceService.mjs:47` |
| `dbo.test_finance_requests` | `apps/api/src/services/testFinanceService.mjs:33` |
| `dbo.test_goods_receipts` | `apps/api/src/services/homeSummaryReadStoreFactory.mjs:12` |
| `dbo.test_payment_accounts` | `apps/api/src/services/testPaymentService.mjs:34` |
| `dbo.test_payment_invoices` | `apps/api/src/services/testPaymentService.mjs:35` |
| `dbo.test_payment_requests` | `apps/api/src/services/testPaymentService.mjs:27` |
| `dbo.test_payment_suppliers` | `apps/api/src/services/testPaymentService.mjs:33` |
| `dbo.test_purchase_links` | `apps/api/src/services/invoiceDraftService.js:3161` |
| `dbo.test_purchase_requests` | `apps/api/src/services/testPurchaseService.mjs:40` |
| `dbo.test_purchase_scope` | `apps/api/src/services/invoiceDraftService.js:3163` |
| `dbo.test_purchase_warehouses` | `apps/api/src/services/testPurchaseService.mjs:20` |
| `dbo.test_refund_requests` | `apps/api/src/services/testRefundService.mjs:21` |
| `dbo.test_refund_scope` | `apps/api/src/services/testRefundService.mjs:29` |
| `dbo.test_sales_requests` | `apps/api/src/services/testFinanceService.mjs:50` |
| `dbo.test_sales_scope` | `apps/api/src/services/testFinanceService.mjs:11` |
| `dbo.test_stock_reversals` | `apps/api/src/services/testStockReversalService.mjs:39` |

## Available definitions must not be misreported as absent

`party_entities`, `party_currency_accounts`, `party_source_links`, `product_prices`, `product_source_aliases` and eight further tables have source helper definitions in `apps/api/scripts/vega-native-migration-store.mjs:7–20`. The reviewed helper makes an identity id PK and the supplied plus six common nullable columns. It does not justify adding invented FKs/NOT NULL constraints. Its surrounding migration runtime reads historical data and was never imported. The current manifest captures helper locations without executing it.

`test_goods_batches`, `work_trade_*`, stage4 copy/guards and revision registry definitions have source. Many require old restore seals, source hashes, actor/row identities and exact predecessor definitions. They are source-present, provenance-dependent builders, not fresh synthetic installation scripts. Literal constants inside SQL templates are resolved conservatively; ambiguous names remain unresolved. No old backup, SQL data or .private file was inspected.

## Separate inert synthetic profile and proof requirements

`synthetic-profile.json` binds a distinct internal erp-sql / MELISA_CLOUD_FULL_TEST_20281019 target, new application/read-only principal names, new internal port proposal, source SHA and inventory digest, FRESH_SYNTHETIC origin, no backup/business data and disabled external providers. It contains no credentials. Unknown options, changed provenance, legacy server/DB/login/ports, restored origin and provider enablement reject.

`compileSyntheticPreparation()` always emits canApply=false, canStart=false and runtimeGrant=null, even for a tiny apparently complete inventory. This is a SOURCE PLAN CONTRACT, not implemented full API runtime registration or a security proof. Existing Windows/Vega/copy validation, normal auth, role/grant rules and startup files were not modified. The public Compose still targets its original guarded entry points; it is not wired to bypass them.

The plan records the remaining fresh schema/module/grant manifest, deterministic hashes, setup/app/reader separation, SERIALIZABLE transactions, journal/replay/effect and cross-personnel checks, genuine SQL readback and source/release/DB identity binding. Missing proof is never replaced with synthetic PASS, old backup hashes or forged historical counts.

## Seed preparation

The new plan preserves only the already specified logical tiny synthetic catalog: two products (10 and 8 pieces, TRY25 and TRY40), two customers, one supplier and four test roles; no real contacts, credentials or business documents. SQL column/ID/account mapping is blocked by incomplete full schema; no seed SQL is emitted. Original seed 0002 includes negative stock/package-unit edge cases, so it is inventoried and explicitly NOT selected for clean-runtime replay.

## Reproduction and evidence limits

```sh
node scripts/canonical/generate-full-synthetic-preparation.mjs --check
node --require ./scripts/ci/offline-guard.cjs --test scripts/canonical/full-synthetic-preparation.test.mjs
```

The generator uses only fixed local Git ls-tree/show for the pinned revision and fixed public output paths; --write regenerates the three JSON artifacts. It does not fetch source, import source modules, inspect runtime/backup/secret files, invoke Docker, connect to SQL or start an app. The pure compiler tests run under the unchanged CI offline boundary, including tamper/origin/legacy-target rejection and non-grant tests. An initial test-first run failed because the compiler did not yet exist; the source tests then pass. This is not a before/after SQL-runtime regression.

SQL was NOT applied or syntax-validated by a SQL Server engine. Normal API/UI/device acceptance is NOT RUN. A researched x86 Ubuntu /16GB/256GB OverlayFS host is a candidate only, not purchased or verified; private browser hosting remains separate. Existing containers, volumes, credentials and network were not changed in this continuation. No EULA accepted or external publication performed.

## Targeted validation and review

29/29 offline tests PASS (12 new preparation + 17 unchanged copy/bootstrap boundary tests), no skips. Independent read-only review GO after two P2 corrections: the real finops installer named fixture is included, and ERP web5810 matches the existing inert proxy while CRM uses4812. Both defects in the initial preparation draft reproduced as two failing tests before correction; these are source-preparation regressions, not SQL-runtime proof. See [sanitized receipt](source-preparation-receipt.json). Full source/SQL build, migration and application startup were not performed.
