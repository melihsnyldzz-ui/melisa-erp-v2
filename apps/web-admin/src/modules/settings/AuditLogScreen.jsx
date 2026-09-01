import React, { useEffect, useMemo, useState } from 'react';
import { fetchAuditCoverage, fetchAuditLogs } from '../../services/auditApi.js';
import { exportRowsToExcel, printRowsReport } from '../../utils/exportUtils.js';

function formatDate(value) {
  return value ? new Date(value).toLocaleString('tr-TR') : '-';
}

function coverageTone(status) {
  if (status === 'covered') return 'good';
  if (status === 'partial') return 'warn';
  return 'danger';
}

function statusLabel(status) {
  if (status === 'covered') return 'Tam';
  if (status === 'partial') return 'Kısmi';
  return 'Eksik';
}

const auditColumns = [
  { label: 'Tarih', value: (row) => formatDate(row.createdAt) },
  { label: 'Kullanıcı', key: 'actorName' },
  { label: 'İşlem', key: 'action' },
  { label: 'Kayıt', value: (row) => `${row.entityType || '-'} #${row.entityId || '-'}` },
  { label: 'Kaynak', key: 'source' },
  { label: 'Sebep', key: 'reason' },
];

const coverageAreaCopy = {
  sales: {
    label: 'Satış fişleri',
    description: 'Satış taslağı, kesinleştirme, düzeltme ve iptal işlemleri.',
  },
  purchase: {
    label: 'Alış fişleri',
    description: 'Alış taslağı, kesinleştirme, düzeltme ve iptal işlemleri.',
  },
  finance: {
    label: 'Tahsilat ve ödeme',
    description: 'Cari bakiye ile kasa ve banka bakiyesini etkileyen finans işlemleri.',
  },
  stock: {
    label: 'Stok ve ürün',
    description: 'Ürün kartı, aktiflik durumu ve stok sayımı düzeltmeleri.',
  },
  customer_supplier: {
    label: 'Cari kartlar',
    description: 'Müşteri ve tedarikçi kartı değişiklikleri.',
  },
  import: {
    label: 'Veri aktarımı',
    description: 'Toplu veri aktarımının onaylanmış sonuçları.',
  },
  auth_settings: {
    label: 'Yetki ve ayarlar',
    description: 'Kullanıcı yetkisi, sistem ayarı ve döviz kuru değişiklikleri.',
  },
  crm_pipeline: {
    label: 'Teklif ve sipariş',
    description: 'Teklif ve sipariş sürecindeki durum değişiklikleri.',
  },
  terminal: {
    label: 'Terminal',
    description: 'Terminal satışı, eşitleme ve fiş yazdırma işlemleri.',
  },
};

const riskLabels = {
  critical: 'Kritik',
  high: 'Yüksek',
  medium: 'Orta',
  low: 'Düşük',
};

function coverageAreaLabel(area) {
  return coverageAreaCopy[area.key]?.label || area.label || area.key || '-';
}

function coverageAreaDescription(area) {
  return coverageAreaCopy[area.key]?.description || area.description || '-';
}

function riskLabel(risk) {
  return riskLabels[risk] || risk || '-';
}

function snapshotLabel(log) {
  return [log.hasBeforeSnapshot ? 'Önce' : '', log.hasAfterSnapshot ? 'Sonra' : ''].filter(Boolean).join(' / ') || '-';
}

const initialFilters = {
  search: '',
  action: '',
  entityType: '',
  source: '',
  limit: 200,
};

