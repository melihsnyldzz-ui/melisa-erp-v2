import React, { useMemo } from 'react';
import { summarizeLedgerBalances } from './ledgerBalances.js';

function amountText(row) {
  if (row.amount == null || !['TRY', 'USD', 'EUR'].includes(row.currency)) return 'Bilinmiyor';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: row.currency }).format(row.amount);
}

export function LedgerBalanceSummary({ rows, partyType, isLoading, errorMessage }) {
  const summary = useMemo(() => summarizeLedgerBalances(rows, partyType), [rows, partyType]);
  if (isLoading || errorMessage) return null;
  return <section className="summary-strip" aria-label="Güncel cari ve dönem hareketi ayrı toplamlar">
    {summary.current.map((row) => <article className="summary-card" key={`current-${row.currency}`}>
      <span>{row.currency} güncel kart bakiyesi</span><strong>{amountText(row)}</strong>
      <small>Filtredeki {row.partyCount} cari; tarih aralığından bağımsız güncel bakiye</small>
    </article>)}
    {summary.period.map((row) => <article className="summary-card" key={`period-${row.currency}`}>
      <span>{row.currency} dönem hareketi neti</span><strong>{amountText(row)}</strong>
      <small>Seçili tarih ve aramaya uyan tüm hareketler; iptaller dahil</small>
    </article>)}
    {!rows.length && <article className="summary-card"><span>Güncel kart bakiyesi</span><strong>—</strong><small>Filtreye uyan hareket yok; cari kartından bakiyeyi kontrol edin.</small></article>}
  </section>;
}
