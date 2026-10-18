# Deploy Control: externally supervised DB02 TEST observation

Verified on 18 October 2026. This is a connection-target correction, not an ERP
deployment, database operation, commercial-flow acceptance, or LIVE health check.

## Effective target

| Role | Loopback port | Existing supervisor |
| --- | --- | --- |
| ERP API | 4184 | terminal-completion-logon |
| Native read-only API | 4186 | terminal-completion-logon |
| Web | 5234 | existing shared-copy web process |

Database: `MELISA_ERP_CRM_SHARED_TEST_20261009_02` on `Semih\MELISADEV`.
Copy ID: `e16b70f0-4057-428b-9abc-6bbcaf35fe82`.
Running package source: `f5f672c439972b287f77ddd2c7750fa0c6369e87`.
Web package: `CANONICAL-TEST-f5f672c43997`; API/native package adds `-native-ready`.
The source checkout HEAD is reported separately and is not a deployment identity.

The old connection expected an independently managed September TEST on 5190/4134
and a `real-test-runtime.mjs` child. That model does not own the current shared TEST.
Changing those ports alone would give the old adapter the wrong lifecycle model.

## Observation boundary

`scripts/canonical/deploy-control-observed-test.mjs` reuses the existing authenticated
MCP transport. It exposes status and TEST health smoke through a control object
that rejects every deployment, rollback, approval, browser, screenshot and LIVE
action with `EXTERNAL_TEST_OBSERVE_ONLY`. `hostDeploymentEnabled` is false.
LIVE is explicitly `NOT_OBSERVED`; the previous cached LIVE report is not health proof.

Before GET `/test-health`, observation verifies exact process arguments, the pinned
Node executable, launcher/config/manifest hashes, copy identity and package source.
It checks the listener PID and creation time again after the response. API/native
responses must prove TEST isolation, no external operations, no automatic jobs, no
real T1 and no LIVE/original database access. Native must remain read-only; ERP's
existing TEST write capability is reported accurately, without invoking it.
Any mismatch fails closed. New packages/configurations require a fresh verified
mapping; the observer never follows a changed target or takes ownership of it.

## Local connection installation

Connection root: `%LOCALAPPDATA%\MelisaERPServer\deploy-mcp-control`.

- `observed-test-mapping.json`: explicit local mapping; contains no credentials.
- `connection-observed-20261018\apps\deploy-mcp`: installed observer snapshot,
  small `server.mjs` entrypoint and the unchanged existing secure listener launcher.
- `keep-connection.ps1`: starts the installed listener and uses the existing
  authorized tunnel launcher. The `Melisa-Deploy-Control-Connection` task runs it
  at user logon and supervises connection process presence every minute.
- `connection-supervisor.log` and `management-mcp*.log`: connection diagnostics.

Original `deploy-config.json`, `host-config.json`, immutable September source,
release receipts and ERP runtime files were preserved. The new mapping takes effect
only in observer mode. The legacy configured commit remains visible as historical
configuration and must not be interpreted as the running TEST package.

Rollback preparation: `keep-connection.ps1.before-observed-20261018-120022` and
matching pre-change management logs/process metadata are in the connection root.
To undo this connection change, stop only its named scheduled task, verify and
stop only the loopback 4213 Deploy Control process, restore that supervisor backup,
then start the same task. This returns to the old September mapping and its known
TEST mismatch; it does not restore or restart ERP, SQL or any database.

## Verification

Seven targeted source tests, an independent read-only review, the installed MCP
`get_deploy_status` and `run_smoke_test(TEST)` succeeded. The three TEST PIDs stayed
44768/27268/23272; the operation config SHA-256 stayed
`cfb6817797fe3b081aab0fa484d6aded5a44dd5dee98a5b69ffdc1c90f553fd4`.
Connection health was `ready=true`. No ERP restart, SQL write, commercial POST,
LIVE request, deployment, browser acceptance or physical-device acceptance occurred.

Run the source checks with:

```powershell
node --test scripts/canonical/deploy-control-observed-test.test.mjs
node --check scripts/canonical/deploy-control-observed-test.mjs
```
