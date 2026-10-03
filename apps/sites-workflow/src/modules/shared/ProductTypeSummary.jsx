import React from 'react';
import { summarizeProductTypes } from './productTypeSummary.js';
import './product-type-summary.css';

export function ProductTypeSummary({ items = [], products = [], unit = 'adet' }) {
  const groups = summarizeProductTypes(items, products);
  const format = number => number.toLocaleString('tr-TR', { maximumFractionDigits: 3 });
  return <section className="receipt-type-summary" aria-label="Ürün türü özeti">
    <div className="receipt-type-heading"><strong>Ürün türü özeti</strong><span>{format(groups.reduce((sum, group) => sum + group.quantity, 0))} {unit} · {items.length} ürün satırı</span></div>
    {groups.length ? <dl>{groups.map(group => <div key={group.type}><dt>{group.type}</dt><dd>{format(group.quantity)} <small>{unit}</small></dd></div>)}</dl> : <p>Ürün satırı bulunmuyor.</p>}
    {groups.some(group => group.type === 'Türü belirtilmemiş') && <p>Türü belirtilmemiş ürünlerin kartındaki ürün türünü tamamlayın.</p>}
  </section>;
}
