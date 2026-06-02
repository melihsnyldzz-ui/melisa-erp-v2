import React, { useEffect, useMemo, useState } from 'react';
import { fetchPurchaseDrafts } from '../../services/invoiceDraftApi.js';

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('tr-TR') : '-';
}

export function PurchaseInvoiceListScreen({ onOpenScreen }) {
  const [search, setSearch] = useState('');
  const [supplier, setSupplier] = useState('');
  const [rows, setRows] = useState([]);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedRowId) ?? rows[0],
    [rows, selectedRowId],
  );

  async function loadDrafts() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetchPurchaseDrafts({
        page: 1,
        limit: 100,
        search,
        supplier,
        status: 'DRAFT',
      });

      setRows(response.data);
      setMeta(response.meta);
      setSelectedRowId((currentId) => (
        response.data.some((row) => row.id === currentId) ? currentId : response.data[0]?.id ?? null
      ));
    } catch (error) {
      setRows([]);
      setMeta(null);
      setSelectedRowId(null);
      setErrorMessage(error.message || 'Alış taslak listesi API bağlantısı başarısız.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function guardedLoad() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchPurchaseDrafts({
          page: 1,
          limit: 100,
          search,
          supplier,
          status: 'DRAFT',
        });

        if (isMounted) {
          setRows(response.data);
          setMeta(response.meta);
          setSelectedRowId((currentId) => (
            response.data.some((row) => row.id === currentId) ? currentId : response.data[0]?.id ?? null
          ));
        }
      } catch (error) {
        if (isMounted) {
          setRows([]);
          setMeta(null);
          setSelectedRowId(null);
          setErrorMessage(error.message || 'Alış taslak listesi API bağlantısı başarısız.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    guardedLoad();

    return () => {
      isMounted = false;
    };
  }, [search, supplier]);

  function openDraft(rowId = selectedRow?.id) {
    if (!rowId) {
      setErrorMessage('Fiş açmak için listeden bir taslak seçin.');
      return;
    }

    setErrorMessage('');
    const row = rows.find((item) => item.id === rowId);
    onOpenScreen('purchase-invoice', { purchaseDraftId: rowId, invoiceNo: row?.invoiceNo });
  }

  return (
    <main className="work-area invoice-list-screen">
      <section className="invoice-list-toolbar">
        <div className="invoice-list-title">
          <strong>Alış Fişleri</strong>
          <span>Tedarikçi alış taslakları, maliyet etkisi ve irsaliye eşleştirme</span>
        </div>
        <div className="invoice-list-actions">
          <button type="button" onClick={() => onOpenScreen('purchase-invoice')}>Yeni Fiş</button>
          <button type="button" onClick={() => openDraft()}>Fiş Aç</button>
          <button type="button" onClick={loadDrafts}>Yenile</button>
        </div>
      </section>

      <section className="invoice-list-filters">
        <label>
          <span>Fiş / genel arama</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Fiş no veya tedarikçi" />
        </label>
        <label>
          <span>Tedarikçi</span>
          <input value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="Tedarikçi adı" />
        </label>
        <label>
          <span>Durum</span>
          <input value="DRAFT" readOnly />
        </label>
      </section>

      <section className="erp-panel invoice-list-panel">
        <div className="panel-title">
          <strong>Alış Taslak Tablosu</strong>
          <span>Seçili: {selectedRow?.invoiceNo ?? 'yok'} / Satır: {rows.length}</span>
        </div>
        {isLoading && <div className="list-state">API'den alış taslakları yükleniyor...</div>}
        {!isLoading && errorMessage && (
          <div className="list-state list-state-error">{errorMessage} Demo fallback kullanılmadı.</div>
        )}
        {!isLoading && !errorMessage && rows.length === 0 && (
          <div className="list-state">Kayıt bulunamadı veya seçilen filtreler boş.</div>
        )}
        {!isLoading && !errorMessage && rows.length > 0 && (
          <div className="table-wrap invoice-table-wrap">
            <table className="invoice-list-table">
              <thead>
                <tr>
                  <th>Fiş no</th>
                  <th>Tedarikçi</th>
                  <th>PB</th>
                  <th>Toplam</th>
                  <th>Durum</th>
                  <th>Satır</th>
                  <th>Oluşturma</th>
                  <th>Güncelleme</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={row.id === selectedRow?.id ? 'selected' : ''}
                    onClick={() => setSelectedRowId(row.id)}
                    onDoubleClick={() => openDraft(row.id)}
                  >
                    <td className="code-cell">{row.invoiceNo}</td>
                    <td>{row.supplierName}</td>
                    <td>{row.currency}</td>
                    <td className="money-cell">{formatMoney(row.totalAmount, row.currency)}</td>
                    <td><span className="draft-badge">{row.status}</span></td>
                    <td className="money-cell">{row.itemCount}</td>
                    <td>{formatDate(row.createdAt)}</td>
                    <td>{formatDate(row.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="screen-summary invoice-list-summary">
        <span>Toplam taslak: {meta?.total ?? rows.length}</span>
        <span>Liste kaydı: {rows.length}</span>
        <span>Durum: DRAFT</span>
        <span>Kaynak: API / okuma modu</span>
      </section>
    </main>
  );
}
