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
    description: 'Zorunlu: stockCode, barcode, productName, currency, salePrice, purchasePrice. currency: TRY / USD / EUR.',
  },
  {
    id: 'customers',
    label: 'Cari Aktarimi',
    description: 'Zorunlu: customerCode, customerName, phone, currency, customerType. currency: TRY / USD / EUR.',
  },
];

const csvTemplates = {
  products: {
    fileName: 'melisa-urun-import-sablon.csv',
    excelFileName: 'melisa-urun-import-sablon.xls',
    rows: [
      ['stockCode', 'barcode', 'productName', 'brand', 'category', 'currency', 'salePrice', 'purchasePrice', 'stockQuantity'],
      ['STK-ORNEK-001', '8690000000012', 'Pamuk Bebek Battaniye', 'Melisa Bebe', 'Battaniye', 'TRY', '350', '210', '25'],
      ['STK-ORNEK-002', '8690000000029', 'Organik Zibin Seti', 'Melisa Bebe', 'Zibin', 'USD', '18.50', '10.25', '40'],
      ['STK-ORNEK-003', '8690000000036', 'Kiz Bebek Elbise', 'Melisa Bebe', 'Elbise', 'EUR', '22.90', '14.40', '12'],
    ],
  },
  customers: {
    fileName: 'melisa-cari-import-sablon.csv',
    excelFileName: 'melisa-cari-import-sablon.xls',
    rows: [
      ['customerCode', 'customerName', 'phone', 'city', 'country', 'currency', 'customerType', 'balance'],
      ['C-ORNEK-001', 'Semih Bebe', '05320000000', 'Istanbul', 'TR', 'TRY', 'customer', '0'],
      ['C-ORNEK-002', 'Melisa Export', '05330000000', 'Bursa', 'TR', 'USD', 'wholesale', '1250'],
    ],
  },
};

function escapeCsvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadCsvTemplate(entity) {
  const template = csvTemplates[entity];
  const csv = template.rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = template.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeXmlCell(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function downloadExcelTemplate(entity) {
  const template = csvTemplates[entity];
  const rows = template.rows
    .map((row) => `
      <Row>
        ${row.map((cell) => `<Cell><Data ss:Type="String">${escapeXmlCell(cell)}</Data></Cell>`).join('')}
      </Row>`)
    .join('');
  const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="${entity === 'products' ? 'Urun Import' : 'Cari Import'}">
    <Table>${rows}</Table>
  </Worksheet>
</Workbook>`;
  const blob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = template.excelFileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatStatus(status) {
  if (status === 'valid') return 'Gecerli';
  if (status === 'duplicate') return 'Duplicate';
  return 'Hatali';
}

function getImportColumns(activeEntity) {
  return [
    { key: 'rowNumber', label: 'Satir', width: 70, value: (row) => row.rowNumber },
    { key: 'status', label: 'Durum', width: 110, value: (row) => formatStatus(row.status) },
    {
      key: 'code',
      label: 'Kod',
      width: 180,
      value: (row) => (activeEntity === 'products' ? row.data?.stockCode : row.data?.customerCode) || '-',
    },
    {
      key: 'name',
      label: 'Ad / Unvan',
      width: 240,
      value: (row) => (activeEntity === 'products' ? row.data?.productName : row.data?.customerName) || '-',
    },
    {
      key: 'contact',
      label: activeEntity === 'products' ? 'Barkod' : 'Telefon',
      width: 180,
      value: (row) => (activeEntity === 'products' ? row.data?.barcode : row.data?.phone) || '-',
    },
    {
      key: 'currency',
      label: activeEntity === 'products' ? 'Urun Para Birimi' : 'Cari Para Birimi',
      width: 150,
      value: (row) => row.data?.currency || '-',
    },
    {
      key: 'amount',
      label: activeEntity === 'products' ? 'Stok' : 'Bakiye',
      width: 120,
      align: 'right',
      value: (row) => (activeEntity === 'products' ? row.data?.stockQuantity : row.data?.balance) ?? '-',
    },
    {
      key: 'messages',
      label: 'Hata / Uyari',
      width: 320,
      value: (row) => [...(row.errors || []), ...(row.warnings || [])].join(' | ') || '-',
    },
  ];
}

function ImportValidationTable({ preview, activeEntity, visibleColumns, columnWidths }) {
  const rows = preview?.rows || [];
  const visibleRows = rows.slice(0, 80);
  const columns = getImportColumns(activeEntity).filter((column) => visibleColumns[column.key] !== false);

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
            {columns.map((column) => (
              <th key={column.key} style={{ width: columnWidths[column.key] || column.width }}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => {
            return (
              <tr className={`import-row-${row.status}`} key={`${row.rowNumber}-${row.data?.stockCode || row.data?.customerCode || row.status}`}>
                {columns.map((column) => (
                  <td
                    className={[
                      column.key === 'code' ? 'code-cell' : '',
                      column.align === 'right' ? 'money-cell' : '',
                    ].filter(Boolean).join(' ')}
                    key={column.key}
                    style={{ width: columnWidths[column.key] || column.width }}
                  >
                    {column.value(row)}
                  </td>
                ))}
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
  const [commitValidOnly, setCommitValidOnly] = useState(true);
  const [visibleColumns, setVisibleColumns] = useState({
    rowNumber: true,
    status: true,
    code: true,
    name: true,
    contact: true,
    currency: true,
    amount: true,
    messages: true,
  });
  const [columnWidths, setColumnWidths] = useState({
    rowNumber: 70,
    status: 110,
    code: 180,
    name: 240,
    contact: 180,
    currency: 150,
    amount: 120,
    messages: 320,
  });
  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeEntity), [activeEntity]);
  const activeColumns = useMemo(() => getImportColumns(activeEntity), [activeEntity]);
  const canCommit = preview
    && preview.validRowCount > 0
    && (commitValidOnly || (preview.invalidRowCount === 0 && preview.duplicateRowCount === 0));

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
        ? await commitProductsImport(selectedFile, { validOnly: commitValidOnly })
        : await commitCustomersImport(selectedFile, { validOnly: commitValidOnly });
      setPreview(response.data.preview);
      const skipped = Number(response.data.skippedInvalidCount || 0) + Number(response.data.skippedDuplicateCount || 0);
      setMessage(
        response.message
        || `${response.data.insertedCount} kayit aktarildi. ${skipped ? `${skipped} hatali/duplicate satir atlandi.` : 'Audit log yazildi.'}`,
      );
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
            {commitValidOnly ? 'Gecerli Satirlari Ekle' : 'Commit'}
          </button>
          <button onClick={() => downloadCsvTemplate(activeEntity)} type="button">
            Ornek CSV Sablon Indir
          </button>
          <button onClick={() => downloadExcelTemplate(activeEntity)} type="button">
            Ornek Excel Sablon Indir
          </button>
        </div>
      </section>

      <section className="import-grid-controls">
        <label className="import-valid-only-toggle">
          <input
            checked={commitValidOnly}
            onChange={(event) => setCommitValidOnly(event.target.checked)}
            type="checkbox"
          />
          <span>Sadece hatasiz/gecerli satirlari ekle</span>
        </label>
        <div className="import-column-controls">
          {activeColumns.map((column) => (
            <label key={column.key}>
              <input
                checked={visibleColumns[column.key] !== false}
                onChange={(event) => setVisibleColumns((current) => ({
                  ...current,
                  [column.key]: event.target.checked,
                }))}
                type="checkbox"
              />
              <span>{column.label}</span>
              <input
                aria-label={`${column.label} genislik`}
                min="60"
                onChange={(event) => setColumnWidths((current) => ({
                  ...current,
                  [column.key]: Math.max(60, Number(event.target.value) || column.width),
                }))}
                step="10"
                type="number"
                value={columnWidths[column.key] || column.width}
              />
            </label>
          ))}
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
          {activeEntity === 'products' ? (
            <span>
              Urun para birimi fiyatlarin para birimidir. Stok miktari toplu giris icin baslangic adedi olarak okunur.
            </span>
          ) : null}
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
        <ImportValidationTable
          activeEntity={activeEntity}
          columnWidths={columnWidths}
          preview={preview}
          visibleColumns={visibleColumns}
        />
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
