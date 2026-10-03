import React, { useEffect, useMemo, useState } from 'react';
import { fetchMonitoringSummary } from '../../services/monitoringApi.js';

function formatDate(value) {
  return value ? new Date(value).toLocaleString('tr-TR') : '-';
}

function formatUptime(seconds) {
  const total = Number(seconds || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours > 0) return `${hours} sa ${minutes} dk`;
  return `${minutes} dk`;
}

function statusTone(value, dangerWhenPositive = false) {
  if (dangerWhenPositive) return Number(value || 0) > 0 ? 'danger' : 'good';
  return value ? 'good' : 'warn';
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

function ReadOnlyNotice() {
  return (
    <section className="erp-panel">
      <div className="panel-title">
        <strong>Read-only izleme kapsami</strong>
        <span>Operator gorunurlugu</span>
      </div>
      <div className="list-state list-state-success">
        Bu ekran sadece mevcut health, terminal sync ve audit ozetlerini okur. DB write, migration, reset, restore,
        cleanup, deploy veya WhatsApp gonderimi baslatmaz.
      </div>
    </section>
  );
}

export function OperationalHealthScreen() {
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadMonitoringSummary() {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await fetchMonitoringSummary();
      setData(response.data || {});
      setMeta(response.meta || {});
    } catch (error) {
      setData(null);
      setMeta({});
      setErrorMessage(`${error.message || 'Monitoring ozeti okunamadi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadMonitoringSummary();
  }, []);

  const auditEvents = data?.audit?.recentEvents || [];
  const anomalyNotes = data?.audit?.anomalyNotes || [];
  const riskRows = useMemo(() => ([
    {
      area: 'Terminal sync',
      metric: `${data?.terminal?.failedSyncCount || 0} failed / ${data?.terminal?.pendingSyncCount || 0} pending`,
      status: Number(data?.terminal?.failedSyncCount || 0) > 0 ? 'Kontrol gerekli' : 'Normal',
    },
    {
      area: 'Import failures',
      metric: `${data?.imports?.failedImportCount || 0} persisted failure`,
      status: data?.imports?.note || 'Persistent import failure metric available.',
    },
    {
      area: 'Finalize failures',
      metric: `${data?.finalize?.failedFinalizeCount || 0} persisted failure`,
      status: data?.finalize?.note || 'Persistent finalize failure metric available.',
    },
  ]), [data]);

  return (
    <main className="work-area dashboard-screen operational-health-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Operasyon Sagligi</strong>
          <span>API, SQL, terminal sync, import/finalize failure ve audit gorunurlugu</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={loadMonitoringSummary}>Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Monitoring ozeti API'den okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <section className="dashboard-kpi-grid">
        <Kpi label="API" value={data?.api ? 'OK' : '-'} detail={`Uptime: ${formatUptime(data?.api?.uptimeSeconds)}`} tone={statusTone(data?.api)} />
        <Kpi label="SQL" value={data?.db?.connectionStatus || '-'} detail={`Kontrol: ${formatDate(data?.db?.checkedAt)}`} tone={data?.db?.connectionStatus === 'ok' ? 'good' : 'danger'} />
        <Kpi label="Failed sync" value={data?.terminal?.failedSyncCount || 0} detail="Terminal queue failed" tone={statusTone(data?.terminal?.failedSyncCount, true)} />
        <Kpi label="Pending sync" value={data?.terminal?.pendingSyncCount || 0} detail="Pending + processing" tone={Number(data?.terminal?.pendingSyncCount || 0) > 0 ? 'warn' : 'good'} />
        <Kpi label="Import 24s" value={data?.imports?.importEventsLast24h || 0} detail="Audit event sayisi" tone="info" />
        <Kpi label="Finalize 24s" value={data?.finalize?.finalizeEventsLast24h || 0} detail="Audit event sayisi" tone="info" />
      </section>

      <ReadOnlyNotice />

      <section className="split-grid">
        <section className="erp-panel">
          <div className="panel-title">
            <strong>Failure gorunurlugu</strong>
            <span>Kalici metrik kapsami</span>
          </div>
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Alan</th>
                  <th>Metrik</th>
                  <th>Durum / Not</th>
                </tr>
              </thead>
              <tbody>
                {riskRows.map((row) => (
                  <tr key={row.area}>
                    <td>{row.area}</td>
                    <td>{row.metric}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="erp-panel">
          <div className="panel-title">
            <strong>Audit izleme notlari</strong>
            <span>{anomalyNotes.length} kontrol noktasi</span>
          </div>
          <ul className="dense-list">
            {anomalyNotes.map((note) => <li key={note}>{note}</li>)}
            {!anomalyNotes.length && <li>Audit izleme notu yok.</li>}
          </ul>
          <div className="list-state">
            Kaynak: {meta.source || 'monitoring-summary'} / Read-only: {meta.readOnly ? 'evet' : 'belirsiz'}
          </div>
        </section>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Son audit olaylari</strong>
          <span>Son 24 saat / ilk 10 kayit</span>
        </div>
        <div className="table-shell">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Aksiyon</th>
                <th>Entity</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.map((event, index) => (
                <tr key={`${event.created_at || 'event'}-${index}`}>
                  <td>{formatDate(event.created_at)}</td>
                  <td>{event.action || '-'}</td>
                  <td>{event.entity_type || '-'}</td>
                </tr>
              ))}
              {!isLoading && auditEvents.length === 0 && (
                <tr><td colSpan="3">Son 24 saatte audit olayi bulunamadi.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
