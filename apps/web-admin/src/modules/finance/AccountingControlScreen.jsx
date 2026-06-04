import React, { useEffect, useMemo, useState } from 'react';
import { applyDocumentNumberFix, fetchAccountingControl } from '../../services/financeApi.js';

function formatMoney(value, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function toneForSeverity(severity) {
  if (severity === 'danger') return 'danger';
  if (severity === 'warning') return 'warn';
  return 'good';
}

function statusText(status) {
  if (status === 'RISK') return 'Kırmızı';
  if (status === 'WARN') return 'Sarı';
  return 'Yeşil';
}

export function AccountingControlScreen({ onOpenScreen }) {
  const [data, setData] = useState({ summary: {}, issues: [], checks: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isFixingDocumentNo, setIsFixingDocumentNo] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [maintenanceMessage, setMaintenanceMessage] = useState('');

  async function loadControl() {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await fetchAccountingControl();
      setData(response.data || null);
    } catch (error) {
      setData({ summary: {}, issues: [], checks: [] });
      setErrorMessage(`${error.message || 'Muhasebe kontrol verisi okunamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  async function fixDocumentNumbers() {
    setIsFixingDocumentNo(true);
    setErrorMessage('');
    setMaintenanceMessage('');
    try {
      const response = await applyDocumentNumberFix();
      const fixedCount = response.data.fixedCount || 0;
      setMaintenanceMessage(fixedCount > 0
         ? `${fixedCount} kesin fiş belge numarası düzeltildi.`
        : 'D?zeltilecek Taslak belge no kalmadi.');
      await loadControl();
    } catch (error) {
      setErrorMessage(`${error.message || 'Belge no düzeltme çalışmadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsFixingDocumentNo(false);
    }
  }

  useEffect(() => {
    loadControl();
  }, []);

  const issuesBySeverity = useMemo(() => ({
    danger: (data.issues || []).filter((issue) => issue.severity === 'danger'),
    warning: (data.issues || []).filter((issue) => issue.severity === 'warning'),
  }), [data]);

  function openIssue(issue) {
    if (issue.actionScreen) {
      onOpenScreen?.(issue.actionScreen, issue.actionPayload || {});
    }
  }

  function openCheck(check) {
    if (check.actionScreen) {
      onOpenScreen?.(check.actionScreen);
    }
  }

  const summary = data.summary || {};

  return (
    <main className="work-area dashboard-screen accounting-control-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Muhasebe Kontrol Paneli</strong>
          <span>Borç/alacak, kasa/banka, belge no ve hesap standardı son kontrol ekranı</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={loadControl}>Yenile</button>
          <button type="button" onClick={fixDocumentNumbers} disabled={isFixingDocumentNo}>
            {isFixingDocumentNo ? 'D?zeltiliyor...' : 'Belge No D?zelt'}
          </button>
          <button type="button" onClick={() => onOpenScreen?.('accounting-journal')}>Muhasebe Defteri</button>
          <button type="button" onClick={() => onOpenScreen?.('cash-bank-ledger')}>Kasa/Banka</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Kontrol paneli canlı SQL'den okunuyor...</div>}
      {maintenanceMessage && <div className="list-state list-state-success">{maintenanceMessage}</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <section className="dashboard-kpi-grid">
        <article className={`dashboard-kpi ${summary.status === 'RISK' ? 'danger' : summary.status === 'WARN' ? 'warn' : 'good'}`}>
          <span>Genel Durum</span>
          <strong>{statusText(summary.status)}</strong>
          <small>Sağlık puanı %{summary.healthScore ?? 0}</small>
        </article>
        <article className="dashboard-kpi danger">
          <span>Kırmızı Risk</span>
          <strong>{summary.dangerCount || 0}</strong>
          <small>Hemen kontrol edilecek alan</small>
        </article>
        <article className="dashboard-kpi warn">
          <span>Sarı Uyarı</span>
          <strong>{summary.warningCount || 0}</strong>
          <small>Takip ve temizlik alanı</small>
        </article>
        <article className={`dashboard-kpi ${summary.journalBalanced ? 'good' : 'danger'}`}>
          <span>Yevmiye Dengesi</span>
          <strong>{summary.journalBalanced ? 'Dengeli' : 'Fark Var'}</strong>
          <small>Fark: {formatMoney(summary.journalDifference || 0)}</small>
        </article>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Kontrol Kartları</strong>
          <span>Yeşil çalışır, sarı takip, kırmızı müdahale ister</span>
        </div>
        <div className="accounting-control-grid">
          {(data.checks || []).map((check) => (
            <button className={`accounting-control-card ${toneForSeverity(check.severity)}`} key={check.id} type="button" onClick={() => openCheck(check)}>
              <span>{statusText(check.status)}</span>
              <strong>{check.title}</strong>
              <em>{check.metric}</em>
              <small>{check.message}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="erp-panel accounting-risk-panel">
        <div className="panel-title">
          <strong>Kırmızı Riskler</strong>
          <span>{issuesBySeverity.danger.length} satır / işlem öncesi kontrol edin</span>
        </div>
        {issuesBySeverity.danger.length === 0 && <div className="list-state list-state-success">Kırmızı muhasebe riski görünmüyor.</div>}
        {issuesBySeverity.danger.length > 0 && (
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Risk</th>
                  <th>Kod</th>
                  <th>Ad</th>
                  <th>Tutar</th>
                  <th>PB</th>
                  <th>Git</th>
                </tr>
              </thead>
              <tbody>
                {issuesBySeverity.danger.map((issue) => (
                  <tr className="clickable-row danger-row" key={`${issue.type}-${issue.entityId}`} onClick={() => openIssue(issue)}>
                    <td>{issue.message}</td>
                    <td>{issue.entityCode}</td>
                    <td>{issue.entityName}</td>
                    <td className="ledger-debit">{formatMoney(issue.amount, issue.currency || 'TRY')}</td>
                    <td>{issue.currency || '-'}</td>
                    <td><button className="mini-button" type="button" onClick={(event) => { event.stopPropagation(); openIssue(issue); }}>Aç</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Sarı Uyarılar</strong>
          <span>Temizlik veya takip gerektiren izler</span>
        </div>
        {issuesBySeverity.warning.length === 0 && (summary.warningCount || 0) === 0 && <div className="list-state list-state-success">Sarı uyarı yok.</div>}
        {(summary.activeDuplicateCount > 0 || summary.standardizationCandidateCount > 0) && (
          <div className="list-state list-state-warning">
            Finans hesap standardında takip var: {summary.activeDuplicateCount || 0} mükerrer / {summary.standardizationCandidateCount || 0} aktarım adayı.
          </div>
        )}
        {issuesBySeverity.warning.map((issue) => (
          <button className="list-state list-state-warning accounting-warning-row" key={`${issue.type}-${issue.entityId}`} type="button" onClick={() => openIssue(issue)}>
            {issue.message}: {issue.entityCode} / {issue.entityName}
          </button>
        ))}
      </section>
    </main>
  );
}
