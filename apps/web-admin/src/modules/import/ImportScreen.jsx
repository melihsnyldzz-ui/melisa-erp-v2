import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  commitCustomersImport,
  commitProductsImport,
  commitSuppliersImport,
  previewCustomersImport,
  previewProductsImport,
  previewSuppliersImport,
} from '../../services/importApi.js';

const tabs = [
  {
    id: 'products',
    label: 'Ürün Aktarımı',
    shortLabel: 'Ürünler',
    description: 'Zorunlu: stockCode, barcode, productName, currency, salePrice, purchasePrice. currency: TRY / USD / EUR.',
    audit: 'import_products',
  },
  {
    id: 'customers',
    label: 'Müşteri Cari Aktarımı',
    shortLabel: 'Müşteri Carileri',
    description: 'Zorunlu: customerCode, customerName, phone, currency, customerType. customerType: customer / wholesale / retail / mixed.',
    audit: 'import_customers',
  },
  {
    id: 'suppliers',
    label: 'Tedarikçi Cari Aktarımı',
    shortLabel: 'Tedarikçi Carileri',
    description: 'Zorunlu: supplierCode, supplierName, currency. purchaseDiscountRate alış fişinde önerilecek iskonto oranıdır.',
    audit: 'import_suppliers',
  },
];

