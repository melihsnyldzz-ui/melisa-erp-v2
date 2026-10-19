# Full synthetic TEST preparation — not installed

This is an inert full-runtime deployment draft for the **existing full ERP, CRM and web terminal**, not another business adapter. User approval for NEW isolated TEST database users and application keys arrived at18:02:14UTC; a separate ignored private directory now contains newly generated local TEST values (directory0700/files0600). SQL Server/ODBC EULA acceptance, paid services, external secret transfer and external network/security changes were not authorized. Independent PostgreSQL/Redis/Chatwoot setup was attempted under that approval. Two PostgreSQL services and Redis are healthy; real Chatwoot preparation completed exit0 with89tables. Web/worker creation then failed because32GB workspace storage reached100% under Docker vfs. Only the successful owned migration compute container was removed, without volume removal; DB readback still shows CRM6/Chatwoot89tables and2.4GiBfree. The full app did not start. See the [sanitized runtime receipt](../../docs/evidence/erp/2026-10-19-cloud-shared/isolated-runtime-receipt.json). The full ERP is not installed, the existing Site is unchanged, and no user-accessible URL is claimed. Full services require the explicit `pending-approval` profile, now meaning unresolved license/schema/release/access gates; the public draft has no host `ports`, privileged mode, host network, host Docker socket or existing external volumes.

## Verified pins and host capability

[pins.json](pins.json) records source refs and registry manifest digests. ERP full integrated candidate is PR54 `691f889aa9e87f1c0b840963621add48387699f9`; CRM full source is PR19 `03a86097c3fd25551f1faab34881f60ec0fea75b`. The older narrow ERPaa2035b4/CRMf5ad566b package is not substituted. Native Kotlin/Compose source comes from the ERP pin (JDK17/SDK36); no APK is built or installed. Source pins are **not yet a newly verified release package**: a fresh-synthetic profile/release manifest is missing. No other writer or CRM source modification was started.

Read-only `docker info` confirmed Linux x86_64, Docker28.4.0,5CPUs and18,882,674,688bytesRAM; `docker ps` showed no containers. Compose2.40.3 is available. These observations permit an infrastructure feasibility draft, not a full-stack or capacity PASS. Registry metadata for seven images was initially read and pinned by digest without pulling image layers. Subsequently only approved independent-stack image layers were requested; SQL Server/ODBC were not started/installed. Actual pull/start results are separate runtime evidence. The first metadata attempt hit the read-only default client cache; a separate empty client metadata cache under `/tmp` was used, without changing existing credentials, Docker daemon or network configuration.

Available tools were checked for workspace port forwarding/private preview publication. No such callable capability or authorized preview URL was provided; the local helper filename search did not establish a supported publication path. Sites native deployment is a different managed Worker workflow, not workspace port publication. **Private user-browser access and workspace lifetime/persistence remain unverified.** No proxy/tunnel/security workaround was attempted. This temporary stack, if later authorized and verified, would only be an intermediate step toward the user's accessible shared environment.

## Real dependencies and licensing

| Component | Draft source | Requirement before use |
| --- | --- | --- |
| SQL Server | Microsoft MCR2022-CU22 Ubuntu22.04, digest pinned | x86_64; explicit Microsoft EULA acceptance; Developer edition limited to nonproduction development/test under its terms; new local admin/application principals |
| Node | Docker Official Image24bookworm-slim, digest pinned | Existing package-lock installs; preserve Node and bundled third-party notices |
| ERP native driver | Locked msnodesqlv8 5.2.0 + unixODBC + Microsoft ODBC18 | Exact ODBC Debian package version/repository verification and explicit driver EULA acceptance still pending; no driver build/connect smoke has run |
| CRM database | Docker Official PostgreSQL16bookworm, digest pinned | PostgreSQL License/notices; independent synthetic DB/user/password and schema validation |
| Chatwoot database | Upstream-maintained pgvector/pgvector pg16, digest pinned | PostgreSQL/pgvector notices; pgvector extension compatibility with the pinned Chatwoot release must be tested |
| Redis | Docker Official Image7.2bookworm, digest pinned | BSD-3-Clause for7.2.x; private credential/config after approval; persistent AOF volume |
| Chatwoot | Upstream chatwoot/chatwoot v4.14.2-ce, digest pinned | CE/MIT-covered source and dependencies/notices; no enterprise feature license assumed; dedicated synthetic account/inbox/API key, no real provider connection |
| Web entry | Docker Official Nginx stable-bookworm, digest pinned | Nginx/third-party notices; proposed internal routing only, not an approved public origin or auth boundary |

