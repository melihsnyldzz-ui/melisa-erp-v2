import React, { useEffect, useState } from 'react';
import { fetchFinanceMovements, fetchFinanceSummary } from '../../services/financeApi.js';
import { exportRowsToCsv, printCurrentScreen } from '../../utils/exportUtils.js';

function formatMoney(value, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function movementLabel(type) {
  const labels = {
    sales_invoice: 'Satis fisi',
    sales_invoice_cancel: 'Satis iptal',
    purchase_invoice: 'Alis fisi',
    purchase_invoice_cancel: 'Alis iptal',
    collection: 'Tahsilat',
    payment: 'Odeme',
  };

  return labels[type] || type || '-';
}

function Kpi({ label, value, detail, tone = 'info' }) {
  return (
    <article className={`dashboard-kpi ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function FinanceOverviewScreen({ onOpenScreen }) {
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadFinance() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const [summaryResponse, movementResponse] = await Promise.all([
        fetchFinanceSummary(),
        fetchFinanceMovements({ limit: 80 }),
      ]);
      setSummary(summaryResponse.data);
      setRows(movementResponse.data || []);
    } catch (error) {
      setSummary(null);
      setRows([]);
      setErrorMessage(`${error.message || 'Finans verisi okunamadi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadFinance();
  }, []);

  function exportFinanceRows() {
    exportRowsToCsv({
      filename: 'finans-hareketleri',
      rows,
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Tip', value: (row) => row.partyType === 'supplier' ? 'Tedarikci' : 'Cari' },
        { label: 'Kod', key: 'partyCode' },
        { label: 'Ad', key: 'partyName' },
        { label: 'Belge', key: 'documentNo' },
        { label: 'Islem', value: (row) => movementLabel(row.movementType) },
        { label: 'Tutar', key: 'amount' },
        { label: 'Bakiye Etkisi', key: 'balanceEffect' },
        { label: 'Para Birimi', key: 'currency' },
      ],
    });
  }

  return (
    <main className="work-area dashboard-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Finans Ozeti</strong>
          <span>Cari alacak, tedarikci borcu, tahsilat ve odeme hareketleri</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={() => onOpenScreen('collections-overview')}>Tahsilat / Odeme Gir</button>
          <button type="button" onClick={exportFinanceRows}>Excel</button>
          <button type="button" onClick={() => printCurrentScreen('Melisa ERP - Finans Ozeti')}>Yazdir</button>
          <button type="button" onClick={loadFinance}>Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Finans verisi API'den okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <section className="dashboard-kpi-grid">
        <Kpi label="Musteri alacak" value={formatMoney(summary?.customerReceivables)} detail="Pozitif cari bakiyeler" tone="warn" />
        <Kpi label="Tedarikci borc" value={formatMoney(summary?.supplierPayables)} detail="Pozitif tedarikci bakiyeleri" tone="warn" />
        <Kpi label="Bugun tahsilat" value={formatMoney(summary?.todayCollections)} detail={`${summary?.collectionCount || 0} toplam tahsilat kaydi`} tone="good" />
        <Kpi label="Bugun odeme" value={formatMoney(summary?.todayPayments)} detail={`${summary?.paymentCount || 0} toplam odeme kaydi`} tone="info" />
        <Kpi label="Musteri avans" value={formatMoney(summary?.customerAdvances)} detail="Negatif cari bakiye" tone="info" />
        <Kpi label="Tedarikci avans" value={formatMoney(summary?.supplierAdvances)} detail="Negatif tedarikci bakiye" tone="info" />
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Son Finans Hareketleri</strong>
          <span>{rows.length} satir / SQL hareket defteri</span>
        </div>
        {!isLoading && !errorMessage && rows.length === 0 && <div className="list-state">Finans hareketi bulunamadi.</div>}
        {!isLoading && !errorMessage && rows.length > 0 && (
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Tip</th>
                  <th>Cari / Tedarikci</th>
                  <th>Belge</th>
                  <th>Islem</th>
                  <th>Tutar</th>
                  <th>Bakiye Etkisi</th>
                  <th>PB</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.partyType}-${row.id}-${row.movementType}`}>
                    <td>{row.documentDate || '-'}</td>
                    <td>{row.partyType === 'supplier' ? 'Tedarikci' : 'Cari'}</td>
                    <td>{row.partyCode} / {row.partyName}</td>
                    <td>{row.documentNo}</td>
                    <td>{movementLabel(row.movementType)}</td>
                    <td>{formatMoney(row.amount, row.currency)}</td>
                    <td>{formatMoney(row.balanceEffect, row.currency)}</td>
                    <td><span className="status-pill">{row.currency}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
