import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { TerminalButton } from '../components/TerminalButton';
import { getActiveApiBaseUrl, getRuntimeSettings, resetRuntimeSettings, saveRuntimeSettings, terminalConfig } from '../config/env';
import { pingApi } from '../services/apiClient';
import { getCacheSummary } from '../services/cacheService';
import { getQueueSummary } from '../services/queueService';
import { colors, terminalStyles } from '../styles/theme';

function formatDate(value) {
  if (!value) return 'Yok';

  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return String(value);
  }
}

function StatusBadge({ label, tone = 'muted' }) {
  return (
    <View style={[styles.badge, styles[`badge_${tone}`]]}>
      <Text style={[styles.badgeText, styles[`badgeText_${tone}`]]}>{label}</Text>
    </View>
  );
}

function InfoTile({ label, value, tone = 'neutral' }) {
  return (
    <View style={[styles.infoTile, styles[`infoTile_${tone}`]]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function SettingsScreen({ navigation, onRefresh }) {
  const [apiBaseUrl, setApiBaseUrl] = useState(terminalConfig.apiBaseUrl);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState({ online: false, message: 'Kontrol edilmedi' });
  const [cache, setCache] = useState({
    productCount: 0,
    customerCount: 0,
    productCachedAt: null,
    customerCachedAt: null,
    productCachedCount: null,
    customerCachedCount: null,
  });
  const [queue, setQueue] = useState({
    pendingCount: 0,
    failedCount: 0,
    syncedCount: 0,
    duplicateCount: 0,
    nonSaleCount: 0,
    salePendingCount: 0,
    saleFailedCount: 0,
    saleDuplicateCount: 0,
    totalCount: 0,
    lastSyncAt: null,
  });

  useEffect(() => {
    async function load() {
      const settings = await getRuntimeSettings();
      const activeUrl = await getActiveApiBaseUrl();
      setApiBaseUrl(settings.apiBaseUrl || activeUrl);
      await refreshDiagnostics(false);
    }

    load();
  }, []);

  async function refreshDiagnostics(showMessage = true) {
    setLoading(true);
    if (showMessage) {
      setMessage('');
      setError('');
    }

    try {
      const [apiResult, cacheSummary, queueSummary] = await Promise.all([
        pingApi(),
        getCacheSummary(),
        getQueueSummary(),
      ]);

      setHealth(apiResult);
      setCache(cacheSummary);
      setQueue(queueSummary);

      if (showMessage) {
        setMessage('Terminal durumu yenilendi');
      }
    } catch (diagnosticError) {
      setError(diagnosticError.message || 'Terminal durumu okunamadi');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const saved = await saveRuntimeSettings({ apiBaseUrl });
      setApiBaseUrl(saved.apiBaseUrl);
      setMessage('API adresi kaydedildi');
      await refreshDiagnostics(false);
      await onRefresh();
    } catch (saveError) {
      setError(saveError.message || 'Ayar kaydedilemedi');
    } finally {
      setLoading(false);
    }
  }

  async function testConnection() {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await saveRuntimeSettings({ apiBaseUrl });
      const result = await pingApi();
      setHealth(result);
      if (result.online) {
        setMessage('API baglantisi basarili');
      } else {
        setError(result.message || 'API baglantisi yok');
      }
      await refreshDiagnostics(false);
      await onRefresh();
    } catch (testError) {
      setError(testError.message || 'API testi basarisiz');
    } finally {
      setLoading(false);
    }
  }

  async function reset() {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await resetRuntimeSettings();
      setApiBaseUrl(terminalConfig.apiBaseUrl);
      setMessage('Varsayilan API adresine donuldu');
      await refreshDiagnostics(false);
      await onRefresh();
    } catch (resetError) {
      setError(resetError.message || 'Ayar sifirlanamadi');
    } finally {
      setLoading(false);
    }
  }

  const hasCache = cache.productCount > 0 && cache.customerCount > 0;
  const hasBlockingQueue = queue.saleFailedCount > 0 || queue.failedCount > 0;
  const ready = health.online && hasCache && !hasBlockingQueue;
  const readyTone = ready ? 'success' : health.online ? 'warning' : 'danger';
  const readyLabel = ready ? 'Sahaya hazir' : health.online ? 'Kontrol gerekli' : 'API kapali';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.readyPanel, styles[`readyPanel_${readyTone}`], terminalStyles.shadow]}>
        <View style={styles.readyHeader}>
          <View>
            <Text style={styles.readyTitle}>Terminal Hazirlik</Text>
            <Text style={styles.readySubtitle}>API, cache ve offline kuyruk tek ekranda.</Text>
          </View>
          <StatusBadge label={readyLabel} tone={readyTone} />
        </View>

        <View style={styles.tileGrid}>
          <InfoTile label="API" value={health.online ? 'Online' : 'Offline'} tone={health.online ? 'success' : 'danger'} />
          <InfoTile label="Urun cache" value={String(cache.productCount || 0)} tone={cache.productCount > 0 ? 'success' : 'warning'} />
          <InfoTile label="Cari cache" value={String(cache.customerCount || 0)} tone={cache.customerCount > 0 ? 'success' : 'warning'} />
          <InfoTile label="Hata" value={String(queue.saleFailedCount || queue.failedCount || 0)} tone={hasBlockingQueue ? 'danger' : 'success'} />
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>API Baglantisi</Text>
        <Text style={styles.meta}>Telefon ayni Wi-Fi agindaysa PC IP adresini kullanin.</Text>

        <Text style={styles.label}>API adresi</Text>
        <TextInput
          value={apiBaseUrl}
          onChangeText={setApiBaseUrl}
          style={styles.input}
          placeholder="http://192.168.1.47:4100"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.help}>/api yazsaniz bile uygulama tekrar /api/api yapmaz.</Text>
      </View>

      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <Text style={styles.title}>Canli Durum</Text>
          <StatusBadge label={health.message || 'Kontrol edilmedi'} tone={health.online ? 'success' : 'danger'} />
        </View>
        <InfoRow label="Aktif API" value={apiBaseUrl || terminalConfig.apiBaseUrl} />
        <InfoRow label="Son urun indirme" value={formatDate(cache.productCachedAt)} />
        <InfoRow label="Son cari indirme" value={formatDate(cache.customerCachedAt)} />
        <InfoRow label="Son sync" value={formatDate(queue.lastSyncAt)} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Offline Kuyruk</Text>
        <View style={styles.tileGrid}>
          <InfoTile label="Bekleyen" value={String(queue.salePendingCount || queue.pendingCount || 0)} tone={(queue.salePendingCount || queue.pendingCount) > 0 ? 'warning' : 'success'} />
          <InfoTile label="Gonderilen" value={String(queue.syncedCount || 0)} tone="success" />
          <InfoTile label="Duplicate" value={String(queue.saleDuplicateCount || queue.duplicateCount || 0)} tone="neutral" />
          <InfoTile label="Test/Eski" value={String(queue.nonSaleCount || 0)} tone={(queue.nonSaleCount || 0) > 0 ? 'warning' : 'neutral'} />
        </View>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.accentDark} /> : null}

      <TerminalButton label="Kaydet" onPress={save} disabled={loading} />
      <TerminalButton label="Baglantiyi Test Et" onPress={testConnection} disabled={loading} variant="secondary" />
      <TerminalButton label="Durumu Yenile" onPress={() => refreshDiagnostics()} disabled={loading} variant="secondary" />
      <TerminalButton label="Varsayilana Don" onPress={reset} disabled={loading} variant="secondary" />
      <TerminalButton label="Ana ekran" onPress={navigation.goHome} variant="secondary" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 12,
    gap: 10,
  },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  readyPanel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  readyPanel_success: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  readyPanel_warning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
  },
  readyPanel_danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  readyHeader: {
    gap: 8,
  },
  readyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  readySubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  sectionHeader: {
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  input: {
    minHeight: 56,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    paddingHorizontal: 10,
  },
  help: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoTile: {
    minWidth: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  infoTile_neutral: {
    backgroundColor: colors.white,
    borderColor: colors.border,
  },
  infoTile_success: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  infoTile_warning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
  },
  infoTile_danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  infoValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  infoRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: 8,
    gap: 3,
  },
  rowLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  rowValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badge_success: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  badge_warning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
  },
  badge_danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  badge_muted: {
    backgroundColor: colors.white,
    borderColor: colors.border,
  },
  badgeText_success: {
    color: colors.success,
  },
  badgeText_warning: {
    color: colors.warning,
  },
  badgeText_danger: {
    color: colors.danger,
  },
  badgeText_muted: {
    color: colors.muted,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  message: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '900',
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '900',
  },
});
