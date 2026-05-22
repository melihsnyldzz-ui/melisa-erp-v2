import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { BarcodeScreen } from './src/screens/BarcodeScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { ProductLookupScreen } from './src/screens/ProductLookupScreen';
import { SyncStatusScreen } from './src/screens/SyncStatusScreen';
import { pingApi } from './src/services/apiClient';
import { clearSession, getStoredSession, login, logout } from './src/services/authService';
import { getQueueSummary } from './src/services/queueService';
import { colors } from './src/styles/theme';

const initialSyncState = {
  online: false,
  apiStatus: 'Kontrol ediliyor',
  pendingCount: 0,
  failedCount: 0,
  lastSyncAt: null,
};

export default function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null);
  const [activeScreen, setActiveScreen] = useState('home');
  const [lastLookup, setLastLookup] = useState(null);
  const [syncState, setSyncState] = useState(initialSyncState);

  const refreshSyncState = useCallback(async () => {
    const [apiResult, queueSummary] = await Promise.all([
      pingApi(),
      getQueueSummary(),
    ]);

    setSyncState({
      online: apiResult.online,
      apiStatus: apiResult.online ? 'API online' : apiResult.message || 'API offline',
      pendingCount: queueSummary.pendingCount,
      failedCount: queueSummary.failedCount,
      lastSyncAt: queueSummary.lastSyncAt,
    });
  }, []);

  useEffect(() => {
    async function restore() {
      const storedSession = await getStoredSession();
      setSession(storedSession);
      setBooting(false);
      await refreshSyncState();
    }

    restore();
  }, [refreshSyncState]);

  const handleLogin = useCallback(async (credentials) => {
    const nextSession = await login(credentials);
    setSession(nextSession);
    setActiveScreen('home');
    await refreshSyncState();
  }, [refreshSyncState]);

  const handleLogout = useCallback(async () => {
    await logout(session?.refreshToken);
    await clearSession();
    setSession(null);
    setActiveScreen('home');
  }, [session?.refreshToken]);

  const handleLookupResult = useCallback((result) => {
    setLastLookup(result);
    setActiveScreen('productLookup');
    refreshSyncState();
  }, [refreshSyncState]);

  const navigation = useMemo(() => ({
    goHome: () => setActiveScreen('home'),
    openBarcode: () => setActiveScreen('barcode'),
    openProductLookup: () => setActiveScreen('productLookup'),
    openSyncStatus: () => setActiveScreen('syncStatus'),
  }), []);

  if (booting) {
    return (
      <SafeAreaView style={styles.bootScreen}>
        <StatusBar barStyle="light-content" backgroundColor={colors.header} />
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.bootText}>Terminal oturumu kontrol ediliyor...</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        syncState={syncState}
      />
    );
  }

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar barStyle="light-content" backgroundColor={colors.header} />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Melisa Terminal v2</Text>
          <Text style={styles.headerMeta}>{session.user?.username || 'Terminal kullanicisi'}</Text>
        </View>
        <View style={[styles.onlineBadge, syncState.online ? styles.online : styles.offline]}>
          <Text style={styles.onlineText}>{syncState.online ? 'ONLINE' : 'OFFLINE'}</Text>
        </View>
      </View>

      {activeScreen === 'home' && (
        <HomeScreen
          session={session}
          syncState={syncState}
          navigation={navigation}
          onLogout={handleLogout}
          onRefresh={refreshSyncState}
        />
      )}

      {activeScreen === 'barcode' && (
        <BarcodeScreen
          session={session}
          syncState={syncState}
          navigation={navigation}
          onLookupResult={handleLookupResult}
        />
      )}

      {activeScreen === 'productLookup' && (
        <ProductLookupScreen
          lastLookup={lastLookup}
          navigation={navigation}
        />
      )}

      {activeScreen === 'syncStatus' && (
        <SyncStatusScreen
          session={session}
          syncState={syncState}
          navigation={navigation}
          onRefresh={refreshSyncState}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bootScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.header,
  },
  bootText: {
    marginTop: 14,
    color: colors.headerText,
    fontSize: 16,
    fontWeight: '700',
  },
  header: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.header,
    borderBottomColor: colors.borderDark,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: colors.headerText,
    fontSize: 20,
    fontWeight: '800',
  },
  headerMeta: {
    color: colors.headerSubtle,
    fontSize: 12,
    marginTop: 2,
  },
  onlineBadge: {
    minWidth: 82,
    alignItems: 'center',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  online: {
    backgroundColor: colors.success,
  },
  offline: {
    backgroundColor: colors.danger,
  },
  onlineText: {
    color: colors.headerText,
    fontSize: 12,
    fontWeight: '900',
  },
});
