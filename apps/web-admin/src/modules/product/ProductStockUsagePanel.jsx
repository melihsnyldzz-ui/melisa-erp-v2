import React, { useMemo, useState } from 'react';

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

  if (row.sourceType === 'sales_invoice' && quantityOut > 0) return 'Satis cikis';
  if (row.sourceType === 'sales_invoice' && quantityIn > 0) return 'Satis iptal/iade';
  if (row.sourceType === 'purchase_invoice' && quantityIn > 0) return 'Alis giris';
  if (row.sourceType === 'purchase_invoice' && quantityOut > 0) return 'Alis iptal/iade';
  if (row.movementType === 'in') return 'Giris';
  if (row.movementType === 'out') return 'Cikis';
  return row.movementType || 'Hareket';
}

function movementClass(row) {
  if (Number(row.quantityOut || 0) > 0) return 'usage-out-row';
  if (Number(row.quantityIn || 0) > 0) return 'usage-in-row';
  return 'usage-neutral-row';
}

function partyLabel(row) {
  if (row.customerName) return `Musteri: ${row.customerName}`;
  if (row.supplierName) return `Tedarikci: ${row.supplierName}`;
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

function targetButtonLabel(row) {
  if (row.sourceType === 'sales_invoice') return 'Satis Fisi';
  if (row.sourceType === 'purchase_invoice') return 'Alis Fisi';
  return 'Hareket';
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
        <strong>Stok Fis Kullanimi</strong>
        <span>Alis, satis, cari, adet ve fiyat izi</span>
      </div>

      {!isLoading && movements.length > 0 ? (
        <>
          <div className="product-usage-summary">
            <span><b>Alis fisi</b>{summary.purchaseCount}</span>
            <span><b>Satis fisi</b>{summary.salesCount}</span>
            <span className="usage-in-total"><b>Giris</b>+{summary.inQuantity}</span>
            <span className="usage-out-total"><b>Cikis</b>-{summary.outQuantity}</span>
            <span><b>Alis TRY</b>{formatMoney(summary.purchaseValueTry, 'TRY')}</span>
            <span><b>Satis TRY</b>{formatMoney(summary.salesValueTry, 'TRY')}</span>
            <span><b>Son giris</b>{summary.lastInDate || '-'}</span>
            <span><b>Son cikis</b>{summary.lastOutDate || '-'}</span>
          </div>
          <div className="product-usage-filter">
            <button className={filter === 'all' ? 'pressed' : ''} type="button" onClick={() => setFilter('all')}>Tumu</button>
            <button className={filter === 'in' ? 'pressed' : ''} type="button" onClick={() => setFilter('in')}>Girisler</button>
            <button className={filter === 'out' ? 'pressed' : ''} type="button" onClick={() => setFilter('out')}>Cikislar</button>
            <button className={filter === 'purchase' ? 'pressed' : ''} type="button" onClick={() => setFilter('purchase')}>Alis fisleri</button>
            <button className={filter === 'sales' ? 'pressed' : ''} type="button" onClick={() => setFilter('sales')}>Satis fisleri</button>
            <span>{visibleMovements.length} / {movements.length} hareket</span>
          </div>
        </>
      ) : null}

      {isLoading ? (
        <div className="list-state">Urun hareketleri yukleniyor...</div>
      ) : null}
      {!isLoading && movements.length === 0 ? (
        <div className="list-state list-state-passive">Bu urun icin kayitli fis hareketi bulunamadi.</div>
      ) : null}
      {!isLoading && movements.length > 0 ? (
        <div className="table-wrap product-stock-usage-wrap">
          <table className="product-stock-usage-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Tip</th>
                <th>Fis No</th>
                <th>Musteri / Tedarikci</th>
                <th>Adet</th>
                <th>Birim Fiyat</th>
                <th>Maliyet TRY</th>
                <th>TRY Tutar</th>
                <th>Stok Etkisi</th>
                <th>Git</th>
              </tr>
            </thead>
            <tbody>
              {visibleMovements.map((row) => (
                <tr className={`clickable-row ${movementClass(row)}`} key={row.id} onClick={() => onOpenMovement(row)}>
                  <td>{row.documentDate || '-'}</td>
                  <td>{movementLabel(row)}</td>
                  <td className="code-cell">{row.sourceDocumentNo || '-'}</td>
                  <td>
                    {onOpenParty && (row.customerId || row.supplierId) ? (
                      <button
                        className="link-button"
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
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenMovement(row);
                        }}
                      >
                        {targetButtonLabel(row)}
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
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
