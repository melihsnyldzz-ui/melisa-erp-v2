import React, { useEffect, useMemo, useState } from 'react';
import { fetchTerminalAdminOverview } from '../../services/terminalAdminApi.js';
import { exportRowsToCsv, exportRowsToExcel, printRowsReport } from '../../utils/exportUtils.js';

function formatDate(value) {
  return value ? new Date(value).toLocaleString('tr-TR') : '-';
}

function formatMoney(value) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function statusLabel(status) {
  const labels = {
    online: 'Online',
    offline: 'Offline',
    unknown: 'Bilinmiyor',
    pending: 'Bekleyen',
    processing: 'Isleniyor',
    synced: 'Gonderildi',
    failed: 'Hatali',
  };
  return labels[status] || status || '-';
}

function statusClass(status) {
  if (status === 'online' || status === 'synced') return 'status-finalized';
  if (status === 'failed' || status === 'offline') return 'status-cancelled';
  if (status === 'pending' || status === 'processing') return 'status-draft';
  return '';
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

const queueColumns = [
  { label: 'Cihaz', key: 'deviceCode' },
  { label: 'Cihaz Adi', key: 'deviceName' },
  { label: 'Kullanici', key: 'username' },
  { label: 'Event', key: 'eventType' },
  { label: 'Client Request', key: 'clientRequestId' },
  { label: 'Durum', value: (row) => statusLabel(row.status) },
  { label: 'Retry', key: 'retryCount' },
  { label: 'Hata', key: 'lastError' },
  { label: 'Alinma', value: (row) => formatDate(row.receivedAt) },
  { label: 'Islenme', value: (row) => formatDate(row.processedAt) },
];

export function TerminalAdminScreen() {
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    dateFrom: '',
    dateTo: '',
    deviceId: '',
  });
  const [data, setData] = useState({ summary: {}, devices: [], queue: [] });
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const selectedDevice = useMemo(
    () => data.devices.find((device) => device.id === selectedDeviceId) || data.devices[0] || null,
    [data.devices, selectedDeviceId],
  );

  const visibleQueue = useMemo(() => {
    if (!selectedDevice || filters.deviceId) {
      return data.queue;
    }
    return data.queue.filter((row) => row.deviceId === selectedDevice.id);
  }, [data.queue, filters.deviceId, selectedDevice]);

  async function loadTerminalData(nextFilters = filters) {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await fetchTerminalAdminOverview(nextFilters);
      const nextData = response.data || { summary: {}, devices: [], queue: [] };
      setData(nextData);
      setSelectedDeviceId((current) => (
        nextData.devices.some((device) => device.id === current) ? current : nextData.devices[0]?.id ?? null
      ));
    } catch (error) {
      setData({ summary: {}, devices: [], queue: [] });
      setErrorMessage(`${error.message || 'Terminal verisi okunamadi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTerminalData();
  }, []);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(event) {
    event.preventDefault();
    loadTerminalData(filters);
  }

  function resetFilters() {
    const nextFilters = { status: '', search: '', dateFrom: '', dateTo: '', deviceId: '' };
    setFilters(nextFilters);
    loadTerminalData(nextFilters);
  }

  function exportQueueCsv() {
    exportRowsToCsv({
      filename: 'terminal-sync-kuyrugu',
      rows: visibleQueue,
      columns: queueColumns,
    });
  }

  function exportQueueExcel() {
    exportRowsToExcel({
      filename: 'terminal-sync-kuyrugu',
      title: 'Terminal Sync Kuyrugu',
      rows: visibleQueue,
      columns: queueColumns,
    });
  }

  function printQueue() {
    printRowsReport({
      title: 'Terminal Yonetimi',
      subtitle: `Satir: ${visibleQueue.length}`,
      rows: visibleQueue,
      columns: queueColumns,
    });
  }

  const summary = data.summary || {};

  return (
    <main className="work-area dashboard-screen terminal-admin-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Terminal Yonetimi</strong>
          <span>Android cihazlar, offline queue, sync loglari ve hatali gonderimler</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={exportQueueCsv} disabled={!visibleQueue.length}>CSV</button>
          <button type="button" onClick={exportQueueExcel} disabled={!visibleQueue.length}>Excel</button>
          <button type="button" onClick={printQueue} disabled={!visibleQueue.length}>Yazdir/PDF</button>
          <button type="button" onClick={() => loadTerminalData()}>Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Terminal verisi API'den okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <section className="dashboard-kpi-grid">
        <Kpi label="Cihaz" value={summary.deviceCount || 0} detail={`${summary.activeDeviceCount || 0} aktif`} tone="info" />
        <Kpi label="Offline" value={summary.offlineDeviceCount || 0} detail="Offline isaretli cihaz" tone={summary.offlineDeviceCount ? 'warn' : 'good'} />
        <Kpi label="Bekleyen" value={summary.pendingSyncCount || 0} detail="Terminal queue pending" tone={summary.pendingSyncCount ? 'warn' : 'good'} />
        <Kpi label="Hatali" value={summary.failedSyncCount || 0} detail="Failed sync kaydi" tone={summary.failedSyncCount ? 'danger' : 'good'} />
        <Kpi label="Gonderilen" value={summary.syncedSyncCount || 0} detail="Basarili sync" tone="good" />
        <Kpi label="Son islem" value={formatDate(summary.lastQueueAt)} detail="Queue'a gelen son kayit" tone="info" />
      </section>

      <section className="split-grid">
        <section className="erp-panel">
          <div className="panel-title">
            <strong>Terminal Cihazlari</strong>
            <span>{data.devices.length} cihaz</span>
          </div>
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Cihaz</th>
                  <th>Kullanici</th>
                  <th>Durum</th>
                  <th>Bekleyen</th>
                  <th>Hatali</th>
                  <th>Son Gorulme</th>
                </tr>
              </thead>
              <tbody>
                {data.devices.map((device) => (
                  <tr key={device.id} className={device.id === selectedDevice?.id ? 'selected-row' : ''} onClick={() => setSelectedDeviceId(device.id)}>
                    <td>{device.deviceCode} / {device.deviceName}</td>
                    <td>{device.assignedUser}</td>
                    <td><span className={`status-pill ${statusClass(device.status)}`}>{statusLabel(device.status)}</span></td>
                    <td>{device.pendingCount}</td>
                    <td>{device.failedCount}</td>
                    <td>{formatDate(device.lastSeenAt)}</td>
                  </tr>
                ))}
                {!isLoading && data.devices.length === 0 && (
                  <tr><td colSpan="6">Terminal cihaz kaydi yok.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="erp-panel">
          <div className="panel-title">
            <strong>Cihaz Detayi</strong>
            <span>{selectedDevice?.deviceCode || 'Cihaz secin'}</span>
          </div>
          {selectedDevice ? (
            <div className="filter-grid">
              <label>Cihaz Kodu<input value={selectedDevice.deviceCode} disabled /></label>
              <label>Cihaz Adi<input value={selectedDevice.deviceName} disabled /></label>
              <label>Kullanici<input value={selectedDevice.assignedUser} disabled /></label>
              <label>Aktif<input value={selectedDevice.isActive ? 'Evet' : 'Hayir'} disabled /></label>
              <label>Son Sync<input value={formatDate(selectedDevice.lastSyncAt)} disabled /></label>
              <label>Son Gorulme<input value={formatDate(selectedDevice.lastSeenAt)} disabled /></label>
              <label>Bekleyen<input value={selectedDevice.pendingCount} disabled /></label>
              <label>Hatali<input value={selectedDevice.failedCount} disabled /></label>
              <label>Satis<input value={`${selectedDevice.saleCount} fis / ${formatMoney(selectedDevice.saleTotal)}`} disabled /></label>
            </div>
          ) : <div className="list-state">Cihaz kaydi yok.</div>}
        </section>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Offline Queue / Sync Loglari</strong>
          <span>{data.queue.length} satir / Gosterilen: {visibleQueue.length}</span>
        </div>
        <form className="filter-grid" onSubmit={applyFilters}>
          <label>
            Arama
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Cihaz, kullanici, event, request id" />
          </label>
          <label>
            Durum
            <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="">Tum durumlar</option>
              <option value="pending">Bekleyen</option>
              <option value="processing">Isleniyor</option>
              <option value="synced">Gonderildi</option>
              <option value="failed">Hatali</option>
            </select>
          </label>
          <label>
            Cihaz
            <select value={filters.deviceId} onChange={(event) => updateFilter('deviceId', event.target.value)}>
              <option value="">Tum cihazlar</option>
              {data.devices.map((device) => (
                <option key={device.id} value={device.id}>{device.deviceCode} / {device.deviceName}</option>
              ))}
            </select>
          </label>
          <label>
            Baslangic
            <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
          </label>
          <label>
            Bitis
            <input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} />
          </label>
          <button type="submit" className="primary">Filtrele</button>
          <button type="button" className="ghost-button" onClick={resetFilters}>Temizle</button>
        </form>
        <div className="table-shell">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Cihaz</th>
                <th>Kullanici</th>
                <th>Event</th>
                <th>Durum</th>
                <th>Retry</th>
                <th>Hata</th>
                <th>Hedef</th>
              </tr>
            </thead>
            <tbody>
              {visibleQueue.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.receivedAt)}</td>
                  <td>{row.deviceCode}</td>
                  <td>{row.username}</td>
                  <td>{row.eventType}</td>
                  <td><span className={`status-pill ${statusClass(row.status)}`}>{statusLabel(row.status)}</span></td>
                  <td>{row.retryCount}</td>
                  <td className={row.lastError ? 'ledger-credit' : ''}>{row.lastError || '-'}</td>
                  <td>{row.targetEntity ? `${row.targetEntity} #${row.targetEntityId || '-'}` : '-'}</td>
                </tr>
              ))}
              {!isLoading && visibleQueue.length === 0 && (
                <tr><td colSpan="8">Sync kaydi bulunamadi.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
