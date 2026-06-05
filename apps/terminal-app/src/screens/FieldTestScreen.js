import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { InfoRow } from '../components/InfoRow';
import { TerminalButton } from '../components/TerminalButton';
import { pingApi } from '../services/apiClient';
import { getCacheSummary } from '../services/cacheService';
import { getPendingQueue, syncPendingTerminalSales } from '../services/queueService';
import { colors } from '../styles/theme';

const fieldTestLogKey = 'terminalFieldTestLog';

const testItems = [
  {
    key: 'api',
    title: 'API baglantisi',
    note: 'API health endpointi cevap vermeli.',
  },
  {
    key: 'data',
    title: 'Veri cache kontrolu',
    note: 'Urun ve cari cache sayilari sahaya cikmadan dolu olmali.',
  },
  {
    key: 'customer',
    title: 'Pesin cari secimi',
    note: 'TRY/USD/EUR pesin cari veya gercek musteri secilmeli.',
  },
  {
    key: 'barcode',
    title: 'Barkod okutma',
    note: 'Barkod okutunca urun detayi ya API ya cache uzerinden gelmeli.',
  },
  {
    key: 'offline',
    title: 'Offline satis queue',
    note: 'Baglanti yokken tamamlanan satis bekleyen kuyruya alinmali.',
  },
  {
    key: 'sync',
    title: 'Tekrar online sync',
    note: 'Baglanti gelince bekleyenler gonderilmeli.',
  },
  {
    key: 'duplicate',
    title: 'Duplicate gonderim kontrolu',
    note: 'Ayni client event tekrar gonderilirse ikinci fis olusmamali.',
  },
];

async function readFieldTestLog() {
  const raw = await AsyncStorage.getItem(fieldTestLogKey);
  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function appendFieldTestLog(entry) {
  const current = await readFieldTestLog();
  const next = [
    {
      ...entry,
      createdAt: new Date().toISOString(),
    },
    ...current,
  ].slice(0, 20);

  await AsyncStorage.setItem(fieldTestLogKey, JSON.stringify(next));
  return next;
}

function formatDate(value) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return value;
  }
}

function statusText(status) {
  if (status === 'pass') return 'PASS';
  if (status === 'fail') return 'FAIL';
  if (status === 'running') return 'Kontrol';
  return 'Bekliyor';
}

function ResultCard({ label, value, tone = 'neutral' }) {
  return (
    <View style={[styles.resultCard, styles[`resultCard_${tone}`]]}>
      <Text style={styles.resultCardLabel}>{label}</Text>
      <Text style={styles.resultCardValue}>{value}</Text>
    </View>
  );
}

