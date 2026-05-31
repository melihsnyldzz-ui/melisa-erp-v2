import React, { useEffect, useMemo, useState } from 'react';
import { fetchSalesDrafts } from '../../services/invoiceDraftApi.js';

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

export function SalesInvoiceListScreen({ onOpenScreen }) {
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState('');
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
      const response = await fetchSalesDrafts({
        page: 1,
        limit: 100,
        search,
        customer,
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
      setErrorMessage(error.message || 'Satis taslak listesi API baglantisi basarisiz.');
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
        const response = await fetchSalesDrafts({
          page: 1,
          limit: 100,
          search,
          customer,
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
          setErrorMessage(error.message || 'Satis taslak listesi API baglantisi basarisiz.');
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
  }, [customer, search]);

  function openDraft(rowId = selectedRow?.id) {
    if (!rowId) {
      setErrorMessage('Fis acmak icin listeden bir taslak secin.');
      return;
    }

    setErrorMessage('');
    const row = rows.find((item) => item.id === rowId);
    onOpenScreen('sales-invoice', { salesDraftId: rowId, invoiceNo: row?.invoiceNo });
  }

  return (
    <main className="work-area invoice-list-screen">
      <section className="invoice-list-toolbar">
        <div className="invoice-list-title">
          <strong>Satis Fisleri</strong>
          <span>Kaydedilmis taslak satis fisleri / SQL SELECT</span>
        </div>
        <div className="invoice-list-actions">
          <button type="button" onClick={() => onOpenScreen('sales-invoice')}>Yeni Fis</button>
          <button type="button" onClick={() => openDraft()}>Fis Ac</button>
          <button type="button" onClick={loadDrafts}>Yenile</button>
        </div>
      </section>

      <section className="invoice-list-filters">
        <label>
          <span>Fis / genel arama</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Fis no veya musteri" />
        </label>
        <label>
          <span>Musteri</span>
          <input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Musteri adi" />
        </label>
        <label>
          <span>Durum</span>
          <input value="DRAFT" readOnly />
        </label>
      </section>

      <section className="erp-panel invoice-list-panel">
        <div className="panel-title">
          <strong>Satis Taslak Tablosu</strong>
          <span>Secili: {selectedRow?.invoiceNo ?? 'yok'} / Satir: {rows.length}</span>
        </div>
        {isLoading && <div className="list-state">API'den satis taslaklari yukleniyor...</div>}
        {!isLoading && errorMessage && (
          <div className="list-state list-state-error">{errorMessage} Mock fallback yok.</div>
        )}
        {!isLoading && !errorMessage && rows.length === 0 && (
          <div className="list-state">Kayit bulunamadi veya secilen filtreler bos.</div>
        )}
        {!isLoading && !errorMessage && rows.length > 0 && (
          <div className="table-wrap invoice-table-wrap">
            <table className="invoice-list-table">
              <thead>
                <tr>
                  <th>Fis no</th>
                  <th>Musteri</th>
                  <th>PB</th>
                  <th>Toplam</th>
                  <th>Durum</th>
                  <th>Satir</th>
                  <th>Olusturma</th>
                  <th>Guncelleme</th>
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
                    <td>{row.customerName}</td>
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
        <span>Liste kaydi: {rows.length}</span>
        <span>Durum: DRAFT</span>
        <span>Kaynak: API SQL</span>
      </section>
    </main>
  );
}
