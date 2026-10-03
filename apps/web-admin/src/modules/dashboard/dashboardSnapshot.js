// Independent reads keep a missing warning feed from hiding the daily summary.
export async function readDashboardSnapshot(fetchSummary, fetchAlerts) {
  const [summaryResult, alertsResult] = await Promise.allSettled([
    Promise.resolve().then(fetchSummary),
    Promise.resolve().then(fetchAlerts),
  ]);
  const summary = summaryResult.status === 'fulfilled' && summaryResult.value?.success !== false ? summaryResult.value?.data : null;
  const alerts = alertsResult.status === 'fulfilled' && alertsResult.value?.success !== false ? alertsResult.value?.data : null;
  const summaryValid = summary != null && typeof summary === 'object' && !Array.isArray(summary);
  const alertsValid = Array.isArray(alerts);
  return {
    summary: summaryValid ? summary : null,
    alerts: alertsValid ? alerts : null,
    summaryError: summaryValid ? '' : 'Günlük özet güncellenemedi. Yenile ile tekrar kontrol edin.',
    alertsError: alertsValid ? '' : 'Uyarılar okunamadı; uyarı bulunmadığı doğrulanamadı.',
  };
}
