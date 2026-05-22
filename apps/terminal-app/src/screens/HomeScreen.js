import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { InfoRow } from '../components/InfoRow';
import { TerminalButton } from '../components/TerminalButton';
import { terminalConfig } from '../config/env';
import { colors } from '../styles/theme';

export function HomeScreen({ session, syncState, navigation, onLogout, onRefresh }) {
  const permissionCount = session.user?.permissions?.length || 0;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Depo Terminal</Text>
        <InfoRow label="Kullanici" value={session.user?.username || '-'} />
        <InfoRow label="Yetki sayisi" value={String(permissionCount)} />
        <InfoRow label="Terminal" value={terminalConfig.terminalCode} />
        <InfoRow label="API" value={syncState.apiStatus} tone={syncState.online ? 'success' : 'danger'} />
        <InfoRow label="Bekleyen queue" value={String(syncState.pendingCount)} tone={syncState.pendingCount ? 'danger' : 'success'} />
      </View>

      <View style={styles.quickGrid}>
        <TerminalButton label="Barkod okut" onPress={navigation.openBarcode} />
        <TerminalButton label="Urun ara" onPress={navigation.openProductLookup} variant="secondary" />
        <TerminalButton label="Sync durumu" onPress={navigation.openSyncStatus} variant="secondary" />
        <TerminalButton label="Durumu yenile" onPress={onRefresh} variant="secondary" />
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Faz 1 terminal kurali</Text>
        <Text style={styles.noticeText}>
          Bu app depo kullanimi icin hizli barkod arama, cache, local queue ve sync temelini hazirlar.
          Satis finalize, odeme ve stok sayim islemleri bu sprintte yoktur.
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
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  quickGrid: {
    gap: 8,
  },
  notice: {
    backgroundColor: '#fff6dd',
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: 4,
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
