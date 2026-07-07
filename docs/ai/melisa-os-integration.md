# Melisa OS Integration

Melisa OS is the central company knowledge base for Melisa Baby.

Repository:

https://github.com/melihsnyldzz-ui/melisa-os

ERP agents must read Melisa OS before making changes in this repository.

## Mandatory Central Reading

Read these Melisa OS documents first:

1. `README.md`
2. `docs/company/constitution.md`
3. `docs/company/business-rules.md`
4. `docs/company/vision.md`
5. `docs/ai/ai-rules.md`
6. `docs/ai/agent-operating-rules.md`
7. `docs/ai/secrets-policy.md`
8. `docs/architecture/high-level-architecture.md`
9. `docs/architecture/integration-principles.md`
10. `docs/data/erp-data-principles.md`
11. `docs/data/public-product-data-contract.md`
12. `docs/operations/release-principles.md`
13. `docs/operations/decision-log.md`

For sales, catalog, or WhatsApp-related work, also read:

- `docs/marketing/marketing-rules.md`
- `docs/marketing/whatsapp-sales-rules.md`

For sprint planning and reports, read:

- `docs/project-management/sprint-template.md`

## Responsibility Split

Melisa OS owns:

- company-wide business rules
- AI behavior rules
- secrets policy
- shared architecture principles
- release principles
- project management standards
- marketing and WhatsApp policy
- cross-project data principles

This ERP repository owns:

- ERP implementation details
- SQL Server schema and migrations
- web-admin behavior
- terminal app behavior
- Electron behavior
- ERP module rules
- local runbooks
- ERP-specific safety rules

## Conflict Handling

If Melisa OS and local ERP docs conflict:

1. Do not guess.
2. Do not silently pick one.
3. Report the conflict.
4. Ask for human confirmation before changing behavior.

Company-wide safety and secrets rules from Melisa OS always take priority over local convenience.

## Offline Access Note

If Melisa OS is unavailable, continue only with low-risk read-only or documentation work. For code, production, data, external messaging, or business-rule changes, wait until Melisa OS can be read or human approval is given.

