# ERP AI Documentation

This folder defines how AI agents must work inside the Melisa ERP v2 repository.

The goal is to make AI-assisted development safe, predictable, and aligned with Melisa Baby business rules.

## Reading Order

Every AI agent must read documents in this order before changing code or documentation:

1. Central company rules in Melisa OS:
   - https://github.com/melihsnyldzz-ui/melisa-os
2. This folder:
   - `docs/ai/melisa-os-integration.md`
   - `docs/ai/local-agent-rules.md`
   - `docs/ai/safe-change-protocol.md`
3. ERP product documentation:
   - `docs/erp-v2/README.md`
   - `docs/erp-v2/karar-defteri.md`
   - `docs/erp-v2/implementation-roadmap.md`
   - `docs/erp-v2/stabilization-roadmap.md`
   - `docs/erp-v2/production-readiness-checklist.md`
4. Current repository state:
   - `git status`
   - recent commits
   - relevant source files

## Central vs Local Documentation

Melisa OS is the central knowledge base. It owns company-wide rules, AI behavior, secrets policy, operating principles, shared architecture, and business principles.

This ERP repository owns ERP-specific implementation rules, local architecture, source code boundaries, SQL Server behavior, module rules, terminal behavior, Electron behavior, and local operational runbooks.

## Authoritative Documents

For company-level rules, Melisa OS is authoritative.

For ERP-specific business rules, `docs/erp-v2/karar-defteri.md` is authoritative unless it conflicts with Melisa OS at the company-policy level.

For implementation order and stabilization scope, use:

- `docs/erp-v2/implementation-roadmap.md`
- `docs/erp-v2/stabilization-roadmap.md`
- `docs/ERP_CODEBASE_ANALYSIS.md`
- `docs/ERP_GAP_ANALYSIS.md`

For production safety, use:

- `docs/erp-v2/production-readiness-checklist.md`
- `docs/ai/safe-change-protocol.md`
- Melisa OS secrets and operating rules

## When Local Rules Override Central Rules

Local ERP rules may be more specific than Melisa OS for implementation details. For example:

- SQL Server table behavior
- ERP inventory rules
- sales and purchase invoice rules
- customer and supplier ledger behavior
- terminal offline/sync behavior
- Electron local runtime behavior

Local rules do not override Melisa OS for company-wide safety, secrets, human approval, or business principles.

If central and local rules conflict, stop and ask for human confirmation before making changes.

