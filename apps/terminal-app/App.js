import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text } from 'react-native';
import { TerminalShell } from './src/components/TerminalShell';
import { BarcodeScreen } from './src/screens/BarcodeScreen';
import { DataUpdateScreen } from './src/screens/DataUpdateScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { NewSaleScreen } from './src/screens/NewSaleScreen';
import { ProductLookupScreen } from './src/screens/ProductLookupScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SyncStatusScreen } from './src/screens/SyncStatusScreen';
import { pingApi } from './src/services/apiClient';
import { clearSession, getStoredSession, login, logout } from './src/services/authService';
import { getCacheSummary } from './src/services/cacheService';
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
    const [apiResult, queueSummary, cacheSummary] = await Promise.all([
      pingApi(),
      getQueueSummary(),
      getCacheSummary(),
    ]);

    setSyncState({
      online: apiResult.online,
      apiStatus: apiResult.online ? 'API online' : apiResult.message || 'API offline',
      pendingCount: queueSummary.pendingCount,
      failedCount: queueSummary.failedCount,
      syncedCount: queueSummary.syncedCount,
      salePendingCount: queueSummary.salePendingCount,
      saleFailedCount: queueSummary.saleFailedCount,
      productCount: cacheSummary.productCount,
      customerCount: cacheSummary.customerCount,
      productCachedAt: cacheSummary.productCachedAt,
      customerCachedAt: cacheSummary.customerCachedAt,
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
    openDataUpdate: () => setActiveScreen('dataUpdate'),
    openNewSale: () => setActiveScreen('newSale'),
    openProductLookup: () => setActiveScreen('productLookup'),
    openSettings: () => setActiveScreen('settings'),
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
      <TerminalShell
        title={activeScreen === 'home' ? 'Islem Masasi' : activeScreen === 'newSale' ? 'Yeni Satis' : activeScreen === 'barcode' ? 'Barkod Okut' : activeScreen === 'syncStatus' ? 'Sync Merkezi' : activeScreen === 'settings' ? 'Ayarlar' : activeScreen === 'dataUpdate' ? 'Veri Guncelle' : 'Urun Bilgisi'}
        subtitle={activeScreen === 'home' ? 'Saha terminali ana islem ekrani' : 'Tek elle hizli kullanim'}
        session={session}
        syncState={syncState}
      >
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

        {activeScreen === 'newSale' && (
          <NewSaleScreen
            session={session}
            navigation={navigation}
            onRefresh={refreshSyncState}
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

        {activeScreen === 'settings' && (
          <SettingsScreen
            navigation={navigation}
            onRefresh={refreshSyncState}
          />
        )}

        {activeScreen === 'dataUpdate' && (
          <DataUpdateScreen
            session={session}
            navigation={navigation}
            onRefresh={refreshSyncState}
          />
        )}
      </TerminalShell>
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
});