Primary references: [SQL Linux containers](https://learn.microsoft.com/en-us/sql/linux/install-upgrade/quickstart-install-docker?view=sql-server-ver17), [Microsoft Linux ODBC installation/EULA](https://learn.microsoft.com/en-us/sql/connect/odbc/linux-mac/installing-the-microsoft-odbc-driver-for-sql-server?view=sql-server-ver17), [driver5.2.0](https://github.com/TimelordUK/node-sqlserver-v8/tree/v5.2.0), [Chatwoot Docker setup](https://developers.chatwoot.com/self-hosted/deployment/docker), [Chatwoot requirements](https://developers.chatwoot.com/self-hosted/deployment/requirements), [Chatwoot license](https://github.com/chatwoot/chatwoot/blob/v4.14.2/LICENSE), [pgvector license](https://github.com/pgvector/pgvector/blob/master/LICENSE), [Redis licensing](https://redis.io/legal/licenses/), and Docker Official Image pages for [Node](https://hub.docker.com/_/node), [PostgreSQL](https://hub.docker.com/_/postgres), [Redis](https://hub.docker.com/_/redis) and [Nginx](https://hub.docker.com/_/nginx). Version selection/digests do not establish vulnerability or runtime acceptance. No paid service/subscription was acquired.

## SQL/ODBC finding: connection is portable, current bootstrap is not

The locked driver's README describes Linux x64/Node24/ODBC17–18 support. `apps/api/src/config/database.js` already emits UID/PWD and `Trusted_Connection=No` for SQL auth. Windows integrated authentication is not inherently required for a new Linux TEST. The draft ERP image would install unixODBC/native build dependencies and the explicitly accepted Microsoft driver before installing the real locked API dependencies. This path remains unbuilt and untested.

The current application's context/provenance is the harder blocker. Candidate `isolatedOperationCopyContext.mjs`, `isolatedOperationCopyRuntime.mjs` and `sharedCopyBootstrap.mjs` pin existing server/database/LAN identities and restored-source seals. The business-copy builder expects337modules/227constraints and historical source row counts. Fresh tiny synthetic data cannot truthfully satisfy that restored-copy proof. Existing backup/Windows restore scripts must not be used, and neither old metadata nor a `MELISA_CANONICAL_TEST` flag may be fabricated to grant the new target authority.

[schema-seed-plan.json](schema-seed-plan.json) inventories the **real source SQL** with hashes:17foundation migrations,2original role/product/customer seed scripts, and the CRM PostgreSQL initial schema in the ERP repository. The numbered ERP migrations do not define the current `party_currency_accounts`, `product_prices`, `test_goods_batches`, `work_trade_*` and `stage4_copy_*` installation. The original SQL uses `MELISA_ERP_V2`; it was not retargeted or applied. Existing later canonical builders rely on old exact schemas/hashes/source fixtures and are not a clean-install chain.

**Missing source implementation:** a deterministic complete fresh-schema/procedure/FK/index deployment manifest, tiny schema-correct synthetic seed, and a distinct synthetic-origin context/guard/proof compiler for the new server/DB/users/origin. Preserve SERIALIZABLE transactions, real normal auth/roles, journal/replay/effect and cross-personnel checks. Existing full app/controllers must remain the implementation; do not port business behavior into another synthetic Worker. There is no complete working ERP bootstrap in this draft. Credentials approval alone will not fix that gap.

## Inert Compose and protected configuration placeholders

[compose.draft.yaml](compose.draft.yaml) is JSON-form YAML, accepted by Compose. It describes SQL Server, separate CRM/Chatwoot PostgreSQL stores, Redis, real Chatwoot database preparation/web/Sidekiq, full ERP API/native API/web, full CRM gateway and internal Nginx. The ERP commands intentionally point to the existing real startup scripts, which currently reject the new synthetic context. Nothing returns fabricated success. Full CRM builds must use `src/main.jsx`/`App.jsx`; ERP must build the complete candidate workflow/terminal inputs. No `cloud.html` replacement is allowed.

Validation without credentials, interpolation, image pull or start:

```sh
docker compose -f infra/cloud-full-test/compose.draft.yaml --profile pending-approval config --no-env-resolution --no-interpolate --quiet
```

The PUBLIC draft contains placeholders only. The authorized owner created a Git-ignored `.private` directory for independent local TEST credentials; no values appear in this documentation or source. Full ERP SQL/runtime configuration remains uncreated pending its gates. The complete future file contract is:

| Private file | Required contents / implementation status |
| --- | --- |
| sqlserver.env | MSSQL_SA_PASSWORD=`<NEW_TEST_ONLY_SECRET>`; never application access as sa |
| erp-runtime.json | New distinct synthetic context, schema/procedure proof/release pins, application/read-only SQL principals and JWT/session keys; current Windows copy metadata is invalid for this target |
| crm-postgres.env | POSTGRES_PASSWORD=`<NEW_CRM_DB_SECRET>` |
| chatwoot-postgres.env | POSTGRES_PASSWORD=`<NEW_CHATWOOT_DB_SECRET>` |
| redis.env / redis.conf | Matching new TEST credential; config enables AOF; no password in command arguments |
| chatwoot.env | RAILS/NODE_ENV=production, dedicated PostgreSQL/Redis URLs, SECRET_KEY_BASE=`<NEW_TEST_SECRET>`, INSTALLATION_ENV=docker, internal FRONTEND_URL; actual synthetic admin/account/inbox initialization pending; no SMTP or production provider |
| crm-gateway.env | New CRM auth users/hashes/JWT, dedicated PostgreSQL/Redis URLs, internal Chatwoot account/inbox/API token, mapped ERP full API origin; isolated media/session paths under the new volume; no existing credential/provider URLs |

Build context variables must point to new source-pinned full release exports without `.env`, keys, backups or existing databases. Copy [release-context.dockerignore](release-context.dockerignore) into those contexts before any authorized build. SQL and ODBC EULA variables have no accepted default. The ODBC exact package version is deliberately unresolved until verified. Native compilation will not run on this draft. Proposed new internal ports4810/4811/4812/5810/8080 need an approved synthetic profile; no host port is published. Existing Windows/LAN port guards remain untouched.

The gateway draft disables external send/auto-reply/WAAPI bridge and supplies no paid translation key. That is a safety boundary, not a claim that full translation/video/provider functionality has passed. A real isolated provider/sandbox path and its authorization are still needed for those operations. Their UI/features must not be silently removed or replaced by a successful stub.

## Authorized startup and persistence checks still to do

1. Resolve credential/license approval and the full fresh-bootstrap/profile source gap first. Obtain the supported private-browser publication target; no tunnel or new auth workaround.
2. Verify exported source SHAs and release manifests; build original full UI inputs and real locked API images. Run Linux ODBC connect/transaction/procedure compatibility against only the new SQL container. No original DB/backup access.
3. Initialize only new volumes. Apply the verified complete SQL manifest/seed with a separate setup principal, then read back schema/module hashes, DB/login identity and least-privilege grants. The application must have no production/original TEST access and must not run as admin.
4. The isolated CRM PostgreSQL foundation is already applied/read back with6tables, and the real pinned Chatwoot preparation already completed with89tables. Preserve these owned volumes; do not replay setup blindly. Full gateway query compatibility, Chatwoot web/worker startup, synthetic admin/account/inbox/contact/message creation and normal UI/API acceptance remain pending after the storage blocker is resolved. No external channel/provider.
5. Start full APIs/web from their verified entry points. Readiness must include DB identity/schema/proof and actual route-family responses, not a static page or one SELECT1. Verify all15normal ERP route families, full CRM inbox/assignment/catalog/draft paths and all ordinary/worktest terminal routes with normal accounts. Native APK/device/scanner/Windows print remains separate.
6. Capture synthetic IDs, stock/cari/cash/journal and conversation counts plus volume identities. Reopen in a second browser/session and restart **only the newly owned services** without deleting volumes. Read back the same records and replay one saved UUID: no repeated stock/debt/cash effect; changed-body replay and other-personnel access must reject.
7. Keep workspace-host durability, supported private user-browser access and final human acceptance open until actually verified. Do not report this draft as installed or accessible. No reset/deletion command is part of this plan.

## Observed host blocker

Docker reports `storageDriver=vfs`. Image metadata reports only2.8GBlogical image size, but copying complete image/layer roots exhausted the32GBworkspace while creating Chatwoot web/worker containers. This is observed failure, not a speculative capacity warning. Cleanup of exactly one completed owned migration container recovered2.4GiB; no database volume or record was deleted. The three stores remain healthy, but full Chatwoot web/worker, ERP Node/SQL, CRM gateway/full UI and native terminal are not installed. No disk resize, daemon storage-driver change, privileged mode, broad prune or external host provisioning was attempted. A suitable persistent host/storage arrangement is required before another full-stack startup attempt. Microsoft lists overlay2 among its SQL container prerequisites; this host currently uses vfs. Licensing, clean-schema/profile and private browser URL are separate unresolved gates.
