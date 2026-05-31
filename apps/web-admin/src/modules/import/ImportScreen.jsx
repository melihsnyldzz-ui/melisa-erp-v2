import React, { useMemo, useState } from 'react';
import {
  commitCustomersImport,
  commitProductsImport,
  previewCustomersImport,
  previewProductsImport,
} from '../../services/importApi.js';

const tabs = [
  {
    id: 'products',
    label: 'Urun Aktarimi',
    description: 'stockCode, barcode, productName, brand, category, currency, salePrice, purchasePrice, stockQuantity',
  },
  {
    id: 'customers',
    label: 'Cari Aktarimi',
    description: 'customerCode, customerName, phone, city, country, currency, customerType, balance',
  },
];

function formatStatus(status) {
  if (status === 'valid') return 'Gecerli';
  if (status === 'duplicate') return 'Duplicate';
  return 'Hatali';
}

function ImportValidationTable({ preview, activeEntity }) {
  const rows = preview?.rows || [];
  const visibleRows = rows.slice(0, 80);

  if (!preview) {
    return <div className="list-state">Dosya secilip preview alindiginda validasyon satirlari burada gorunur.</div>;
  }

  if (rows.length === 0) {
    return <div className="list-state list-state-passive">Dosyada aktarilacak satir bulunamadi.</div>;
  }

  return (
    <div className="import-table-wrap">
      <table className="import-table">
        <thead>
          <tr>
            <th>Satir</th>
            <th>Durum</th>
            <th>Kod</th>
            <th>Ad / Unvan</th>
            <th>{activeEntity === 'products' ? 'Barkod' : 'Telefon'}</th>
            <th>PB</th>
            <th>{activeEntity === 'products' ? 'Stok' : 'Bakiye'}</th>
            <th>Hata / Uyari</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => {
            const data = row.data || {};
            const code = activeEntity === 'products' ? data.stockCode : data.customerCode;
            const name = activeEntity === 'products' ? data.productName : data.customerName;
            const contact = activeEntity === 'products' ? data.barcode : data.phone;
            const amount = activeEntity === 'products' ? data.stockQuantity : data.balance;
            const messages = [...(row.errors || []), ...(row.warnings || [])].join(' | ');

            return (
              <tr className={`import-row-${row.status}`} key={`${row.rowNumber}-${code}`}>
                <td>{row.rowNumber}</td>
                <td>{formatStatus(row.status)}</td>
                <td className="code-cell">{code || '-'}</td>
                <td>{name || '-'}</td>
                <td>{contact || '-'}</td>
                <td>{data.currency || '-'}</td>
                <td className="money-cell">{amount ?? '-'}</td>
                <td>{messages || '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > visibleRows.length ? (
        <div className="list-state list-state-passive">Ilk 80 satir gosteriliyor. Toplam satir: {rows.length}</div>
      ) : null}
    </div>
  );
}

function SummaryBox({ label, value, tone }) {
  return (
    <div className={`import-summary-box ${tone || ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ImportScreen() {
  const [activeEntity, setActiveEntity] = useState('products');
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeEntity), [activeEntity]);
  const canCommit = preview && preview.validRowCount > 0 && preview.invalidRowCount === 0 && preview.duplicateRowCount === 0;

  function resetResult() {
    setPreview(null);
    setMessage('');
    setErrorMessage('');
  }

  async function handlePreview() {
    setIsLoading(true);
    setMessage('');
    setErrorMessage('');

    try {
      const response = activeEntity === 'products'
        ? await previewProductsImport(selectedFile)
        : await previewCustomersImport(selectedFile);
      setPreview(response.data);
      setMessage('Preview tamamlandi. DB yazimi yapilmadi.');
    } catch (error) {
      setErrorMessage(`${error.message || 'Preview basarisiz.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCommit() {
    setIsLoading(true);
    setMessage('');
    setErrorMessage('');

    try {
      const response = activeEntity === 'products'
        ? await commitProductsImport(selectedFile)
        : await commitCustomersImport(selectedFile);
      setPreview(response.data.preview);
      setMessage(response.message || `${response.data.insertedCount} kayit aktarildi. Audit log yazildi.`);
    } catch (error) {
      setErrorMessage(`${error.message || 'Commit basarisiz.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="work-area import-screen">
      <section className="import-toolbar">
        <div className="import-title-block">
          <strong>Excel / CSV Aktarim Merkezi</strong>
          <span>Preview, validasyon, duplicate kontrol ve audit destekli aktarim</span>
        </div>
        <div className="import-actions">
          <button
            className={activeEntity === 'products' ? 'pressed' : ''}
            onClick={() => {
              setActiveEntity('products');
              resetResult();
            }}
            type="button"
          >
            Urunler
          </button>
          <button
            className={activeEntity === 'customers' ? 'pressed' : ''}
            onClick={() => {
              setActiveEntity('customers');
              resetResult();
            }}
            type="button"
          >
            Cariler
          </button>
          <button disabled={isLoading || !selectedFile} onClick={handlePreview} type="button">
            Preview
          </button>
          <button className="primary" disabled={isLoading || !canCommit} onClick={handleCommit} type="button">
            Commit
          </button>
        </div>
      </section>

      <section className="import-file-panel">
        <label>
          <span>Dosya</span>
          <input
            accept=".csv,.xls,.xlsx"
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] || null);
              resetResult();
            }}
            type="file"
          />
        </label>
        <div>
          <strong>{activeTab.label}</strong>
          <span>{activeTab.description}</span>
        </div>
      </section>

      <section className="import-summary-grid">
        <SummaryBox label="Toplam satir" value={preview?.totalRows ?? '-'} />
        <SummaryBox label="Gecerli" value={preview?.validRowCount ?? '-'} tone="good" />
        <SummaryBox label="Hatali" value={preview?.invalidRowCount ?? '-'} tone="danger" />
        <SummaryBox label="Duplicate" value={preview?.duplicateRowCount ?? '-'} tone="warn" />
        <SummaryBox label="Uyari" value={preview?.warnings?.length ?? '-'} tone="info" />
      </section>

      {isLoading && <div className="list-state">Aktarim islemi calisiyor...</div>}
      {message && <div className="list-state list-state-success">{message}</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <section className="erp-panel import-validation-panel">
        <div className="panel-title">
          <strong>Validasyon Grid</strong>
          <span>Validation basarisizsa commit DB'ye yazmaz</span>
        </div>
        <ImportValidationTable activeEntity={activeEntity} preview={preview} />
      </section>

      <section className="screen-summary import-summary">
        <span>Hedef DB: MELISA_ERP_V2</span>
        <span>Vega import yok</span>
        <span>Commit sadece temiz preview ile acilir</span>
        <span>Audit: import_products / import_customers</span>
      </section>
    </main>
  );
}
