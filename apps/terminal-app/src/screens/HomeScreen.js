import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TerminalButton } from '../components/TerminalButton';
import { terminalConfig } from '../config/env';
import { colors } from '../styles/theme';

export function HomeScreen({ session, syncState, navigation, onLogout, onRefresh }) {
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

      <View style={styles.primaryGrid}>
        <TerminalButton label="Yeni satis" onPress={navigation.openNewSale} />
        <TerminalButton label="Barkod okut" onPress={navigation.openBarcode} />
      </View>

      <View style={styles.statusGrid}>
        <View style={[styles.statusCard, syncState.online ? styles.goodCard : styles.badCard]}>
          <Text style={styles.statusLabel}>API</Text>
          <Text style={styles.statusValue}>{syncState.online ? 'Online' : 'Offline'}</Text>
        </View>
        <View style={[styles.statusCard, syncState.pendingCount ? styles.badCard : styles.goodCard]}>
          <Text style={styles.statusLabel}>Bekleyen</Text>
          <Text style={styles.statusValue}>{syncState.pendingCount || 0}</Text>
        </View>
        <View style={[styles.statusCard, syncState.saleFailedCount ? styles.badCard : styles.goodCard]}>
          <Text style={styles.statusLabel}>Hatali</Text>
          <Text style={styles.statusValue}>{syncState.saleFailedCount || 0}</Text>
        </View>
      </View>

      <View style={styles.secondaryGrid}>
        <TerminalButton label="Sync durumu" onPress={navigation.openSyncStatus} variant="secondary" />
        <TerminalButton label="Veri guncelle" onPress={navigation.openDataUpdate} variant="secondary" />
        <TerminalButton label="Saha testi" onPress={navigation.openFieldTest} variant="secondary" />
        <TerminalButton label="Urun bilgisi" onPress={navigation.openProductLookup} variant="secondary" />
        <TerminalButton label="Ayarlar" onPress={navigation.openSettings} variant="secondary" />
        <TerminalButton label="Durumu yenile" onPress={onRefresh} variant="secondary" />
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Saha kullanim karari</Text>
        <Text style={styles.noticeText}>
          Ana akis satis ve barkod okutmadir. Sync ve ayarlar ikinci planda kalir; hata varsa ust durum cubugunda kirmizi gorunur.
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
  notice: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  noticeTitle: {
    color: colors.warning,
    fontSize: 14,
    fontWeight: '900',
  },
  noticeText: {
    marginTop: 5,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
});