export function FieldTestScreen({ navigation, session, syncState, onRefresh }) {
  const [checked, setChecked] = useState({});
  const [results, setResults] = useState({});
  const [runningKey, setRunningKey] = useState('');
  const [note, setNote] = useState('');
  const [logEntries, setLogEntries] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const completedCount = useMemo(
    () => testItems.filter((item) => checked[item.key] || results[item.key]?.status === 'pass').length,
    [checked, results],
  );
  const failedCount = useMemo(
    () => Object.values(results).filter((result) => result.status === 'fail').length,
    [results],
  );
  const passCount = useMemo(
    () => Object.values(results).filter((result) => result.status === 'pass').length,
    [results],
  );
  const progressPercent = Math.round((completedCount / testItems.length) * 100);

  useEffect(() => {
    readFieldTestLog().then(setLogEntries);
  }, []);

  const toggle = (key) => {
    setChecked((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  function setResult(key, status, detail) {
    setResults((current) => ({
      ...current,
      [key]: {
        status,
        detail,
        checkedAt: new Date().toISOString(),
      },
    }));
    appendFieldTestLog({
      type: 'check',
      key,
      status,
      detail,
      online: syncState.online,
      pendingSales: syncState.salePendingCount || 0,
      failedSales: syncState.saleFailedCount || 0,
    }).then(setLogEntries);
  }

  async function saveNote() {
    const trimmedNote = note.trim();
    if (!trimmedNote) {
      setError('Kaydedilecek saha notu yazin.');
      return;
    }

    const nextLog = await appendFieldTestLog({
      type: 'note',
      key: 'field_note',
      status: 'note',
      detail: trimmedNote,
      online: syncState.online,
      pendingSales: syncState.salePendingCount || 0,
      failedSales: syncState.saleFailedCount || 0,
    });
    setLogEntries(nextLog);
    setNote('');
    setError('');
    setMessage('Saha notu local cihaza kaydedildi.');
  }

  async function runApiCheck() {
    setRunningKey('api');
    setMessage('');
    setError('');

    try {
      const result = await pingApi();
      setResult('api', result.online ? 'pass' : 'fail', result.message);
      setMessage(result.online ? 'API baglantisi OK' : result.message);
      await onRefresh();
    } catch (checkError) {
      setResult('api', 'fail', checkError.message || 'API kontrol edilemedi');
      setError(checkError.message || 'API kontrol edilemedi');
    } finally {
      setRunningKey('');
    }
  }

  async function runCacheCheck() {
    setRunningKey('data');
    setMessage('');
    setError('');

    try {
      const cache = await getCacheSummary();
      const productCount = Number(cache.productCount || 0);
      const customerCount = Number(cache.customerCount || 0);
      const ok = productCount > 0 && customerCount > 0;
      setResult('data', ok ? 'pass' : 'fail', `${productCount} urun / ${customerCount} cari`);
      setMessage(ok ? 'Cache sahaya cikis icin dolu' : 'Cache eksik, Veri Guncelle calistirin');
      await onRefresh();
    } catch (checkError) {
      setResult('data', 'fail', checkError.message || 'Cache okunamadi');
      setError(checkError.message || 'Cache okunamadi');
    } finally {
      setRunningKey('');
    }
  }

  async function runQueueCheck() {
    setRunningKey('offline');
    setMessage('');
    setError('');

    try {
      const queue = await getPendingQueue();
      const pendingSales = queue.filter((event) => (
        event.eventType === 'terminal_sale'
        && ['pending', 'retry_wait', 'failed', 'syncing'].includes(event.status)
      ));
      setResult('offline', 'pass', `${pendingSales.length} bekleyen/hatali satis`);
      setMessage(pendingSales.length ? 'Offline queue icinde satis kaydi var' : 'Offline queue temiz');
      await onRefresh();
    } catch (checkError) {
      setResult('offline', 'fail', checkError.message || 'Queue okunamadi');
      setError(checkError.message || 'Queue okunamadi');
    } finally {
      setRunningKey('');
    }
  }

  async function runSyncCheck() {
    setRunningKey('sync');
    setMessage('');
    setError('');

    try {
      const result = await syncPendingTerminalSales({ token: session.accessToken });
      const ok = result.failed === 0;
      setResult('sync', ok ? 'pass' : 'fail', `${result.synced} gonderildi / ${result.duplicate} duplicate / ${result.failed} hatali`);
      setMessage(ok ? 'Sync denemesi tamamlandi' : result.lastErrorMessage || 'Sync hatali kayit birakti');
      await onRefresh();
    } catch (checkError) {
      setResult('sync', 'fail', checkError.message || 'Sync kontrol edilemedi');
      setError(checkError.message || 'Sync kontrol edilemedi');
    } finally {
      setRunningKey('');
    }
  }

  async function runAllChecks() {
    setMessage('');
    setError('');
    await runApiCheck();
    await runCacheCheck();
    await runQueueCheck();
    await runSyncCheck();
    setMessage('Canli kontroller tamamlandi. Manuel adimlari saha testinde isaretleyin.');
  }

  function resetAll() {
    setChecked({});
    setResults({});
    setMessage('');
    setError('');
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.panelDark}>
        <Text style={styles.heroLabel}>Saha test durumu</Text>
        <Text style={styles.heroTitle}>{completedCount}/{testItems.length} adim</Text>
        <Text style={styles.heroText}>Bu ekran terminalin API, cache, offline queue ve sync hazirligini tek yerde kontrol eder.</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.progressText}>{progressPercent}% tamamlandi</Text>
      </View>

      <View style={styles.resultGrid}>
        <ResultCard label="Gecti" value={String(passCount)} tone="success" />
        <ResultCard label="Kaldi" value={String(failedCount)} tone={failedCount ? 'danger' : 'success'} />
        <ResultCard label="Manuel" value={String(completedCount - passCount)} tone="neutral" />
      </View>

      <View style={styles.statusPanel}>
        <InfoRow label="API" value={syncState.online ? 'Online' : 'Offline'} tone={syncState.online ? 'success' : 'danger'} />
        <InfoRow label="Bekleyen satis" value={String(syncState.salePendingCount || 0)} />
        <InfoRow label="Hatali satis" value={String(syncState.saleFailedCount || 0)} tone={syncState.saleFailedCount ? 'danger' : 'success'} />
        <InfoRow label="Duplicate" value={String(syncState.saleDuplicateCount || 0)} />
        <InfoRow label="Urun cache" value={String(syncState.productCount || 0)} />
        <InfoRow label="Cari cache" value={String(syncState.customerCount || 0)} />
      </View>

      <View style={styles.shortcutPanel}>
        <Text style={styles.actionTitle}>Saha adimlari</Text>
        <View style={styles.shortcutGrid}>
          <TerminalButton label="Veri Guncelle" onPress={navigation.openDataUpdate} variant="secondary" />
          <TerminalButton label="Barkod Testi" onPress={navigation.openBarcode} variant="secondary" />
          <TerminalButton label="Satis Testi" onPress={navigation.openNewSale} variant="secondary" />
          <TerminalButton label="Sync Merkezi" onPress={navigation.openSyncStatus} variant="secondary" />
        </View>
      </View>

      <View style={styles.actionPanel}>
        <Text style={styles.actionTitle}>Canli kontroller</Text>
        <TerminalButton label="Tum Kontrolleri Calistir" onPress={runAllChecks} disabled={Boolean(runningKey)} />
        <TerminalButton label="API test et" onPress={runApiCheck} disabled={Boolean(runningKey)} />
        <TerminalButton label="Cache kontrol et" onPress={runCacheCheck} disabled={Boolean(runningKey)} variant="secondary" />
        <TerminalButton label="Queue kontrol et" onPress={runQueueCheck} disabled={Boolean(runningKey)} variant="secondary" />
        <TerminalButton label="Sync dene" onPress={runSyncCheck} disabled={Boolean(runningKey)} variant="secondary" />
        {runningKey ? <ActivityIndicator color={colors.accentDark} /> : null}
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.notePanel}>
        <Text style={styles.actionTitle}>Saha notu</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Orn: Offline satis denendi, API geri gelince 1 fis gonderildi."
          placeholderTextColor={colors.muted}
          multiline
          style={styles.noteInput}
        />
        <TerminalButton label="Notu Kaydet" onPress={saveNote} variant="secondary" />
      </View>

      <View style={styles.checklist}>
        {testItems.map((item) => {
          const result = results[item.key];
          const isDone = Boolean(checked[item.key]) || result?.status === 'pass';
          const isFailed = result?.status === 'fail';
          const isLive = ['api', 'data', 'offline', 'sync'].includes(item.key);
          return (
            <Pressable
              key={item.key}
              onPress={() => toggle(item.key)}
              style={[styles.checkItem, isDone && styles.checkItemDone, isFailed && styles.checkItemFailed]}
            >
              <View style={[styles.checkBox, isDone && styles.checkBoxDone, isFailed && styles.checkBoxFailed]}>
                <Text style={styles.checkMark}>{isDone ? 'OK' : isFailed ? '!' : ''}</Text>
              </View>
              <View style={styles.checkText}>
                <View style={styles.checkTitleRow}>
                  <Text style={styles.checkTitle}>{item.title}</Text>
                  <Text style={[styles.modePill, isLive ? styles.modePillLive : styles.modePillManual]}>
                    {isLive ? 'Canli' : 'Manuel'}
                  </Text>
                </View>
                <Text style={styles.checkNote}>{item.note}</Text>
                {result ? (
                  <Text style={[styles.resultText, styles[`result${result.status}`]]}>
                    {statusText(result.status)} / {result.detail}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <TerminalButton label="Tumunu sifirla" onPress={resetAll} variant="secondary" />

      {logEntries.length ? (
        <View style={styles.logPanel}>
          <Text style={styles.actionTitle}>Son saha kayitlari</Text>
          {logEntries.slice(0, 6).map((entry, index) => (
            <View key={`${entry.createdAt}-${entry.key}-${index}`} style={styles.logRow}>
              <View style={styles.logHeader}>
                <Text style={[
                  styles.logStatus,
                  entry.status === 'fail' ? styles.logStatusFail : styles.logStatusPass,
                ]}
                >
                  {entry.status === 'note' ? 'NOT' : statusText(entry.status)}
                </Text>
                <Text style={styles.logDate}>{formatDate(entry.createdAt)}</Text>
              </View>
              <Text style={styles.logDetail}>{entry.detail}</Text>
              <Text style={styles.logMeta}>
                API {entry.online ? 'online' : 'offline'} / Bekleyen {entry.pendingSales || 0} / Hatali {entry.failedSales || 0}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <TerminalButton label="Ana ekran" onPress={navigation.goHome} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 12,
    paddingBottom: 104,
    gap: 10,
  },
  panelDark: {
    backgroundColor: colors.panelDark,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
  },
  heroLabel: {
    color: colors.headerSubtle,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.headerText,
    fontSize: 26,
    fontWeight: '900',
    marginTop: 4,
  },
  heroText: {
    color: colors.headerSubtle,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: 6,
  },
  progressTrack: {
    height: 10,
    overflow: 'hidden',
    backgroundColor: '#263244',
    borderRadius: 6,
    marginTop: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  progressText: {
    marginTop: 6,
    color: colors.headerText,
    fontSize: 12,
    fontWeight: '900',
  },
  statusPanel: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resultGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  resultCard: {
    flex: 1,
    minHeight: 70,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    justifyContent: 'center',
  },
  resultCard_success: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  resultCard_danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  resultCard_neutral: {
    backgroundColor: colors.white,
    borderColor: colors.border,
  },
  resultCardLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  resultCardValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 3,
  },
  actionPanel: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  shortcutPanel: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  shortcutGrid: {
    gap: 8,
  },
  notePanel: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  noteInput: {
    minHeight: 88,
    textAlignVertical: 'top',
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    padding: 10,
  },
  actionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  checklist: {
    gap: 8,
  },
  checkItem: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  checkItemDone: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  checkItemFailed: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  checkBox: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.borderDark,
    backgroundColor: colors.panel,
  },
  checkBoxDone: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  checkBoxFailed: {
    borderColor: colors.danger,
    backgroundColor: colors.danger,
  },
  checkMark: {
    color: colors.headerText,
    fontSize: 13,
    fontWeight: '900',
  },
  checkText: {
    flex: 1,
  },
  checkTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  checkTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  modePill: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 7,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  modePillLive: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
    color: colors.success,
  },
  modePillManual: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
    color: colors.warning,
  },
  checkNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    marginTop: 3,
  },
  resultText: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '900',
  },
  resultpass: {
    color: colors.success,
  },
  resultfail: {
    color: colors.danger,
  },
  resultrunning: {
    color: colors.warning,
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
  logPanel: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  logRow: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.panel,
    padding: 10,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  logStatus: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '900',
  },
  logStatusFail: {
    color: colors.danger,
  },
  logStatusPass: {
    color: colors.success,
  },
  logDate: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  logDetail: {
    marginTop: 5,
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  logMeta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
});
