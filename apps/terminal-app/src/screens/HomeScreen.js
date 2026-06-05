import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { TerminalButton } from '../components/TerminalButton';
import { terminalConfig } from '../config/env';
import { syncPendingTerminalSales } from '../services/queueService';
import { colors } from '../styles/theme';

function TaskCard({ title, subtitle, meta, tone = 'primary', onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.taskCard,
        styles[`taskCard_${tone}`],
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.taskText}>
        <Text style={[styles.taskTitle, tone === 'primary' && styles.taskTitlePrimary]}>{title}</Text>
        <Text style={[styles.taskSubtitle, tone === 'primary' && styles.taskSubtitlePrimary]}>{subtitle}</Text>
      </View>
      {meta ? <Text style={[styles.taskMeta, tone === 'primary' && styles.taskMetaPrimary]}>{meta}</Text> : null}
    </Pressable>
  );
}

export function HomeScreen({ session, syncState, navigation, onLogout, onRefresh }) {
  const pending = Number(syncState.salePendingCount || syncState.pendingCount || 0);
  const failed = Number(syncState.saleFailedCount || syncState.failedCount || 0);
  const products = Number(syncState.productCount || 0);
  const customers = Number(syncState.customerCount || 0);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const canQuickSync = syncState.online && pending > 0;

  async function quickSync() {
    setSyncing(true);
    setSyncMessage('');

    try {
      const result = await syncPendingTerminalSales({ token: session.accessToken });
      setSyncMessage(`${result.synced} gonderildi, ${result.duplicate} duplicate, ${result.failed} hatali`);
      await onRefresh();
    } catch (error) {
      setSyncMessage(error.message || 'Sync basarisiz');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.heroPanel}>
        <View style={styles.heroAccent} />
        <View style={styles.heroTextBlock}>
          <Text style={styles.heroLabel}>Aktif terminal</Text>
          <Text style={styles.heroTitle}>{terminalConfig.deviceName}</Text>
          <Text style={styles.heroMeta}>{terminalConfig.terminalCode} / {session.user?.username || 'open-admin'}</Text>
        </View>
      </View>

      <View style={styles.taskStack}>
        <TaskCard
          title="Yeni Satis"
          subtitle="Cari sec, barkod okut, fisi gonder"
          meta={syncState.online ? 'API hazir' : 'Offline queue aktif'}
          tone="primary"
          onPress={navigation.openNewSale}
        />
        <View style={styles.taskGrid}>
          <TaskCard
            title="Barkod"
            subtitle="Urun kontrol"
            meta="Hizli bak"
            tone="neutral"
            onPress={navigation.openBarcode}
          />
          <TaskCard
            title="Bekleyen"
            subtitle="Queue gonder"
            meta={`${pending} bekleyen`}
            tone={pending || failed ? 'danger' : 'success'}
            onPress={navigation.openSyncStatus}
          />
        </View>
      </View>

      {pending ? (
        <View style={[styles.syncPrompt, canQuickSync ? styles.syncPromptReady : styles.syncPromptOffline]}>
          <View style={styles.syncPromptText}>
            <Text style={styles.syncPromptTitle}>
              {canQuickSync ? 'Bekleyen satislar gonderilebilir' : 'Bekleyen satislar var'}
            </Text>
            <Text style={styles.syncPromptMeta}>
              {canQuickSync
                ? `${pending} fis API online oldugu icin simdi gonderilebilir.`
                : `${pending} fis API gelince Sync Merkezi'nden gonderilecek.`}
            </Text>
            {syncMessage ? <Text style={styles.syncPromptResult}>{syncMessage}</Text> : null}
          </View>
          {canQuickSync ? (
            <TerminalButton label={syncing ? 'Gonderiliyor' : 'Simdi Gonder'} onPress={quickSync} disabled={syncing} />
          ) : (
            <TerminalButton label="Sync Merkezi" onPress={navigation.openSyncStatus} variant="secondary" />
          )}
        </View>
      ) : null}

      <View style={styles.statusGrid}>
        <View style={[styles.statusCard, syncState.online ? styles.goodCard : styles.badCard]}>
          <Text style={styles.statusLabel}>API</Text>
          <Text style={styles.statusValue}>{syncState.online ? 'Online' : 'Offline'}</Text>
        </View>
        <View style={[styles.statusCard, pending ? styles.badCard : styles.goodCard]}>
          <Text style={styles.statusLabel}>Bekleyen</Text>
          <Text style={styles.statusValue}>{pending}</Text>
        </View>
        <View style={[styles.statusCard, failed ? styles.badCard : styles.goodCard]}>
          <Text style={styles.statusLabel}>Hatali</Text>
          <Text style={styles.statusValue}>{failed}</Text>
        </View>
      </View>

      <View style={styles.cachePanel}>
        <View>
          <Text style={styles.cacheTitle}>Local veri</Text>
          <Text style={styles.cacheMeta}>{products} urun / {customers} cari</Text>
        </View>
        <TerminalButton label="Guncelle" onPress={navigation.openDataUpdate} variant="secondary" />
      </View>

      <View style={styles.secondaryGrid}>
        <TerminalButton label="Sync Merkezi" onPress={navigation.openSyncStatus} variant="secondary" />
        <TerminalButton label="Saha testi" onPress={navigation.openFieldTest} variant="secondary" />
        <TerminalButton label="Urun bilgisi" onPress={navigation.openProductLookup} variant="secondary" />
        <TerminalButton label="Ayarlar" onPress={navigation.openSettings} variant="secondary" />
        <TerminalButton label="Durumu yenile" onPress={onRefresh} variant="secondary" />
      </View>

      <View style={[styles.notice, failed ? styles.noticeDanger : styles.noticeInfo]}>
        <Text style={[styles.noticeTitle, failed ? styles.noticeTitleDanger : styles.noticeTitleInfo]}>
          {failed ? 'Mudahale gerekli' : 'Saha akisi'}
        </Text>
        <Text style={styles.noticeText}>
          {failed
            ? 'Hatali kayit var. Sync Merkezi ekranindan gercek hata mesajini gorup tekrar gonderin.'
            : 'Ana akis satis baslatmak, barkod okutmak ve gerekirse bekleyenleri gondermektir.'}
        </Text>
      </View>

      <TerminalButton label="Cikis" onPress={onLogout} variant="danger" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 12,
    gap: 12,
  },
  heroPanel: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
  },
  heroAccent: {
    width: 6,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  heroTextBlock: {
    flex: 1,
  },
  heroLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 3,
  },
  heroMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  primaryGrid: {
    gap: 10,
  },
  taskStack: {
    gap: 9,
  },
  taskGrid: {
    flexDirection: 'row',
    gap: 9,
  },
  taskCard: {
    minHeight: 96,
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    justifyContent: 'space-between',
    gap: 8,
  },
  taskCard_primary: {
    minHeight: 124,
    backgroundColor: colors.accent,
    borderColor: colors.accentDark,
  },
  taskCard_neutral: {
    backgroundColor: colors.white,
    borderColor: colors.border,
  },
  taskCard_success: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  taskCard_danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  pressed: {
    opacity: 0.78,
  },
  taskText: {
    gap: 4,
  },
  taskTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  taskTitlePrimary: {
    color: colors.headerText,
    fontSize: 28,
  },
  taskSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  taskSubtitlePrimary: {
    color: colors.headerText,
  },
  taskMeta: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.panel,
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  taskMetaPrimary: {
    borderColor: '#99f6e4',
    backgroundColor: '#ccfbf1',
    color: colors.accentDark,
  },
  syncPrompt: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  syncPromptReady: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
  },
  syncPromptOffline: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  syncPromptText: {
    gap: 3,
  },
  syncPromptTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  syncPromptMeta: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  syncPromptResult: {
    color: colors.accentDark,
    fontSize: 12,
    fontWeight: '900',
  },
  secondaryGrid: {
    gap: 8,
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statusCard: {
    flex: 1,
    minHeight: 66,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  goodCard: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  badCard: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  statusLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  statusValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 3,
  },
  cachePanel: {
    minHeight: 72,
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cacheTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  cacheMeta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  notice: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  noticeInfo: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
  },
  noticeDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  noticeTitleInfo: {
    color: colors.warning,
  },
  noticeTitleDanger: {
    color: colors.danger,
  },
  noticeText: {
    marginTop: 5,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
});
