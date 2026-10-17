# Guarded API restart

Use `node scripts/restart-erp-api.mjs --commit <40-character feature commit>
--rollback-commit <40-character prior commit> --ai-source <Melisa AI source>`.
The AI source must contain the reviewed `scripts/verify-step5-erp.mjs` reader.

The command tests the API route, verifies the live ERP identity and exact
working directory/Node entry point, and records PID plus creation time.
The original process environment is retained with Windows CurrentUser DPAPI;
credentials are never printed or changed. A short watchdog lease prevents a
second API start during transition. Other services are not started or stopped.

The legacy process has no drain/shutdown endpoint. Its registered process
handle is stopped only after revalidating PID, creation time, executable,
working directory, command line and port ownership. No process tree or unknown
process is killed. The API restarts with its original environment and directory.
Health and real product/price/stock/image/sales-evidence reads must pass before
publishing the runtime record. There are no migrations or database writes.

Rollback restores only the prior committed route registration file and starts
the original configuration. It does not reset the working tree or discard the
existing local API overlay. The deployed application feature commit and the
remaining working overlay are both recorded; this is not a clean-release claim.
No immutable snapshot of code already loaded by the legacy process is inferred.
Runtime/rollback records live under `%USERPROFILE%/.melisa-ai/erp-restart`.

`node --test scripts/guarded-runtime.test.mjs` tests ownership changes, failures
before stop, start failure, read regressions, rollback and policy rejection.
