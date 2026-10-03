// Read-only display arithmetic; never feeds a posting or stored amount.
export function cashUnits(value) {
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof text !== 'string' || !/^-?\d{1,30}(?:\.\d{1,8})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.replace(/^-/, '').split('.');
  return (text.startsWith('-') ? -1n : 1n) * (BigInt(whole) * 100000000n + BigInt(fraction.padEnd(8, '0')));
}
export function sumCashAmounts(values) {
  let sum = 0n;
  for (const value of values) { const n = cashUnits(value); if (n === null) return null; sum += n; }
  const abs = sum < 0n ? -sum : sum;
  return `${sum < 0n ? '-' : ''}${abs / 100000000n}.${String(abs % 100000000n).padStart(8, '0')}`;
}
export function formatCashMoney(value, currency) {
  const units = cashUnits(value);
  if (units === null) return 'Doğrulanmadı';
  // Display-only half-up cents, matching existing party display semantics.
  const cents = ((units < 0n ? -units : units) + 500000n) / 1000000n;
  const whole = String(cents / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const symbol = {TRY:'₺',USD:'$',EUR:'€'}[currency];
  return `${units < 0n ? '-' : ''}${symbol || ''}${whole},${String(cents % 100n).padStart(2, '0')}${symbol ? '' : ` ${currency || 'Döviz doğrulanmadı'}`}`;
}

