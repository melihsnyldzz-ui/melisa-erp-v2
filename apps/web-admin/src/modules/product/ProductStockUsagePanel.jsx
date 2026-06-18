import React, { useMemo, useState } from 'react';
import { ledgerTargetActionLabel, resolveLedgerTarget } from '../shared/ledgerNavigation.js';

function formatMoney(amount, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function movementLabel(row) {
  const quantityIn = Number(row.quantityIn || 0);
  const quantityOut = Number(row.quantityOut || 0);

  if (row.sourceType === 'sales_invoice' && quantityOut > 0) return 'Satış çıkış';
  if (row.sourceType === 'sales_invoice' && quantityIn > 0) return 'Satış iptal/iade';
  if (row.sourceType === 'purchase_invoice' && quantityIn > 0) return 'Alış giriş';
  if (row.sourceType === 'purchase_invoice' && quantityOut > 0) return 'Alış iptal/iade';
  if (row.movementType === 'in') return 'Giriş';
  if (row.movementType === 'out') return 'Çıkış';
  return row.movementType || 'Hareket';
}

function movementClass(row) {
  if (Number(row.quantityOut || 0) > 0) return 'usage-out-row';
  if (Number(row.quantityIn || 0) > 0) return 'usage-in-row';
  return 'usage-neutral-row';
}

function partyLabel(row) {
  if (row.customerName) return `Müşteri: ${row.customerName}`;
  if (row.supplierName) return `Tedarikçi: ${row.supplierName}`;
  return '-';
}

function quantityLabel(row) {
  if (Number(row.quantityOut || 0) > 0) return `-${Number(row.quantityOut || 0)}`;
  if (Number(row.quantityIn || 0) > 0) return `+${Number(row.quantityIn || 0)}`;
  return Number(row.quantityNet || 0);
}

function summarizeMovements(movements) {
  return movements.reduce((summary, row) => {
    const quantityIn = Number(row.quantityIn || 0);
    const quantityOut = Number(row.quantityOut || 0);
    const amountTry = Number(row.amountTry || 0);

    summary.inQuantity += quantityIn;
    summary.outQuantity += quantityOut;
    if (row.sourceType === 'purchase_invoice') summary.purchaseCount += 1;
    if (row.sourceType === 'sales_invoice') summary.salesCount += 1;
    if (quantityIn > 0) summary.purchaseValueTry += Math.abs(amountTry);
    if (quantityOut > 0) summary.salesValueTry += Math.abs(amountTry);
    if (quantityIn > 0) summary.lastInDate = summary.lastInDate || row.documentDate || '';
    if (quantityOut > 0) summary.lastOutDate = summary.lastOutDate || row.documentDate || '';
    return summary;
  }, {
    inQuantity: 0,
    outQuantity: 0,
    purchaseCount: 0,
    salesCount: 0,
    purchaseValueTry: 0,
    salesValueTry: 0,
    lastInDate: '',
    lastOutDate: '',
  });
}

function filterMovements(movements, filter) {
  if (filter === 'in') {
    return movements.filter((row) => Number(row.quantityIn || 0) > 0);
  }

  if (filter === 'out') {
    return movements.filter((row) => Number(row.quantityOut || 0) > 0);
  }

  if (filter === 'sales') {
    return movements.filter((row) => row.sourceType === 'sales_invoice');
  }

  if (filter === 'purchase') {
    return movements.filter((row) => row.sourceType === 'purchase_invoice');
  }

  return movements;
}

function unitPriceLabel(row) {
  if (row.unitPrice === null || row.unitPrice === undefined) return '-';
  return formatMoney(row.unitPrice, row.currency || 'TRY');
}

function unitCostLabel(row) {
  return formatMoney(row.unitCostTry, 'TRY');
}

export function ProductStockUsagePanel({ isLoading, movements, onOpenMovement, onOpenParty }) {
  const [filter, setFilter] = useState('all');
  const visibleMovements = useMemo(() => filterMovements(movements, filter), [movements, filter]);
  const summary = summarizeMovements(movements);

  return (
    <section className="erp-panel product-stock-usage-panel">
      <div className="panel-title">
        <strong>Stok Fiş Kullanımı</strong>
        <span>Alış, satış, cari, adet ve fiyat izi</span>
      </div>

      {!isLoading && movements.length > 0 ? (
        <>
          <div className="product-usage-summary">
            <span><b>Alış fişi</b>{summary.purchaseCount}</span>
            <span><b>Satış fişi</b>{summary.salesCount}</span>
            <span className="usage-in-total"><b>Giriş</b>+{summary.inQuantity}</span>
            <span className="usage-out-total"><b>Çıkış</b>-{summary.outQuantity}</span>
            <span><b>Alış TRY</b>{formatMoney(summary.purchaseValueTry, 'TRY')}</span>
            <span><b>Satış TRY</b>{formatMoney(summary.salesValueTry, 'TRY')}</span>
            <span><b>Son giriş</b>{summary.lastInDate || '-'}</span>
            <span><b>Son çıkış</b>{summary.lastOutDate || '-'}</span>
          </div>
          <div className="product-usage-filter">
            <button className={filter === 'all' ? 'pressed' : ''} type="button" onClick={() => setFilter('all')}>Tümü</button>
            <button className={filter === 'in' ? 'pressed' : ''} type="button" onClick={() => setFilter('in')}>Girişler</button>
            <button className={filter === 'out' ? 'pressed' : ''} type="button" onClick={() => setFilter('out')}>Çıkışlar</button>
            <button className={filter === 'purchase' ? 'pressed' : ''} type="button" onClick={() => setFilter('purchase')}>Alış fişleri</button>
            <button className={filter === 'sales' ? 'pressed' : ''} type="button" onClick={() => setFilter('sales')}>Satış fişleri</button>
            <span>{visibleMovements.length} / {movements.length} hareket</span>
          </div>
        </>
      ) : null}

      {isLoading ? (
        <div className="list-state">Ürün hareketleri yükleniyor...</div>
      ) : null}
      {!isLoading && movements.length === 0 ? (
        <div className="list-state list-state-passive">Bu ürün için kayıtlı fiş hareketi bulunamadı.</div>
      ) : null}
      {!isLoading && movements.length > 0 ? (
        <div className="table-wrap product-stock-usage-wrap">
          <table className="product-stock-usage-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Tip</th>
                <th>Fiş No</th>
                <th>Müşteri / Tedarikçi</th>
                <th>Adet</th>
                <th>Birim Fiyat</th>
                <th>Maliyet TRY</th>
                <th>TRY Tutar</th>
                <th>Stok Etkisi</th>
                <th>Git</th>
              </tr>
            </thead>
            <tbody>
              {visibleMovements.map((row) => {
                const canOpen = Boolean(resolveLedgerTarget(row));

                return (
                <tr className={`${canOpen ? 'clickable-row' : ''} ${movementClass(row)}`} key={row.id} onClick={() => canOpen && onOpenMovement(row)}>
                  <td>{row.documentDate || '-'}</td>
                  <td>{movementLabel(row)}</td>
                  <td>
                    <button
                      className="document-link-button"
                      disabled={!canOpen}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenMovement(row);
                      }}
                    >
                      {row.sourceDocumentNo || '-'}
                    </button>
                  </td>
                  <td>
                    {onOpenParty && (row.customerId || row.supplierId) ? (
                      <button
                        className="document-link-button party"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenParty(row);
                        }}
                      >
                        {partyLabel(row)}
                      </button>
                    ) : partyLabel(row)}
                  </td>
                  <td className={Number(row.quantityOut || 0) > 0 ? 'out-cell' : 'in-cell'}>{quantityLabel(row)}</td>
                  <td className="money-cell usage-price-cell">{unitPriceLabel(row)}</td>
                  <td className="money-cell usage-cost-cell">{unitCostLabel(row)}</td>
                  <td className="money-cell">{formatMoney(row.amountTry, 'TRY')}</td>
                  <td>{Number(row.quantityNet || 0)}</td>
                  <td>
                    <div className="row-action-group compact-actions">
                      <button
                        className="mini-button"
                        disabled={!canOpen}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenMovement(row);
                        }}
                      >
                        {canOpen ? ledgerTargetActionLabel(row) : 'Belge Yok'}
                      </button>
                      {onOpenParty && (row.customerId || row.supplierId) ? (
                        <button
                          className="mini-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenParty(row);
                          }}
                        >
                          Cari
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
