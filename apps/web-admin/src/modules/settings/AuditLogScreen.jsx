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
  if (status === 'partial') return 'Kismi';
  return 'Eksik';
}

const auditColumns = [
  { label: 'Tarih', value: (row) => formatDate(row.createdAt) },
  { label: 'Kullanici', key: 'actorName' },
  { label: 'Aksiyon', key: 'action' },
  { label: 'Varlik', value: (row) => `${row.entityType || '-'} #${row.entityId || '-'}` },
  { label: 'Kaynak', key: 'source' },
  { label: 'Sebep', key: 'reason' },
];

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
      setErrorMessage(`${error.message || 'Audit kayitlari okunamadi.'} (${error.code || 'API_ERROR'})`);
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
      filename: 'audit-log',
      title: 'Melisa ERP Audit Log',
      rows: logs,
      columns: auditColumns,
    });
  }

  function printAudit() {
    printRowsReport({
      title: 'Melisa ERP - Audit Log',
      subtitle: `${logs.length} kayit / read-only denetim`,
      rows: logs,
      columns: auditColumns,
    });
  }

  return (
    <main className="work-area dashboard-screen audit-log-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Audit Log</strong>
          <span>Kritik islem izleri, coverage ve filtreli denetim</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={applyFilters}>Yenile</button>
          <button type="button" onClick={exportAuditExcel} disabled={!logs.length}>Excel</button>
          <button type="button" onClick={printAudit} disabled={!logs.length}>Yazdir/PDF</button>
        </div>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Read-only kapsam</strong>
          <span>Guvenli izleme</span>
        </div>
        <div className="list-state list-state-success">
          Bu ekran sadece audit kayitlarini okur. DB write, cleanup, reset, restore, deploy veya dis mesaj gonderimi baslatmaz.
        </div>
      </section>

      {isLoading && <div className="list-state">Audit kayitlari API'den okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <section className="dashboard-kpi-grid">
        <article className="dashboard-kpi info">
          <span>Filtreli kayit</span>
          <strong>{logs.length}</strong>
          <small>Limit {meta.limit || filters.limit}</small>
        </article>
        <article className="dashboard-kpi good">
          <span>Tam coverage</span>
          <strong>{coverageSummary.coveredAreas || 0}</strong>
          <small>{coverageSummary.totalAreas || 0} alan</small>
        </article>
        <article className="dashboard-kpi warn">
          <span>Kismi coverage</span>
          <strong>{coverageSummary.partialAreas || 0}</strong>
          <small>Kontrol edilecek</small>
        </article>
        <article className="dashboard-kpi danger">
          <span>Eksik coverage</span>
          <strong>{coverageSummary.missingAreas || 0}</strong>
          <small>Audit yok veya henuz islem yapilmadi</small>
        </article>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Filtreler</strong>
          <span>API tarafinda filtrelenir</span>
        </div>
        <div className="filter-grid auth-admin-audit-filter-grid">
          <label>
            Ara
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Kullanici, aksiyon, varlik, sebep" />
          </label>
          <label>
            Aksiyon
            <select value={filters.action} onChange={(event) => updateFilter('action', event.target.value)}>
              <option value="">Tum aksiyonlar</option>
              {actionOptions.map((action) => <option key={action} value={action}>{action}</option>)}
            </select>
          </label>
          <label>
            Varlik
            <select value={filters.entityType} onChange={(event) => updateFilter('entityType', event.target.value)}>
              <option value="">Tum varliklar</option>
              {entityOptions.map((entityType) => <option key={entityType} value={entityType}>{entityType}</option>)}
            </select>
          </label>
          <label>
            Kaynak
            <input value={filters.source} onChange={(event) => updateFilter('source', event.target.value)} placeholder="web-admin / SYSTEM" />
          </label>
          <label>
            Limit
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
          <strong>Coverage haritasi</strong>
          <span>Kritik islem alanlari</span>
        </div>
        <div className="table-shell">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Alan</th>
                <th>Risk</th>
                <th>Durum</th>
                <th>Kapsam</th>
                <th>Eksik / beklenen aksiyonlar</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((area) => (
                <tr key={area.key}>
                  <td>
                    <strong>{area.label}</strong>
                    <br />
                    <small>{area.description}</small>
                  </td>
                  <td>{area.risk}</td>
                  <td><span className={`status-pill ${coverageTone(area.status)}`}>{statusLabel(area.status)}</span></td>
                  <td>{area.coveredActions}/{area.expectedActions}</td>
                  <td>{area.actions.map((action) => `${action.action}: ${action.count}`).join(' / ')}</td>
                </tr>
              ))}
              {!coverage.length && !isLoading && (
                <tr><td colSpan="5">Coverage bilgisi bulunamadi.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="erp-panel auth-admin-audit-panel">
        <div className="panel-title">
          <strong>Audit kayitlari</strong>
          <span>{logs.length} kayit / kaynak {meta.source || 'audit-api'}</span>
        </div>
        <div className="table-shell auth-admin-audit-table-shell">
          <table className="erp-table auth-admin-audit-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Kullanici</th>
                <th>Aksiyon</th>
                <th>Varlik</th>
                <th>Kaynak</th>
                <th>Snapshot</th>
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
                  <td>{log.hasBeforeSnapshot ? 'Once ' : ''}{log.hasAfterSnapshot ? 'Sonra' : ''}</td>
                  <td>{log.reason || '-'}</td>
                </tr>
              ))}
              {!logs.length && !isLoading && (
                <tr><td colSpan="7">Filtreye uygun audit kaydi yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
