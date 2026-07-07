# AI Agent Entry Point

This repository is the Melisa ERP v2 application repository. It is AI-first, but it is also a live business system. Every AI agent must understand the safety rules before touching code, data, scripts, or documentation.

These instructions apply to Codex, ChatGPT, Claude, and any future AI agent working in this repository.

## Required Reading Order

Before making any change, read in this order:

1. The central Melisa OS knowledge base:
   - Repository: https://github.com/melihsnyldzz-ui/melisa-os
   - Start with the reading order in `melisa-os/README.md`.
2. Local AI instructions:
   - `docs/ai/README.md`
   - `docs/ai/local-agent-rules.md`
   - `docs/ai/safe-change-protocol.md`
   - `docs/ai/melisa-os-integration.md`
3. ERP product and architecture documentation:
   - `docs/erp-v2/README.md`
   - `docs/erp-v2/karar-defteri.md`
   - `docs/erp-v2/implementation-roadmap.md`
   - `docs/erp-v2/stabilization-roadmap.md`
   - `docs/erp-v2/production-readiness-checklist.md`
4. Current repository state:
   - Inspect `git status` before changing anything.
   - Identify dirty, untracked, or user-owned files.

## Non-Negotiable Rules

- Never expose secrets, tokens, passwords, SQL credentials, WhatsApp keys, or `.env.local` contents.
- Never touch production data, live SQL Server writes, backup/reset actions, external messages, or deployments without explicit human approval.
- Plan before coding, especially for business logic, database, auth, finance, inventory, import, terminal, or external integration changes.
- Make small, safe commits with a single clear purpose.
- Keep documentation updated whenever behavior, workflow, setup, safety rules, or business operations change.
- Never silently change business rules. If a requested change conflicts with `docs/erp-v2/karar-defteri.md` or Melisa OS, report the conflict and ask for human confirmation.
- Do not mix unrelated changes in one commit.
- Do not include tool-specific local folders such as `.claude/` unless explicitly requested.

## Default Work Style

- Prefer documentation-only planning before risky changes.
- Prefer read-only verification before write operations.
- Prefer local/lab/test data over production data.
- If a task requires production access, stop and ask for explicit approval.
- If uncertain whether an action is risky, treat it as risky.

