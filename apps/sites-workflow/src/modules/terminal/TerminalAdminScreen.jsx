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
    online: 'Çevrimiçi',
    offline: 'Çevrimdışı',
    unknown: 'Bilinmiyor',
    pending: 'Bekleyen',
    processing: 'İşleniyor',
    synced: 'Gönderildi',
    failed: 'Hatalı',
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
  { label: 'Cihaz Adı', key: 'deviceName' },
  { label: 'Kullanıcı', key: 'username' },
  { label: 'İşlem Türü', key: 'eventType' },
  { label: 'İstemci İstek No', key: 'clientRequestId' },
  { label: 'Durum', value: (row) => statusLabel(row.status) },
  { label: 'Tekrar Deneme', key: 'retryCount' },
  { label: 'Hata', key: 'lastError' },
  { label: 'Alınma', value: (row) => formatDate(row.receivedAt) },
  { label: 'İşlenme', value: (row) => formatDate(row.processedAt) },
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
      setErrorMessage(`${error.message || 'Terminal verisi okunamadı.'} (${error.code || 'API_ERROR'})`);
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
      title: 'Terminal Eşitleme Kuyruğu',
      rows: visibleQueue,
      columns: queueColumns,
    });
  }

  function printQueue() {
    printRowsReport({
      title: 'Terminal Yönetimi',
      subtitle: `Satır: ${visibleQueue.length}`,
      rows: visibleQueue,
      columns: queueColumns,
    });
  }

  const summary = data.summary || {};

  return (
    <main className="work-area dashboard-screen terminal-admin-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Terminal Yönetimi</strong>
          <span>Android cihazlar, çevrimdışı kuyruk, eşitleme kayıtları ve hatalı gönderimler</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={exportQueueCsv} disabled={!visibleQueue.length}>CSV</button>
          <button type="button" onClick={exportQueueExcel} disabled={!visibleQueue.length}>Excel</button>
          <button type="button" onClick={printQueue} disabled={!visibleQueue.length}>Yazdır/PDF</button>
          <button type="button" onClick={() => loadTerminalData()}>Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Terminal verisi sunucudan okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
      <div className="list-state">
        Salt okunur ekran: Terminal cihazlarını ve eşitleme kuyruğunu gösterir; cihaz kapatma, kuyruk silme, yeniden gönderme veya veritabanı düzeltme işlemi yapmaz.
      </div>

      <section className="dashboard-kpi-grid">
        <Kpi label="Cihaz" value={summary.deviceCount || 0} detail={`${summary.activeDeviceCount || 0} aktif`} tone="info" />
        <Kpi label="Çevrimdışı" value={summary.offlineDeviceCount || 0} detail="Çevrimdışı işaretli cihaz" tone={summary.offlineDeviceCount ? 'warn' : 'good'} />
        <Kpi label="Bekleyen" value={summary.pendingSyncCount || 0} detail="Kuyrukta bekleyen kayıt" tone={summary.pendingSyncCount ? 'warn' : 'good'} />
        <Kpi label="Hatalı" value={summary.failedSyncCount || 0} detail="Başarısız eşitleme kaydı" tone={summary.failedSyncCount ? 'danger' : 'good'} />
        <Kpi label="Gönderilen" value={summary.syncedSyncCount || 0} detail="Başarılı eşitleme" tone="good" />
        <Kpi label="Son işlem" value={formatDate(summary.lastQueueAt)} detail="Kuyruğa gelen son kayıt" tone="info" />
      </section>

      <section className="split-grid">
        <section className="erp-panel">
          <div className="panel-title">
            <strong>Terminal Cihazları</strong>
            <span>{data.devices.length} cihaz</span>
          </div>
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Cihaz</th>
                  <th>Kullanıcı</th>
                  <th>Durum</th>
                  <th>Bekleyen</th>
                  <th>Hatalı</th>
                  <th>Son Görülme</th>
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
                  <tr><td colSpan="6">Terminal cihaz kaydı yok.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="erp-panel">
          <div className="panel-title">
            <strong>Cihaz Detayı</strong>
            <span>{selectedDevice?.deviceCode || 'Cihaz seçin'}</span>
          </div>
          {selectedDevice ? (
            <div className="filter-grid">
              <label>Cihaz Kodu<input value={selectedDevice.deviceCode} disabled /></label>
              <label>Cihaz Adı<input value={selectedDevice.deviceName} disabled /></label>
              <label>Kullanıcı<input value={selectedDevice.assignedUser} disabled /></label>
              <label>Aktif<input value={selectedDevice.isActive ? 'Evet' : 'Hayır'} disabled /></label>
              <label>Son Eşitleme<input value={formatDate(selectedDevice.lastSyncAt)} disabled /></label>
              <label>Son Görülme<input value={formatDate(selectedDevice.lastSeenAt)} disabled /></label>
              <label>Bekleyen<input value={selectedDevice.pendingCount} disabled /></label>
              <label>Hatalı<input value={selectedDevice.failedCount} disabled /></label>
              <label>Satış<input value={`${selectedDevice.saleCount} fiş / ${formatMoney(selectedDevice.saleTotal)}`} disabled /></label>
            </div>
          ) : <div className="list-state">Cihaz kaydı yok.</div>}
        </section>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Çevrimdışı Kuyruk / Eşitleme Kayıtları</strong>
          <span>{data.queue.length} satır / Gösterilen: {visibleQueue.length}</span>
        </div>
        <div className="list-state">
          Başarısız kayıtlar operatörün incelemesi içindir; bu ekrandan doğrudan SQL silme veya kuyruk temizleme işlemi yapılmaz.
        </div>
        <form className="filter-grid" onSubmit={applyFilters}>
          <label>
            Arama
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Cihaz, kullanıcı, işlem türü veya istek numarası" />
          </label>
          <label>
            Durum
            <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="">Tüm durumlar</option>
              <option value="pending">Bekleyen</option>
              <option value="processing">İşleniyor</option>
              <option value="synced">Gönderildi</option>
              <option value="failed">Hatalı</option>
            </select>
          </label>
          <label>
            Cihaz
            <select value={filters.deviceId} onChange={(event) => updateFilter('deviceId', event.target.value)}>
              <option value="">Tüm cihazlar</option>
              {data.devices.map((device) => (
                <option key={device.id} value={device.id}>{device.deviceCode} / {device.deviceName}</option>
              ))}
            </select>
          </label>
          <label>
            Başlangıç
            <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
          </label>
          <label>
            Bitiş
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
                <th>Kullanıcı</th>
                <th>İşlem Türü</th>
                <th>Durum</th>
                <th>Tekrar</th>
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
                <tr><td colSpan="8">Eşitleme kaydı bulunamadı.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
