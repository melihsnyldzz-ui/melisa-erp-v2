# C07 supplier contact metadata capture — source preparation

This delivery does not implement or enable supplier contact writes. C07 remains
unresolved. Real supplier cards are read-only; the existing writer is limited to
the reserved synthetic supplier 13373.

## Exact missing native evidence

The initial schema migration is explicitly a draft for MELISA_ERP_V2, not current
DB02 evidence. It describes phone NVARCHAR(50), city/country NVARCHAR(100),
updated_at, updated_by and row_version, but later native identity/finance fields
must also remain protected. Capture current dbo.suppliers columns, types, byte
lengths, ordinal positions, computed/default metadata, constraints and indexes.

Capture all current user module definitions, hashes, EXECUTE AS principals,
trigger enabled/FIRST flags and dependency edges. The supplier graph must be
derived from this evidence; the customer contact compiler's finite customer and
product-price predecessor list is not a supplier graph. SQL dependencies alone
do not expose every dynamic SQL or definition-hash name, hence full user-module
metadata is retained. This output is private code/schema evidence, not public PR
content. It includes no supplier/customer rows or credential configuration.

## Owner-run capture on the canonical Windows checkout

Use Windows PowerShell 5.1 or PowerShell 7 and Node with an already-authorized Windows integrated account
having VIEW DEFINITION on exact Semih\MELISADEV /
MELISA_ERP_CRM_SHARED_TEST_20261009_02. The script does not grant permissions.

Choose an existing access-controlled private directory outside the checkout and a new output name. The caller is responsible for directory ACLs; the script does not create permissions or encrypt the artifact:

```powershell
powershell.exe -NoProfile -File .\scripts\canonical\capture-shared-business-supplier-contact.ps1 -OutputPath 'C:\Sirket\ERP\evidence\private\supplier-contact-metadata-20261018.json'
```

The script reads only sys metadata. It rejects the wrong target, missing
VIEW DEFINITION, open transactions, null module definitions, observed metadata
drift and existing/repository-local output paths. CreateNew prevents overwrite
races. No SQL procedure, DDL, grant, service, writer registration, business row,
Vega connection or environment file is accessed. Module definitions may contain
write statements as text; those definitions are selected, never executed.

Repeated metadata comparison detects observed changes; it is not a database
snapshot, native proof or deployment acceptance. No real Windows/SQL execution
was performed in this source-only delivery.

## Next source stage

Review the private capture; derive the exact supplier contact predecessor graph
and noncontact invariant columns, then implement compiler/bootstrap/store/API/UI
as one coherent native successor. Retain copy seal, actor/permission proof,
UUID/full-payload replay, optimistic revision, transaction/audit and quarantine
guards. Capturing metadata does not authorize registration or activate a writer.

## Offline validation

```sh
node --test scripts/canonical/shared-business-supplier-contact-capture.test.mjs
```

Windows PowerShell 5.1 offline parser check (does not execute the capture):

```powershell
powershell.exe -NoProfile -File .\scripts\canonical\capture-shared-business-supplier-contact.parse.test.ps1
```

Four source-only tests passed: SELECT-only/no business row queries, complete
metadata projection, strict identity rejection and private/no-overwrite/drift
wrapper guards. PowerShell wrapper not executed on Windows in this environment.