export function AuditLogScreen() {
  const [filters, setFilters] = useState(initialFilters);
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState({});
  const [coverage, setCoverage] = useState([]);
  const [coverageSummary, setCoverageSummary] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadAuditData(nextFilters = filters) {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const [logsResponse, coverageResponse] = await Promise.all([
        fetchAuditLogs(nextFilters),
        fetchAuditCoverage(),
      ]);
      setLogs(logsResponse.data || []);
      setMeta(logsResponse.meta || {});
      setCoverage(coverageResponse.data?.coverage || []);
      setCoverageSummary(coverageResponse.data?.summary || {});
    } catch (error) {
      setLogs([]);
      setCoverage([]);
      setCoverageSummary({});
      setErrorMessage(`${error.message || 'Denetim kayıtları okunamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAuditData(initialFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const actionOptions = useMemo(() => (
    [...new Set(logs.map((log) => log.action).filter(Boolean))].sort()
  ), [logs]);

  const entityOptions = useMemo(() => (
    [...new Set(logs.map((log) => log.entityType).filter(Boolean))].sort()
  ), [logs]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters() {
    loadAuditData(filters);
  }

  function clearFilters() {
    setFilters(initialFilters);
    loadAuditData(initialFilters);
  }

  function exportAuditExcel() {
    exportRowsToExcel({
      filename: 'denetim-gunlugu',
      title: 'Melisa ERP Denetim Günlüğü',
      rows: logs,
      columns: auditColumns,
    });
  }

  function printAudit() {
    printRowsReport({
      title: 'Melisa ERP - Denetim Günlüğü',
      subtitle: `${logs.length} kayıt / salt okunur denetim`,
      rows: logs,
      columns: auditColumns,
    });
  }

  return (
    <main className="work-area dashboard-screen audit-log-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Denetim Günlüğü</strong>
          <span>Kritik işlem izleri, kapsam durumu ve filtreli denetim</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={applyFilters}>Yenile</button>
          <button type="button" onClick={exportAuditExcel} disabled={!logs.length}>Excel</button>
          <button type="button" onClick={printAudit} disabled={!logs.length}>Yazdır/PDF</button>
        </div>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Salt Okunur Kapsam</strong>
          <span>Güvenli izleme</span>
        </div>
        <div className="list-state list-state-success">
          Bu ekran yalnızca denetim kayıtlarını okur. Veritabanına yazma, temizlik, sıfırlama, geri yükleme, yayınlama veya dış mesaj gönderme işlemi başlatmaz.
        </div>
      </section>

      {isLoading && <div className="list-state">Denetim kayıtları sunucudan okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <section className="dashboard-kpi-grid">
        <article className="dashboard-kpi info">
          <span>Filtreli kayıt</span>
          <strong>{logs.length}</strong>
          <small>Gösterim sınırı: {meta.limit || filters.limit}</small>
        </article>
        <article className="dashboard-kpi good">
          <span>Tam kapsam</span>
          <strong>{coverageSummary.coveredAreas || 0}</strong>
          <small>{coverageSummary.totalAreas || 0} alan</small>
        </article>
        <article className="dashboard-kpi warn">
          <span>Kısmi kapsam</span>
          <strong>{coverageSummary.partialAreas || 0}</strong>
          <small>Kontrol edilecek</small>
        </article>
        <article className="dashboard-kpi danger">
          <span>Eksik kapsam</span>
          <strong>{coverageSummary.missingAreas || 0}</strong>
          <small>Denetim kaydı yok veya henüz işlem yapılmadı</small>
        </article>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Filtreler</strong>
          <span>Sunucu tarafında filtrelenir</span>
        </div>
        <div className="filter-grid auth-admin-audit-filter-grid">
          <label>
            Ara
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Kullanıcı, işlem, kayıt veya sebep" />
          </label>
          <label>
            İşlem
            <select value={filters.action} onChange={(event) => updateFilter('action', event.target.value)}>
              <option value="">Tüm işlemler</option>
              {actionOptions.map((action) => <option key={action} value={action}>{action}</option>)}
            </select>
          </label>
          <label>
            Kayıt türü
            <select value={filters.entityType} onChange={(event) => updateFilter('entityType', event.target.value)}>
              <option value="">Tüm kayıt türleri</option>
              {entityOptions.map((entityType) => <option key={entityType} value={entityType}>{entityType}</option>)}
            </select>
          </label>
          <label>
            Kaynak
            <input value={filters.source} onChange={(event) => updateFilter('source', event.target.value)} placeholder="web-admin / SYSTEM" />
          </label>
          <label>
            Gösterim sınırı
            <select value={filters.limit} onChange={(event) => updateFilter('limit', Number(event.target.value))}>
              <option value={80}>80</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </label>
        </div>
        <div className="auth-admin-audit-actions">
          <button type="button" onClick={applyFilters}>Filtrele</button>
          <button type="button" onClick={clearFilters}>Temizle</button>
        </div>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Kapsam Haritası</strong>
          <span>Kritik işlem alanları</span>
        </div>
        <div className="table-shell">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Alan</th>
                <th>Risk</th>
                <th>Durum</th>
                <th>Kapsam</th>
                <th>İşlem kodları (kayıt sayısı)</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((area) => (
                <tr key={area.key}>
                  <td>
                    <strong>{coverageAreaLabel(area)}</strong>
                    <br />
                    <small>{coverageAreaDescription(area)}</small>
                  </td>
                  <td>{riskLabel(area.risk)}</td>
                  <td><span className={`status-pill ${coverageTone(area.status)}`}>{statusLabel(area.status)}</span></td>
                  <td>{area.coveredActions}/{area.expectedActions}</td>
                  <td>{area.actions.map((action) => `${action.action}: ${action.count}`).join(' / ')}</td>
                </tr>
              ))}
              {!coverage.length && !isLoading && (
                <tr><td colSpan="5">Kapsam bilgisi bulunamadı.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="erp-panel auth-admin-audit-panel">
        <div className="panel-title">
          <strong>Denetim Kayıtları</strong>
          <span>{logs.length} kayıt / kaynak {meta.source || 'audit-api'}</span>
        </div>
        <div className="table-shell auth-admin-audit-table-shell">
          <table className="erp-table auth-admin-audit-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Kullanıcı</th>
                <th>İşlem</th>
                <th>Kayıt</th>
                <th>Kaynak</th>
                <th>Kayıt Görüntüsü</th>
                <th>Sebep</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDate(log.createdAt)}</td>
                  <td>{log.actorName}</td>
                  <td>{log.action}</td>
                  <td>{log.entityType} #{log.entityId || '-'}</td>
                  <td>{log.source || '-'}</td>
                  <td>{snapshotLabel(log)}</td>
                  <td>{log.reason || '-'}</td>
                </tr>
              ))}
              {!logs.length && !isLoading && (
                <tr><td colSpan="7">Filtreye uygun denetim kaydı yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
