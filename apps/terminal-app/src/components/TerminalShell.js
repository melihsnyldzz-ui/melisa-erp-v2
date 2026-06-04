import { StyleSheet, Text, View } from 'react-native';
import { terminalConfig } from '../config/env';
import { colors } from '../styles/theme';

export function TerminalShell({ title, subtitle, session, syncState, children }) {
  const pending = Number(syncState.pendingCount || 0);

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
        <View style={styles.contextItem}>
          <Text style={styles.contextLabel}>API</Text>
          <Text style={[styles.contextValue, syncState.online ? styles.good : styles.bad]}>{syncState.apiStatus || '-'}</Text>
        </View>
        <View style={styles.contextItem}>
          <Text style={styles.contextLabel}>Bekleyen</Text>
          <Text style={[styles.contextValue, pending ? styles.bad : styles.good]}>{pending}</Text>
        </View>
        <View style={styles.contextItem}>
          <Text style={styles.contextLabel}>Son Sync</Text>
          <Text style={styles.contextValue}>{syncState.lastSyncAt ? 'Var' : 'Yok'}</Text>
        </View>
      </View>

      <View style={styles.screenHeader}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topbar: {
    minHeight: 64,
    backgroundColor: colors.white,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  brandMarkText: {
    color: colors.headerText,
    fontSize: 18,
    fontWeight: '900',
  },
  brandTextBlock: {
    flex: 1,
  },
  brand: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  meta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  statusBadge: {
    minWidth: 88,
    alignItems: 'center',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  online: {
    backgroundColor: colors.success,
  },
  offline: {
    backgroundColor: colors.danger,
  },
  statusText: {
    color: colors.headerText,
    fontSize: 12,
    fontWeight: '900',
  },
  contextBar: {
    backgroundColor: colors.panelDark,
    borderBottomColor: colors.borderDark,
    borderBottomWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    gap: 8,
  },
  contextItem: {
    flex: 1,
    backgroundColor: '#172033',
    borderColor: '#263449',
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  contextLabel: {
    color: colors.headerSubtle,
    fontSize: 10,
    fontWeight: '800',
  },
  contextValue: {
    color: colors.headerText,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  good: {
    color: '#78d99b',
  },
  bad: {
    color: '#ff9a9a',
  },
  screenHeader: {
    backgroundColor: colors.white,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  title: {
    color: colors.text,
    fontSize: 22,
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
