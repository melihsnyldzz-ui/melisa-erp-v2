import { StyleSheet, Text, View } from 'react-native';
import { terminalConfig } from '../config/env';
import { colors } from '../styles/theme';

function formatShortDate(value) {
  if (!value) return 'Yok';

  try {
    return new Date(value).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Var';
  }
}

export function TerminalShell({ title, subtitle, session, syncState, children, hideScreenHeader = false }) {
  const pending = Number(syncState.salePendingCount || syncState.pendingCount || 0);
  const failed = Number(syncState.saleFailedCount || syncState.failedCount || 0);

  return (
    <View style={styles.shell}>
      <View style={styles.topbar}>
        <View style={styles.brandBlock}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>M</Text>
          </View>
          <View style={styles.brandTextBlock}>
            <Text style={styles.brand}>Melisa Terminal</Text>
            <Text style={styles.meta}>{terminalConfig.terminalCode} / {session?.user?.username || 'open-admin'}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, syncState.online ? styles.online : styles.offline]}>
          <Text style={styles.statusText}>{syncState.online ? 'ONLINE' : 'OFFLINE'}</Text>
        </View>
      </View>

      <View style={styles.contextBar}>
        <Text style={[styles.contextChip, syncState.online ? styles.goodChip : styles.badChip]}>
          API {syncState.online ? 'online' : 'offline'}
        </Text>
        <Text style={[styles.contextChip, pending ? styles.badChip : styles.goodChip]}>Bekleyen {pending}</Text>
        <Text style={[styles.contextChip, failed ? styles.badChip : styles.goodChip]}>Hatali {failed}</Text>
        <Text style={styles.contextChip}>Sync {formatShortDate(syncState.lastSyncAt)}</Text>
      </View>

      {!syncState.online ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineTitle}>OFFLINE MOD</Text>
          <Text style={styles.offlineText}>API kapali. Satislar local kuyruga alinip Sync Merkezi'nden gonderilecek.</Text>
        </View>
      ) : null}

      {!hideScreenHeader ? (
        <View style={styles.screenHeader}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}

      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: colors.background,
  },
  topbar: {
    minHeight: 50,
    backgroundColor: colors.white,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandMark: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  brandMarkText: {
    color: colors.headerText,
    fontSize: 16,
    fontWeight: '900',
  },
  brandTextBlock: {
    flex: 1,
  },
  brand: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  meta: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
  },
  statusBadge: {
    minWidth: 74,
    alignItems: 'center',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  online: {
    backgroundColor: colors.success,
  },
  offline: {
    backgroundColor: colors.danger,
  },
  statusText: {
    color: colors.headerText,
    fontSize: 11,
    fontWeight: '900',
  },
  contextBar: {
    backgroundColor: colors.panelDark,
    borderBottomColor: colors.borderDark,
    borderBottomWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 5,
    flexDirection: 'row',
    gap: 5,
  },
  contextChip: {
    flex: 1,
    minHeight: 28,
    overflow: 'hidden',
    backgroundColor: '#172033',
    borderColor: '#263449',
    borderWidth: 1,
    borderRadius: 7,
    color: colors.headerText,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
    paddingHorizontal: 4,
    paddingVertical: 7,
  },
  goodChip: {
    color: '#78d99b',
  },
  badChip: {
    color: '#ff9a9a',
  },
  offlineBanner: {
    backgroundColor: colors.dangerSoft,
    borderBottomColor: colors.danger,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  offlineTitle: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '900',
  },
  offlineText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  screenHeader: {
    backgroundColor: colors.white,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  body: {
    flex: 1,
  },
});
