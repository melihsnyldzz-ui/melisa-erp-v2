import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, SafeAreaView, StatusBar, StyleSheet, Text } from 'react-native';
import { TerminalShell } from './src/components/TerminalShell';
import { BarcodeScreen } from './src/screens/BarcodeScreen';
import { CatalogSendScreen } from './src/screens/CatalogSendScreen';
import { DataUpdateScreen } from './src/screens/DataUpdateScreen';
import { FieldTestScreen } from './src/screens/FieldTestScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { NewSaleScreen } from './src/screens/NewSaleScreen';
import { CustomerAccountsScreen } from './src/screens/CustomerAccountsScreen';
import { ProductLookupScreen } from './src/screens/ProductLookupScreen';
import { ReceiptCollectScreen } from './src/screens/ReceiptCollectScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
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
  duplicateCount: 0,
  syncedCount: 0,
  nonSaleCount: 0,
  salePendingCount: 0,
  saleFailedCount: 0,
  saleDuplicateCount: 0,
  productCount: 0,
  customerCount: 0,
  productCachedCount: 0,
  customerCachedCount: 0,
  productCachedAt: null,
  customerCachedAt: null,
  lastSyncAt: null,
};

export default function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null);
  const [activeScreen, setActiveScreen] = useState('home');
  const [screenHistory, setScreenHistory] = useState([]);
  const [lastLookup, setLastLookup] = useState(null);
  const [saleDraftToEdit, setSaleDraftToEdit] = useState(null);
  const [syncState, setSyncState] = useState(initialSyncState);

  const navigateTo = useCallback((nextScreen, options = {}) => {
    setScreenHistory((currentHistory) => {
      if (activeScreen === nextScreen) return currentHistory;
      if (options.reset) return [];
      if (options.replace) return currentHistory;
      return [...currentHistory, activeScreen].slice(-12);
    });
    setActiveScreen(nextScreen);
  }, [activeScreen]);

  const goBack = useCallback(() => {
    if (!session) return false;

    if (screenHistory.length) {
      const previousScreen = screenHistory[screenHistory.length - 1];
      setScreenHistory((currentHistory) => currentHistory.slice(0, -1));
      setActiveScreen(previousScreen);
      return true;
    }

    if (activeScreen !== 'home') {
      setActiveScreen('home');
      return true;
    }

    return true;
  }, [activeScreen, screenHistory, session]);

  useEffect(() => {
    if (!BackHandler?.addEventListener) {
      return undefined;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => subscription.remove();
  }, [goBack]);

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
      nonSaleCount: queueSummary.nonSaleCount,
      duplicateCount: queueSummary.duplicateCount,
      salePendingCount: queueSummary.salePendingCount,
      saleFailedCount: queueSummary.saleFailedCount,
      saleDuplicateCount: queueSummary.saleDuplicateCount,
      productCount: cacheSummary.productCount,
      customerCount: cacheSummary.customerCount,
      productCachedCount: cacheSummary.productCachedCount,
      customerCachedCount: cacheSummary.customerCachedCount,
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
    setScreenHistory([]);
    setActiveScreen('home');
    await refreshSyncState();
  }, [refreshSyncState]);

  const handleLogout = useCallback(async () => {
    await logout(session?.refreshToken);
    await clearSession();
    setSession(null);
    setScreenHistory([]);
    setActiveScreen('home');
  }, [session?.refreshToken]);

  const handleLookupResult = useCallback((result) => {
    setLastLookup(result);
    navigateTo('productLookup');
    refreshSyncState();
  }, [navigateTo, refreshSyncState]);

  const navigation = useMemo(() => ({
    goBack,
    goHome: () => navigateTo('home', { reset: true }),
    openBarcode: () => navigateTo('barcode'),
    openCatalogSend: () => navigateTo('catalogSend'),
    openCustomerAccounts: () => navigateTo('customerAccounts'),
    openDataUpdate: () => navigateTo('dataUpdate'),
    openFieldTest: () => navigateTo('fieldTest'),
    openReceiptCollect: () => navigateTo('receiptCollect'),
    openNewSale: () => navigateTo('newSale'),
    openNewSaleDraft: (draft) => {
      setSaleDraftToEdit(draft);
      navigateTo('newSale');
    },
    openProductLookup: () => navigateTo('productLookup'),
    openReports: () => navigateTo('reports'),
    openSettings: () => navigateTo('settings'),
    openSyncStatus: () => navigateTo('syncStatus'),
  }), [goBack, navigateTo]);

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
        title={activeScreen === 'home' ? 'Islem Masasi' : activeScreen === 'newSale' ? 'Yeni Satis' : activeScreen === 'barcode' ? 'Barkod Okut' : activeScreen === 'catalogSend' ? 'Katalog Gönder' : activeScreen === 'customerAccounts' ? 'Musteri Carileri' : activeScreen === 'syncStatus' ? 'Sync Merkezi' : activeScreen === 'reports' ? 'Raporlar' : activeScreen === 'settings' ? 'Ayarlar' : activeScreen === 'dataUpdate' ? 'Veri Guncelle' : activeScreen === 'fieldTest' ? 'Saha Testi' : activeScreen === 'receiptCollect' ? 'Fis Toplama' : 'Urun Bilgisi'}
        subtitle={activeScreen === 'home' ? 'Saha terminali ana islem ekrani' : 'Tek elle hizli kullanim'}
        hideScreenHeader={activeScreen === 'newSale'}
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

        {activeScreen === 'catalogSend' && (
          <CatalogSendScreen
            navigation={navigation}
            session={session}
          />
        )}

        {activeScreen === 'newSale' && (
          <NewSaleScreen
            session={session}
            syncState={syncState}
            navigation={navigation}
            draftToEdit={saleDraftToEdit}
            onDraftLoaded={() => setSaleDraftToEdit(null)}
            onRefresh={refreshSyncState}
          />
        )}

        {activeScreen === 'productLookup' && (
          <ProductLookupScreen
            lastLookup={lastLookup}
            navigation={navigation}
            session={session}
          />
        )}

        {activeScreen === 'customerAccounts' && (
          <CustomerAccountsScreen
            navigation={navigation}
            session={session}
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

        {activeScreen === 'reports' && (
          <ReportsScreen
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

        {activeScreen === 'fieldTest' && (
          <FieldTestScreen
            navigation={navigation}
            session={session}
            syncState={syncState}
            onRefresh={refreshSyncState}
          />
        )}

        {activeScreen === 'receiptCollect' && (
          <ReceiptCollectScreen
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
