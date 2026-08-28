# Multi-Currency Daily Cash Drawer

## Purpose

The Daily Cash screen controls the physical drawer separately for TRY, USD and EUR. It reuses the existing finance accounts and finance movement ledger instead of creating a second accounting ledger.

## Business Rules

- TRY, USD and EUR are counted, opened, moved and closed independently.
- Cash customer collections create drawer inflow while an eligible session is open.
- Cash supplier payments create drawer outflow while an eligible session is open.
- Bank, card and other payment methods never affect the physical drawer.
- Expenses always require currency, amount, active category and description.
- Main cash to drawer and drawer to main operations are internal transfers. They are not income or expense.
- Opening and closing differences require a written reason and create an audited adjustment.
- Only one cash session may be open at a time in v1.
- A closed session cannot receive new expense or transfer entries.

## Daily Flow

1. Count physical TRY, USD and EUR at the beginning of the day.
2. Enter any amount added from the main cash safe and open the session.
3. Record cash collections, cash payments and categorized expenses during the day.
4. Count each currency physically at closing.
5. Enter the amount left for the next day; the remainder is transferred to the main cash safe.
6. Explain any expected-versus-physical difference and close the session.

## Data Ownership

- `finance_accounts` and `finance_account_movements` remain the financial ledger owners.
- `cash_drawers` and `cash_drawer_accounts` identify the physical drawer accounts.
- `cash_sessions` and `cash_session_counts` own daily physical counts.
- `cash_expenses`, `cash_transfers` and `cash_adjustments` own operational source records.
- Every write is protected by the existing SQL write guard, permission middleware and audit log.

## Installation

Apply `infra/sql/migrations/0012_multi_currency_cash_sessions.sql` only after explicit database migration approval. The UI reports `CASH_REGISTER_SCHEMA_MISSING` until the migration is applied.
