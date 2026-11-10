# Empty DB9 profile: schema 2 to 7

This package only emits SQL previews. It opens no SQL connection and supplies no
execution authority, credentials, grants, process control or application admission.
DB5/LIVE/Vega and existing application users are not migration sources.

`empty-profile-baseline-v2.mjs` is the current read-only factory. The original
`empty-profile-baseline.mjs` remains byte-for-byte preserved as the first reviewed
raw-security collector; it is not the current upgrade input collector. V2 changes
only the two optional security collections to SQL-side `COALESCE(...,N'[]')`.
Individual NULL fields and all historical records remain untouched. No consumer
or wrapper silently changes NULL to an empty array.

## Native baseline and transaction

Call `compileCompleteSchema2Observer(identity)` with the real executor's fresh
11-field identity. The root separately verifies Windows owner, PID/birth, SQL
lifetime, source pins and its selected current application proof. The compiler
targets only DB9/GUID/create-time/environment and the existing restricted-user
rehearsal target. Runtime HEAD/package are not inferred from a historical version.

The single SQL-owned read transaction locks all36 tables and returns17 fields:
`state` plus JSON/SHA256 pairs for `metadata`, `security`, `objectIds`, `identities`,
`rows`, `marker`, `semantic`, `references`. It covers all user objects and identity
columns on all36 tables, including the nine schema2 tables. Its hashes are a new
complete baseline; the earlier27-table projection is not substituted. Native JSON
hashes use SQL UTF16LE; descriptor SQL and compile-identity hashes use UTF8.

`reviewCompleteSchema2Baseline(native)` validates the complete empty native shape.
Its in-memory brand is a parsing contract, not proof that SQL was actually read.
The executor must pin the real observation and independently reviewed source.

`compileEmptyProfileUpgrade(identity,baseline,'rollback')` emits one SQL-owned
transaction containing the existing native account stage and V3→4→5→6→7 schema statements. Separate literal
`sp_executesql` batches preserve the original new-column binding boundary. The
net schema change is seven tables, the14 existing source-bound native account
columns, one V3 nullable supplier column plus14 V6 nullable columns (29 total),
and the existing journal/index/FK/check/marker changes. No new
business rule is defined. Full before-baseline hashes, unchanged security, stable
old object IDs and all36-table identity values are guarded in SQL.

The rollback variant does **not** insert reference rows. It emits one semantic
candidate and throws exactly51990 to roll back its own transaction. A separate
fresh complete-schema2 observer must prove all eight baseline hashes unchanged.
Missing candidate, extra/companion error, batch information, reused observer
process, failed exit or an unreviewed record cannot become rollback acceptance.

## Trusted apply receipt and reference rows

`loadReviewedUpgrade` requires caller-pinned SHA256 values for two separate root
files, `upgrade-rollback-acceptance.json` and `upgrade-apply-decision.json`, in one
public case directory. The former pins exactly:

- `upgrade-baseline.json`: real native baseline and target;
- `upgrade-rollback.json`: target, source signature, operation, baseline pin,
  one-execution/phase/candidate/51990 transcript and executor/exit receipt;
- `upgrade-after-rollback.json`: same target, separate process/exit and complete
  unchanged native baseline;
- `upgrade-actual-review.json`: independent actual review and the first three pins.

The separate apply decision must bind the source signature, same target,
acceptance SHA and exact technical reference policy. Its selected current runtime
proof is itself read by SHA and checked against DB5/schema7/317-source identity;
the root still verifies real OS processes and ownership. A serialized semantic
review, copied object, Boolean or source-test result is not an apply brand.

Only this loader creates the in-memory apply brand. The apply SQL again verifies
the entire fresh schema2 baseline and matches the rollback's actual candidate
semantic SHA before committing. Its only additional reference inserts are the
unchanged existing source values:

- `accounting/periodLockEnabled`: string `false`, type `boolean`, active;
- `accounting/periodLockedThroughDate`: NULL, type `string`, active;
- cash `KASA-TRY`, name `TRY Ana Kasa`, type `cash`, currency `TRY`, opening/current
  balance0, active. `finance_accounts` has no actor/created_by dependency.

The first two rows use the existing empty `system_settings` table. SQL identity
increments survive failed/rolled-back transactions, so they are apply-only. No
DBCC/reseed/recreate or automatic retry repairs an identity gap. A failed apply
may consume those counters and requires independent diagnosis. See Microsoft's
[@@IDENTITY transaction behavior](https://learn.microsoft.com/en-us/sql/t-sql/functions/identity-transact-sql?view=sql-server-ver16).

Users, application roles, permissions, SQL principals/grants and the existing
empty unassigned writer role remain unchanged. No company term, limit, exchange
rate, sample party/product, commercial movement or password is seeded.

`compileEmptyProfileObserver(identity,baseline,authority)` emits a separate
read-only schema7 observation after the root's actual apply receipt. It checks
43 tables,40 empty non-reference tables, one marker, exactly two lock defaults,
one zero TRY cash row, unchanged old security/object/identity projections and the
actual candidate semantic SHA. Its17 raw fields require independent actual review;
this is not runtime, normal-login, final-business-profile, human or LIVE acceptance.

## Offline verification

The new Node test file checks the changed source/seed/identity/provenance bounds.
The dedicated syntax fixture uses only fake2030 process/SID/metadata and temporary
synthetic public receipts. `empty-profile-syntax.test.ps1` uses an explicitly
pinned TSql160Parser and parses both outer batches and literal dynamic bodies.
Grammar checks do not establish SQL binding, engine, rollback or apply acceptance.
