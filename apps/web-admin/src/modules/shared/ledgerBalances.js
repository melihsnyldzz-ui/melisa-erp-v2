export function ledgerAccountCurrency(row) {
  return row.accountCurrency || row.currentCurrency || row.currency || 'Bilinmiyor';
}

export function ledgerEffect(row) {
  if (row.settlementKnown === false) return null;
  const value = row.balanceEffect == null ? null : Number(row.balanceEffect);
  return Number.isFinite(value) ? value : null;
}

export function absoluteLedgerEffect(row) {
  const value = ledgerEffect(row);
  return value == null ? null : Math.abs(value);
}

export function summarizeLedgerPeriod(rows, { debitWhenPositive = true } = {}) {
  const totals = {};
  for (const row of rows) {
    const currency = ledgerAccountCurrency(row);
    const effect = ledgerEffect(row);
    const total = totals[currency] ??= { currency, debit: 0, credit: 0, balance: 0 };
    if (effect == null || total.balance == null) {
      total.debit = null; total.credit = null; total.balance = null;
      continue;
    }
    if ((effect >= 0) === debitWhenPositive) total.debit += Math.abs(effect);
    else total.credit += Math.abs(effect);
    total.balance += effect;
  }
  return totals;
}

export function summarizeLedgerBalances(rows, partyType) {
  const parties = new Map();
  const period = new Map();
  for (const row of rows) {
    const effect = ledgerEffect(row);
    const currency = ledgerAccountCurrency(row);
    const previous = period.get(currency) ?? { amount: 0, unknown: false };
    period.set(currency, {
      amount: previous.amount + (Number.isFinite(effect) ? effect : 0),
      unknown: previous.unknown || !Number.isFinite(effect),
    });
    const id = row[partyType === 'supplier' ? 'supplierId' : 'customerId'];
    if (id == null) continue;
    const balance = row.currentBalance == null ? null : Number(row.currentBalance);
    const next = { currency: row.currentCurrency || 'Bilinmiyor', amount: Number.isFinite(balance) ? balance : null };
    const prior = parties.get(String(id));
    if (prior && (prior.currency !== next.currency || prior.amount !== next.amount)) {
      next.amount = null;
      next.currency = prior.currency === next.currency ? next.currency : 'Bilinmiyor';
    }
    parties.set(String(id), next);
  }
  const current = new Map();
  for (const row of parties.values()) {
    const previous = current.get(row.currency) ?? { amount: 0, unknown: false, partyCount: 0 };
    current.set(row.currency, {
      amount: previous.amount + (row.amount ?? 0),
      unknown: previous.unknown || row.amount == null,
      partyCount: previous.partyCount + 1,
    });
  }
  return {
    current: [...current].map(([currency, value]) => ({ currency, ...value, amount: value.unknown ? null : value.amount })),
    period: [...period].map(([currency, value]) => ({ currency, ...value, amount: value.unknown ? null : value.amount })),
  };
}
