# C06 / B03 — fixed readonly metadata reader

Task: `ERP-C06-READONLY-METADATA-20261102-2148`. This extends the existing customer-master source capability; it is neither a deployment nor a new migration engine.

## Scope and connection

The only target is the normal ERP: WEB5244 / API4144 / native4146, transport `127.0.0.1:1433`, SQL-reported `Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01`. The existing application principal is retained; SELECT-only describes these operations, not a new read-only login or a permission grant.

The source caller is `createCanonicalCustomerMasterBinding(options).metadata.read()`. The already-admitted API bootstrap supplies its existing database/runtime. The new reader obtains no credentials, reads no environment/configuration, calls no connection factory and exposes no caller-provided SQL/database/object/limit parameters. It reuses the previously branded in-process pool and driver. Captured PID/executable/hostname/Node continuity is additional continuity evidence, not native owner or binary-signature admission.

The existing canonical bootstrap location is `apps/api/start-canonical-test.mjs`, after its existing `configureCanonicalTest(...)` admission. This change does **not** add an invocation there or enable the global customer-master writer. No public metadata endpoint, helper process or external pool-transfer mechanism is created. The default real master service still returns 503.

## Fixed catalog observation

Only these three master objects and required reference metadata for `dbo.customers` are inspected:

- `dbo.customer_master_local_v1`
- `dbo.customer_master_requests_v1`
- `dbo.customer_master_audit_v1`

Three requests perform identity-before, the fixed catalog batch with its own identity result/gates, and identity-after. The exact DB/server/login/database-user/original-login, absence of sysadmin/database CONTROL and lack of LIVE access are required. The pool may use different SQL sessions: this is explicitly a **non-transactional observation**, not an atomic snapshot or write-admission receipt. No transaction, applock, DDL, DML, EXEC or GRANT is executed by this reader.

Catalog results contain object visibility, required column type/byte width/nullability/identity/computed/alias/collation, PK/UQ/index structure, FK targets/order/trust/cascade, effective object/column permissions, and finite default/CHECK kind plus SHA256. Raw definition/filter text never crosses the driver boundary; commercial table rows are never selected. Unrecognized expressions remain UNKNOWN. Permission zero and NULL remain DENIED and UNKNOWN respectively. Compatibility facets are planning observations, never writer admission.

An object is COMPLETE only when its ID is visible and its own effective VIEW DEFINITION is 1. Database/schema grants cannot override a narrower DENY. An invisible ID remains UNKNOWN, including with enclosing grants: these fixed observations cannot prove ABSENT. This conservative rule follows Microsoft's [metadata visibility and DENY precedence](https://learn.microsoft.com/en-us/sql/relational-databases/security/metadata-visibility-configuration).

Limits: 4 objects, 28 required columns, 128 index-column rows, 32 FK/default/CHECK rows per category, 96 permissions and 196608 serialized output bytes. The existing pool must have a finite request timeout of at most 10000 ms. Unexpected fields, duplicates, accessors, overflow, driver/identity drift or incomplete resultsets fail closed without raw error/customer/credential output.

## Evidence and actual blocker

Targeted offline tests cover the fixed SELECT sequence, reuse without another pool acquisition, identity and final drift, visibility/permission 0 versus NULL, type/width/collation/index/FK/default/CHECK differences, limits/duplicate/PII/accessor rejection, unsupported arguments, process continuity and unchanged default 503. Existing customer card/master/contact, controller and workflow regression tests are included: **204 passed, 0 skipped** in the first local run. Driver doubles are not native SQL execution. Independent review and exact final-source CI are recorded in STATUS and PR54 separately.

**Actual metadata queries: 0.** The current supported `get_runtime_status({})` connector reports identity but accepts no query/database/object argument and returns no admitted in-process pool. The installed API does not contain this prepared binding. Therefore no assertion is made that the three objects are present/absent, compatible, or sufficiently permitted in the real DB. The missing component is a supported invocation of this exact reader inside the admitted API with its existing pool. An external CLI, secret extraction, alternative login, new connection or deployment is not used to bridge that gap.

Current-finance/source identity, currency accounts/balances, existing projections, roles, journals, quarantine, LL exclusions and installed ERP/CRM are unchanged. C06 and human acceptance remain partial/pending. No restart, installation, migration, real write or old B6 recovery work is authorized by this source delivery.
