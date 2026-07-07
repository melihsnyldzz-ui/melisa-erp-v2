# ERP Safe Change Protocol

Use this protocol before every change in the Melisa ERP v2 repository.

## 1. Read The Required Documentation

Before changing anything, read the relevant central and local rules:

- Melisa OS central rules
- `AGENTS.md`
- `docs/ai/README.md`
- `docs/ai/local-agent-rules.md`
- `docs/erp-v2/README.md`
- `docs/erp-v2/karar-defteri.md`
- task-relevant ERP docs

## 2. Check Git Status

Run `git status --short` before edits.

Identify:

- modified files
- untracked files
- user-owned changes
- generated files
- files that must stay out of the commit

Never overwrite or revert user changes unless explicitly requested.

## 3. Determine Whether Production Data Is Involved

Classify the task:

- documentation-only
- source code only
- read-only API/DB check
- local/lab data write
- production data write
- migration
- backup/restore/reset
- external integration or message sending

If production data, live SQL writes, WhatsApp sending, backup/reset, migration, deployment, or secret handling is involved, stop and ask for explicit human approval.

## 4. Estimate Risk

Use these risk levels:

- Low: documentation-only, no behavior change.
- Medium: UI-only or isolated code change with tests.
- High: auth, permissions, finance, inventory, invoice, import, terminal sync, database, or external integration.
- Critical: production write, migration, reset, restore, destructive operation, or external message sending.

High and critical changes require a clear plan before editing.

## 5. Plan The Change

Before coding, state:

- goal
- files likely to change
- risks
- tests to run
- what is out of scope

Do not silently change business rules. If business logic conflicts with documentation, stop and ask.

## 6. Make The Smallest Safe Change

- Keep the change scoped.
- Follow existing project patterns.
- Avoid unrelated refactors.
- Avoid formatting churn.
- Keep documentation and code commits separate when practical.

## 7. Test

Run relevant tests/checks:

- syntax check
- build
- smoke test
- API health check
- browser/UI verification
- terminal check
- documentation link check

For risky data flows, use test/lab data unless explicit production approval was given.

## 8. Update Documentation

Update documentation whenever:

- behavior changes
- setup changes
- API contract changes
- business workflow changes
- safety rules change
- runbook steps change
- known risks change

## 9. Commit

Before commit:

- run `git status --short`
- stage only intended files
- verify no secrets or runtime artifacts are staged
- keep commit message clear and scoped

After commit:

- report commit hash
- report tests/checks run
- report remaining dirty/untracked files

## 10. Final Report

Every completed task should report:

1. What changed
2. Files changed
3. Tests/checks run
4. Result
5. Commit hash, if committed
6. Remaining dirty/untracked files
7. Known risks or next step