const csvTemplates = {
  products: {
    fileName: 'melisa-urun-import-sablon.csv',
    excelFileName: 'melisa-urun-import-sablon.xlsx',
    sheetName: 'Ürün Import',
    rows: [
      ['stockCode', 'barcode', 'productName', 'brand', 'category', 'currency', 'salePrice', 'purchasePrice', 'stockQuantity'],
      ['STK-ORNEK-001', '8690000000012', 'Pamuk Bebek Battaniye', 'Melisa Bebe', 'Battaniye', 'TRY', '350', '210', '25'],
      ['STK-ORNEK-002', '8690000000029', 'Organik Zıbın Seti', 'Melisa Bebe', 'Zıbın', 'USD', '18.50', '10.25', '40'],
      ['STK-ORNEK-003', '8690000000036', 'Kız Bebek Elbise', 'Melisa Bebe', 'Elbise', 'EUR', '22.90', '14.40', '12'],
    ],
  },
  customers: {
    fileName: 'melisa-musteri-cari-import-sablon.csv',
    excelFileName: 'melisa-musteri-cari-import-sablon.xlsx',
    sheetName: 'Müşteri Cari Import',
    rows: [
      ['customerCode', 'customerName', 'phone', 'city', 'country', 'currency', 'customerType', 'balance'],
      ['MC-ORNEK-001', 'Semih Bebe', '05320000000', 'İstanbul', 'TR', 'TRY', 'customer', '0'],
      ['MC-ORNEK-002', 'Melisa Export', '05330000000', 'Bursa', 'TR', 'USD', 'wholesale', '1250'],
    ],
  },
  suppliers: {
    fileName: 'melisa-tedarikci-cari-import-sablon.csv',
    excelFileName: 'melisa-tedarikci-cari-import-sablon.xlsx',
    sheetName: 'Tedarikci Cari Import',
    rows: [
      ['supplierCode', 'supplierName', 'phone', 'city', 'country', 'currency', 'purchaseDiscountRate', 'balance'],
      ['TC-ORNEK-001', 'Kardelen Bebe Üretim', '02120000000', 'İstanbul', 'TR', 'TRY', '0', '0'],
      ['TC-ORNEK-002', 'Estella Concept', '02160000000', 'Bursa', 'TR', 'USD', '15', '0'],
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
  downloadBlob(blob, template.fileName);
}

function downloadExcelTemplate(entity) {
  const template = csvTemplates[entity];
  const worksheet = XLSX.utils.aoa_to_sheet(template.rows.map((row) => row.map((cell) => String(cell ?? ''))));
  const range = XLSX.utils.decode_range(worksheet['!ref']);

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = worksheet[cellRef];

      if (cell) {
        cell.t = 's';
        cell.z = '@';
      }
    }
  }

  worksheet['!cols'] = template.rows[0].map((header, columnIndex) => ({
    wch: Math.max(
      String(header ?? '').length + 4,
      ...template.rows.slice(1).map((row) => String(row[columnIndex] ?? '').length + 2),
      14,
    ),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, template.sheetName.slice(0, 31));
  const workbookArray = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([workbookArray], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, template.excelFileName);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadPreviewErrors(preview, activeEntity) {
  const rows = (preview.rows || []).filter((row) => row.status !== 'valid');
  const columns = getImportColumns(activeEntity);
  const csvRows = [
    columns.map((column) => column.label),
    ...rows.map((row) => columns.map((column) => column.value(row))),
  ];
  const csv = csvRows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `melisa-${activeEntity}-hata-raporu.csv`);
}

function formatStatus(status) {
  if (status === 'valid') return 'Geçerli';
  if (status === 'duplicate') return 'Duplicate';
  return 'Hatalı';
}

function getRowCode(row, activeEntity) {
  if (activeEntity === 'products') return row.data.stockCode;
  if (activeEntity === 'suppliers') return row.data.supplierCode;
  return row.data.customerCode;
}

function getRowName(row, activeEntity) {
  if (activeEntity === 'products') return row.data.productName;
  if (activeEntity === 'suppliers') return row.data.supplierName;
  return row.data.customerName;
}

function getContactLabel(activeEntity) {
  if (activeEntity === 'products') return 'Barkod';
  return 'Telefon';
}

function getContactValue(row, activeEntity) {
  if (activeEntity === 'products') return row.data.barcode;
  return row.data.phone;
}

function getAmountLabel(activeEntity) {
  if (activeEntity === 'products') return 'Stok';
  if (activeEntity === 'suppliers') return 'Bakiye / İskonto';
  return 'Bakiye';
}

function getAmountValue(row, activeEntity) {
  if (activeEntity === 'products') return row.data?.stockQuantity ?? '-';
  if (activeEntity === 'suppliers') {
    return `${row.data.balance ?? 0} / %${row.data.purchaseDiscountRate ?? 0}`;
  }
  return row.data?.balance ?? '-';
}

function getImportColumns(activeEntity) {
  return [
    { key: 'rowNumber', label: 'Satır', width: 70, value: (row) => row.rowNumber },
    { key: 'status', label: 'Durum', width: 110, value: (row) => formatStatus(row.status) },
    {
      key: 'code',
      label: 'Kod',
      width: 180,
      value: (row) => getRowCode(row, activeEntity) || '-',
    },
    {
      key: 'name',
      label: activeEntity === 'products' ? 'Ürün Adı' : 'Ad / Ünvan',
      width: 260,
      value: (row) => getRowName(row, activeEntity) || '-',
    },
    {
      key: 'contact',
      label: getContactLabel(activeEntity),
      width: 180,
      value: (row) => getContactValue(row, activeEntity) || '-',
    },
    {
      key: 'currency',
      label: activeEntity === 'products' ? 'Ürün Para Birimi' : 'Cari Para Birimi',
      width: 160,
      value: (row) => row.data.currency || '-',
    },
    {
      key: 'amount',
      label: getAmountLabel(activeEntity),
      width: 140,
      align: 'right',
      value: (row) => getAmountValue(row, activeEntity),
    },
    {
      key: 'messages',
      label: 'Hata / Uyarı',
      width: 360,
      value: (row) => [...(row.errors || []), ...(row.warnings || [])].join(' | ') || '-',
    },
  ];
}

function ImportValidationTable({ preview, activeEntity, visibleColumns, columnWidths, onOpenDuplicateProduct }) {
  const rows = preview?.rows || [];
  const visibleRows = rows.slice(0, 120);
  const columns = getImportColumns(activeEntity).filter((column) => visibleColumns[column.key] !== false);

  if (!preview) {
    return <div className="list-state">Dosya seçilip preview alındığında validasyon satırları burada görünür.</div>;
  }

  if (rows.length === 0) {
    return <div className="list-state list-state-passive">Dosyada aktarılacak satır bulunamadı.</div>;
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
          {visibleRows.map((row) => (
            <tr className={`import-row-${row.status}`} key={`${row.rowNumber}-${getRowCode(row, activeEntity) || row.status}`}>
              {columns.map((column) => (
                <td
                  className={[
                    column.key === 'code' ? 'code-cell' : '',
                    column.align === 'right' ? 'money-cell' : '',
                  ].filter(Boolean).join(' ')}
                  key={column.key}
                  style={{ width: columnWidths[column.key] || column.width }}
                  title={String(column.value(row) ?? '')}
                >
                  {column.value(row)}
                  {column.key === 'messages' && activeEntity === 'products' && row.duplicateProduct ? (
                    <button
                      className="mini-button import-duplicate-link"
                      onClick={() => onOpenDuplicateProduct?.(row.duplicateProduct)}
                      type="button"
                    >
                      Stok kart?ni ac: {row.duplicateProduct.stockCode}
                    </button>
                  ) : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > visibleRows.length ? (
        <div className="list-state list-state-passive">İlk 120 satır gösteriliyor. Toplam satır: {rows.length}</div>
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

async function previewImport(entity, file) {
  if (entity === 'products') return previewProductsImport(file);
  if (entity === 'suppliers') return previewSuppliersImport(file);
  return previewCustomersImport(file);
}

async function commitImport(entity, file, options) {
  if (entity === 'products') return commitProductsImport(file, options);
  if (entity === 'suppliers') return commitSuppliersImport(file, options);
  return commitCustomersImport(file, options);
}

export function ImportScreen({ onOpenScreen }) {
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
    name: 260,
    contact: 180,
    currency: 160,
    amount: 140,
    messages: 360,
  });
  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeEntity), [activeEntity]);
  const activeColumns = useMemo(() => getImportColumns(activeEntity), [activeEntity]);
  const validTotal = Number(preview?.validRowCount || 0);
  const invalidTotal = Number(preview?.invalidRowCount || 0) + Number(preview?.duplicateRowCount || 0);
  const skippedCommitTotal = commitValidOnly ? invalidTotal : 0;
  let commitPlanText = 'Preview alındığında commit planı burada görünür.';
  if (preview && commitValidOnly) {
    commitPlanText = `${validTotal} geçerli satır DB'ye yazılacak, ${skippedCommitTotal} hatalı/duplicate satır atlanacak.`;
  } else if (preview && invalidTotal > 0) {
    commitPlanText = `${invalidTotal} hatalı/duplicate satır var; tam commit kapalı.`;
  } else if (preview) {
    commitPlanText = `${validTotal} satırın tamamı DB'ye yazılabilir.`;
  }
  const canCommit = preview
    && validTotal > 0
    && (commitValidOnly || invalidTotal === 0);

  function resetResult() {
    setPreview(null);
    setMessage('');
    setErrorMessage('');
  }

  function switchEntity(entity) {
    setActiveEntity(entity);
    setSelectedFile(null);
    resetResult();
  }

  async function handlePreview() {
    setIsLoading(true);
    setMessage('');
    setErrorMessage('');

    try {
      const response = await previewImport(activeEntity, selectedFile);
      setPreview(response.data);
      setMessage('Preview tamamlandı. DB yazımı yapılmadı.');
    } catch (error) {
      setErrorMessage(`${error.message || 'Preview başarısız.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCommit() {
    setIsLoading(true);
    setMessage('');
    setErrorMessage('');

    try {
      const response = await commitImport(activeEntity, selectedFile, { validOnly: commitValidOnly });
      setPreview(response.data.preview);
      const skipped = Number(response.data.skippedInvalidCount || 0) + Number(response.data.skippedDuplicateCount || 0);
      setMessage(`${response.data.insertedCount} kayıt aktarıldı. ${skipped ? `${skipped} hatalı/duplicate satır atlandı.` : 'Audit log yazıldı.'}`);
    } catch (error) {
      setErrorMessage(`${error.message || 'Commit başarısız.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  function openDuplicateProduct(duplicateProduct) {
    const productId = duplicateProduct.productId || duplicateProduct.id;
    if (!productId || !onOpenScreen) {
      return;
    }

    onOpenScreen('product-card', {
      productId,
      stockCode: duplicateProduct.stockCode,
    });
  }

  return (
    <main className="work-area import-screen">
      <section className="import-toolbar">
        <div className="import-title-block">
          <strong>Excel / CSV Aktarım Merkezi</strong>
          <span>Preview, validasyon, duplicate kontrol ve audit destekli aktarım</span>
        </div>
        <div className="import-actions">
          {tabs.map((tab) => (
            <button
              className={activeEntity === tab.id ? 'pressed' : ''}
              key={tab.id}
              onClick={() => switchEntity(tab.id)}
              type="button"
            >
              {tab.shortLabel}
            </button>
          ))}
          <button disabled={isLoading || !selectedFile} onClick={handlePreview} type="button">
            Preview
          </button>
          <button className="primary" disabled={isLoading || !canCommit} onClick={handleCommit} type="button">
            {commitValidOnly ? 'Geçerli Satırları Ekle' : 'Tamamını Commit Et'}
          </button>
          <button onClick={() => downloadCsvTemplate(activeEntity)} type="button">
            Örnek CSV İndir
          </button>
          <button onClick={() => downloadExcelTemplate(activeEntity)} type="button">
            Örnek Excel İndir
          </button>
          <button disabled={!invalidTotal} onClick={() => downloadPreviewErrors(preview, activeEntity)} type="button">
            Hata Raporu CSV
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
          <span>Sadece hatasız/geçerli satırları ekle</span>
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
                aria-label={`${column.label} genişlik`}
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
            key={activeEntity}
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
            <span>Ürün para birimi fiyatların para birimidir. Stok miktarı toplu giriş için başlangıç adedi olarak okunur.</span>
          ) : null}
          {activeEntity === 'suppliers' ? (
            <span>Tedarikçi alış iskontosu kart üzerinde saklanır ve alış fişinde öneri olarak kullanılabilir.</span>
          ) : null}
        </div>
      </section>

      <section className="import-summary-grid">
        <SummaryBox label="Toplam satır" value={preview?.totalRows ?? '-'} />
        <SummaryBox label="Geçerli" value={preview?.validRowCount ?? '-'} tone="good" />
        <SummaryBox label="Hatalı" value={preview?.invalidRowCount ?? '-'} tone="danger" />
        <SummaryBox label="Duplicate" value={preview?.duplicateRowCount ?? '-'} tone="warn" />
        <div className={`import-commit-plan-inline ${canCommit ? 'commit-ready' : 'commit-waiting'}`}>
          <span>Commit plani</span>
          <strong>{commitPlanText}</strong>
          <small>{selectedFile?.name || 'Dosya se?ilmedi'}</small>
        </div>
        <SummaryBox label="Uyarı" value={preview?.warnings?.length ?? '-'} tone="info" />
      </section>

      {isLoading && <div className="list-state">Aktarım işlemi çalışıyor...</div>}
      {message && <div className="list-state list-state-success">{message}</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <section className="erp-panel import-validation-panel">
        <div className="panel-title">
          <strong>Validasyon Grid</strong>
          <span>{commitValidOnly ? 'Hatalı/duplicate satırlar atlanır, sadece geçerli satırlar yazılır.' : 'Hata varsa commit DB’ye yazmaz.'}</span>
        </div>
        <ImportValidationTable
          activeEntity={activeEntity}
          columnWidths={columnWidths}
          onOpenDuplicateProduct={openDuplicateProduct}
          preview={preview}
          visibleColumns={visibleColumns}
        />
      </section>

      <section className="screen-summary import-summary">
        <span>Hedef DB: MELISA_ERP_V2</span>
        <span>Ürün / müşteri / tedarikçi ayrı import</span>
        <span>Geçerli satır seçeneği aktif</span>
        <span>Audit: {activeTab.audit}</span>
      </section>
    </main>
  );
}
