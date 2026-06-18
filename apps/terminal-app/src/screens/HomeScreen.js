import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TerminalButton } from '../components/TerminalButton';
import { terminalConfig } from '../config/env';
import { colors } from '../styles/theme';

function HomeIcon({ type, tone = 'neutral' }) {
  if (type === 'sale') {
    return (
      <View style={[styles.iconCanvas, styles[`iconCanvas_${tone}`]]}>
        <View style={styles.receiptSheet}>
          <View style={styles.receiptLineLong} />
          <View style={styles.receiptLineShort} />
          <View style={styles.receiptTotalLine} />
        </View>
      </View>
    );
  }

  if (type === 'barcode') {
    return (
      <View style={[styles.iconCanvas, styles[`iconCanvas_${tone}`]]}>
        <View style={styles.barcodeFrame}>
          {[5, 2, 7, 3, 4, 2].map((width, index) => (
            <View key={`${width}-${index}`} style={[styles.barcodeLine, { width }]} />
          ))}
        </View>
      </View>
    );
  }

  if (type === 'queue') {
    return (
      <View style={[styles.iconCanvas, styles[`iconCanvas_${tone}`]]}>
        <View style={styles.uploadTray} />
        <View style={styles.uploadStem} />
        <View style={styles.uploadArrow} />
      </View>
    );
  }

  if (type === 'data') {
    return (
      <View style={[styles.iconCanvas, styles[`iconCanvas_${tone}`]]}>
        <View style={styles.dbTop} />
        <View style={styles.dbBody} />
        <View style={styles.dbBottom} />
      </View>
    );
  }

  if (type === 'field') {
    return (
      <View style={[styles.iconCanvas, styles[`iconCanvas_${tone}`]]}>
        <View style={styles.clipboard}>
          <View style={styles.clipTop} />
          <View style={styles.checkRow}>
            <Text style={styles.checkSymbol}>✓</Text>
            <View style={styles.checkLine} />
          </View>
          <View style={styles.checkRow}>
            <Text style={styles.checkSymbol}>✓</Text>
            <View style={styles.checkLineShort} />
          </View>
        </View>
      </View>
    );
  }

  if (type === 'search') {
    return (
      <View style={[styles.iconCanvas, styles[`iconCanvas_${tone}`]]}>
        <View style={styles.searchCircle} />
        <View style={styles.searchHandle} />
      </View>
    );
  }

  if (type === 'reports') {
    return (
      <View style={[styles.iconCanvas, styles[`iconCanvas_${tone}`]]}>
        <View style={styles.reportPage}>
          <View style={styles.reportBarTall} />
          <View style={styles.reportBarMedium} />
          <View style={styles.reportBarShort} />
        </View>
      </View>
    );
  }

  if (type === 'catalog') {
    return (
      <View style={[styles.iconCanvas, styles[`iconCanvas_${tone}`]]}>
        <View style={styles.catalogCard}>
          <View style={styles.catalogImage} />
          <View style={styles.catalogTextLong} />
          <View style={styles.catalogTextShort} />
        </View>
      </View>
    );
  }

  if (type === 'customer') {
    return (
      <View style={[styles.iconCanvas, styles[`iconCanvas_${tone}`]]}>
        <View style={styles.customerHead} />
        <View style={styles.customerBody} />
        <View style={styles.customerLineLong} />
        <View style={styles.customerLineShort} />
      </View>
    );
  }

  return (
    <View style={[styles.iconCanvas, styles[`iconCanvas_${tone}`]]}>
      <View style={styles.gearOuter}>
        <View style={styles.gearInner} />
      </View>
      <View style={styles.gearToothTop} />
      <View style={styles.gearToothSide} />
    </View>
  );
}

function ActionTile({ icon, title, subtitle, meta, tone = 'neutral', onPress, wide = false }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionTile,
        wide && styles.actionTileWide,
        styles[`actionTile_${tone}`],
        pressed && styles.pressed,
      ]}
    >
      <HomeIcon type={icon} tone={tone} />
      <View style={styles.actionText}>
        <Text style={[styles.actionTitle, tone === 'primary' && styles.actionTitlePrimary]}>{title}</Text>
        <Text style={[styles.actionSubtitle, tone === 'primary' && styles.actionSubtitlePrimary]}>{subtitle}</Text>
      </View>
      {meta ? <Text style={[styles.actionMeta, tone === 'primary' && styles.actionMetaPrimary]}>{meta}</Text> : null}
    </Pressable>
  );
}

function HomeSummary({ pending, failed, sent, products, customers }) {
  return (
    <View style={styles.todayPanel}>
      <View style={styles.todayItem}>
        <Text style={styles.todayLabel}>Bekleyen</Text>
        <Text style={[styles.todayValue, pending ? styles.todayValueDanger : styles.todayValueSuccess]}>{pending}</Text>
      </View>
      <View style={styles.todayItem}>
        <Text style={styles.todayLabel}>Hatali</Text>
        <Text style={[styles.todayValue, failed ? styles.todayValueDanger : styles.todayValueSuccess]}>{failed}</Text>
      </View>
      <View style={styles.todayItem}>
        <Text style={styles.todayLabel}>Giden fis</Text>
        <Text style={styles.todayValue}>{sent}</Text>
      </View>
      <View style={styles.todayItem}>
        <Text style={styles.todayLabel}>Local veri</Text>
        <Text style={styles.todayValueSmall}>{products}/{customers}</Text>
      </View>
    </View>
  );
}

export function HomeScreen({ session, syncState, navigation, onLogout, onRefresh }) {
  const pending = Number(syncState.salePendingCount || syncState.pendingCount || 0);
  const failed = Number(syncState.saleFailedCount || syncState.failedCount || 0);
  const products = Number(syncState.productCount || 0);
  const customers = Number(syncState.customerCount || 0);
  const sent = Number(syncState.syncedCount || 0);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.actionStack}>
        <View style={styles.quickHeader}>
          <View>
            <Text style={styles.quickTitle}>Operasyon</Text>
            <Text style={styles.quickMeta}>{terminalConfig.deviceName} / {session.user?.username || 'open-admin'}</Text>
          </View>
          <Text style={[styles.readyBadge, syncState.online ? styles.readyBadgeOnline : styles.readyBadgeOffline]}>
            {syncState.online ? 'Online' : 'Offline'}
          </Text>
        </View>
        <HomeSummary pending={pending} failed={failed} sent={sent} products={products} customers={customers} />
        <ActionTile
          icon="sale"
          title="Yeni Satis"
          subtitle="Cari sec, barkod okut, fisi hazirla"
          meta={syncState.online ? 'Hazir' : 'Offline'}
          tone="primary"
          onPress={navigation.openNewSale}
          wide
        />
        <View style={styles.actionGrid}>
          <ActionTile
            icon="barcode"
            title="Barkod Okut"
            subtitle="Stok ve fiyat kontrol"
            meta="Kontrol"
            tone="neutral"
            onPress={navigation.openBarcode}
          />
          <ActionTile
            icon="queue"
            title="Bekleyenler"
            subtitle={pending || failed ? 'Gonderim bekliyor' : 'Kuyruk bos'}
            meta={pending || failed ? `${pending} bekleyen` : 'Temiz'}
            tone={pending || failed ? 'danger' : 'success'}
            onPress={navigation.openSyncStatus}
          />
          <ActionTile
            icon="data"
            title="Veri Guncelle"
            subtitle="Urun ve cari cache"
            meta={`${products}/${customers}`}
            tone={products && customers ? 'success' : 'warning'}
            onPress={navigation.openDataUpdate}
          />
          <ActionTile
            icon="field"
            title="Fis Toplama"
            subtitle="Kesinlesen fisler"
            meta={`${sent} fis`}
            tone="neutral"
            onPress={navigation.openReceiptCollect}
          />
          <ActionTile
            icon="search"
            title="Urun Bilgisi"
            subtitle="Stok ve fiyat"
            meta="Arama"
            tone="neutral"
            onPress={navigation.openProductLookup}
          />
          <ActionTile
            icon="customer"
            title="Musteri Carileri"
            subtitle="Telefon, bakiye, para birimi"
            meta={`${customers} cari`}
            tone={customers ? 'success' : 'warning'}
            onPress={navigation.openCustomerAccounts}
          />
          <ActionTile
            icon="catalog"
            title="Katalog Gönder"
            subtitle="Filtrele, cari sec, WhatsApp"
            meta="Yeni"
            tone="success"
            onPress={navigation.openCatalogSend}
          />
          <ActionTile
            icon="reports"
            title="Raporlar"
            subtitle="Giden fisler"
            meta={`${sent} sonuc`}
            tone={sent ? 'success' : 'neutral'}
            onPress={navigation.openReports}
          />
          <ActionTile
            icon="settings"
            title="Ayarlar"
            subtitle="API ve cihaz"
            meta="Kurulum"
            tone="neutral"
            onPress={navigation.openSettings}
          />
        </View>
      </View>

      <View style={styles.cachePanel}>
        <View>
          <Text style={styles.cacheTitle}>Local veri</Text>
          <Text style={styles.cacheMeta}>{products} urun / {customers} cari</Text>
        </View>
        <Text style={[styles.cacheBadge, products && customers ? styles.cacheBadgeReady : styles.cacheBadgeWarning]}>
          {products && customers ? 'Hazir' : 'Eksik'}
        </Text>
      </View>

      <View style={styles.cleanDock}>
        <Pressable onPress={navigation.openNewSale} style={styles.dockItem}>
          <Text style={styles.dockIcon}>S</Text>
          <Text style={styles.dockText}>Satis</Text>
        </Pressable>
        <Pressable onPress={navigation.openSyncStatus} style={styles.dockItem}>
          <Text style={styles.dockIcon}>B</Text>
          <Text style={styles.dockText}>Bekleyen</Text>
        </Pressable>
        <Pressable onPress={navigation.openReceiptCollect} style={styles.dockItem}>
          <Text style={styles.dockIcon}>T</Text>
          <Text style={styles.dockText}>Toplama</Text>
        </Pressable>
        <Pressable onPress={navigation.openReports} style={styles.dockItem}>
          <Text style={styles.dockIcon}>R</Text>
          <Text style={styles.dockText}>Rapor</Text>
        </Pressable>
        <Pressable onPress={navigation.openCatalogSend} style={styles.dockItem}>
          <Text style={styles.dockIcon}>K</Text>
          <Text style={styles.dockText}>Katalog</Text>
        </Pressable>
        <Pressable onPress={navigation.openCustomerAccounts} style={styles.dockItem}>
          <Text style={styles.dockIcon}>C</Text>
          <Text style={styles.dockText}>Cari</Text>
        </Pressable>
      </View>

      <View style={styles.bottomDock}>
        <Pressable onPress={navigation.openNewSale} style={styles.dockItem}>
          <Text style={styles.dockIcon}>▤</Text>
          <Text style={styles.dockText}>Satis</Text>
        </Pressable>
        <Pressable onPress={navigation.openBarcode} style={styles.dockItem}>
          <Text style={styles.dockIcon}>▥</Text>
          <Text style={styles.dockText}>Barkod</Text>
        </Pressable>
        <Pressable onPress={navigation.openSyncStatus} style={styles.dockItem}>
          <Text style={styles.dockIcon}>↑</Text>
          <Text style={styles.dockText}>Sync</Text>
        </Pressable>
        <Pressable onPress={navigation.openReports} style={styles.dockItem}>
          <Text style={styles.dockIcon}>R</Text>
          <Text style={styles.dockText}>Rapor</Text>
        </Pressable>
        <Pressable onPress={navigation.openSettings} style={styles.dockItem}>
          <Text style={styles.dockIcon}>⚙</Text>
          <Text style={styles.dockText}>Ayar</Text>
        </Pressable>
      </View>

      <View style={styles.secondaryGrid}>
        <TerminalButton label="Durumu yenile" onPress={onRefresh} variant="secondary" />
      </View>

      {failed ? (
        <View style={[styles.notice, styles.noticeDanger]}>
          <Text style={[styles.noticeTitle, styles.noticeTitleDanger]}>Mudahale gerekli</Text>
          <Text style={styles.noticeText}>Hatali kayit var. Sync Merkezi ekranindan gercek hata mesajini gorup tekrar gonderin.</Text>
        </View>
      ) : null}

      <TerminalButton label="Cikis" onPress={onLogout} variant="danger" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 10,
    paddingBottom: 104,
    gap: 10,
  },
  quickHeader: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  quickTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  quickMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  readyBadge: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 7,
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  readyBadgeOnline: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
    color: colors.success,
  },
  readyBadgeOffline: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
  },
  actionStack: {
    gap: 8,
  },
  todayPanel: {
    minHeight: 58,
    flexDirection: 'row',
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  todayItem: {
    flex: 1,
    justifyContent: 'center',
    borderRightColor: colors.border,
    borderRightWidth: 1,
    paddingHorizontal: 7,
  },
  todayLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  todayValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  todayValueSmall: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 4,
  },
  todayValueSuccess: {
    color: colors.success,
  },
  todayValueDanger: {
    color: colors.danger,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  actionTile: {
    width: '48%',
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    justifyContent: 'space-between',
    gap: 8,
  },
  actionTileWide: {
    width: '100%',
    minHeight: 118,
  },
  actionTile_primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accentDark,
  },
  actionTile_neutral: {
    backgroundColor: colors.white,
    borderColor: colors.border,
  },
  actionTile_success: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  actionTile_danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  actionTile_warning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
  },
  pressed: {
    opacity: 0.78,
  },
  iconCanvas: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  iconCanvas_primary: {
    borderColor: '#99f6e4',
    backgroundColor: '#ccfbf1',
  },
  iconCanvas_neutral: {
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  iconCanvas_success: {
    borderColor: colors.success,
    backgroundColor: colors.white,
  },
  iconCanvas_danger: {
    borderColor: colors.danger,
    backgroundColor: colors.white,
  },
  iconCanvas_warning: {
    borderColor: colors.warning,
    backgroundColor: colors.white,
  },
  receiptSheet: {
    width: 31,
    height: 38,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.accentDark,
    backgroundColor: colors.white,
    padding: 5,
    gap: 4,
  },
  receiptLineLong: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  receiptLineShort: {
    width: 16,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderDark,
  },
  receiptTotalLine: {
    marginTop: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.danger,
  },
  barcodeFrame: {
    width: 36,
    height: 32,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.text,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 5,
  },
  barcodeLine: {
    height: '100%',
    backgroundColor: colors.text,
  },
  uploadTray: {
    width: 36,
    height: 10,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.danger,
    position: 'absolute',
    bottom: 13,
  },
  uploadStem: {
    width: 6,
    height: 24,
    borderRadius: 4,
    backgroundColor: colors.danger,
    position: 'absolute',
    top: 16,
  },
  uploadArrow: {
    width: 18,
    height: 18,
    borderLeftWidth: 6,
    borderTopWidth: 6,
    borderColor: colors.danger,
    transform: [{ rotate: '45deg' }],
    position: 'absolute',
    top: 11,
  },
  dbTop: {
    width: 34,
    height: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.success,
    backgroundColor: colors.white,
  },
  dbBody: {
    width: 34,
    height: 22,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
    marginTop: -6,
  },
  dbBottom: {
    width: 34,
    height: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.success,
    backgroundColor: colors.white,
    marginTop: -6,
  },
  clipboard: {
    width: 35,
    height: 42,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.accentDark,
    backgroundColor: colors.white,
    paddingTop: 11,
    paddingHorizontal: 5,
    gap: 4,
  },
  clipTop: {
    width: 16,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
    position: 'absolute',
    top: -4,
    alignSelf: 'center',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checkSymbol: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '900',
  },
  checkLine: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderDark,
  },
  checkLineShort: {
    width: 12,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderDark,
  },
  searchCircle: {
    width: 27,
    height: 27,
    borderRadius: 16,
    borderWidth: 4,
    borderColor: colors.accentDark,
    backgroundColor: colors.white,
  },
  searchHandle: {
    width: 18,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.accentDark,
    transform: [{ rotate: '45deg' }],
    position: 'absolute',
    right: 10,
    bottom: 13,
  },
  gearOuter: {
    width: 31,
    height: 31,
    borderRadius: 18,
    borderWidth: 6,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearInner: {
    width: 8,
    height: 8,
    borderRadius: 5,
    backgroundColor: colors.text,
  },
  gearToothTop: {
    width: 8,
    height: 38,
    borderRadius: 3,
    backgroundColor: colors.text,
    position: 'absolute',
  },
  gearToothSide: {
    width: 38,
    height: 8,
    borderRadius: 3,
    backgroundColor: colors.text,
    position: 'absolute',
  },
  reportPage: {
    width: 34,
    height: 40,
    borderColor: colors.accentDark,
    borderWidth: 2,
    borderRadius: 6,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    padding: 6,
  },
  reportBarTall: {
    width: 5,
    height: 22,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  reportBarMedium: {
    width: 5,
    height: 16,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  reportBarShort: {
    width: 5,
    height: 10,
    borderRadius: 3,
    backgroundColor: colors.danger,
  },
  catalogCard: {
    width: 34,
    height: 40,
    borderColor: colors.accentDark,
    borderWidth: 2,
    borderRadius: 6,
    backgroundColor: colors.white,
    padding: 5,
    gap: 4,
  },
  catalogImage: {
    height: 15,
    borderRadius: 4,
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderWidth: 1,
  },
  catalogTextLong: {
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.danger,
  },
  catalogTextShort: {
    width: 15,
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  customerHead: {
    width: 17,
    height: 17,
    borderRadius: 10,
    backgroundColor: colors.accent,
    position: 'absolute',
    top: 8,
    left: 9,
  },
  customerBody: {
    width: 28,
    height: 16,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.accentDark,
    position: 'absolute',
    left: 5,
    bottom: 8,
  },
  customerLineLong: {
    width: 17,
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.danger,
    position: 'absolute',
    right: 6,
    top: 12,
  },
  customerLineShort: {
    width: 12,
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.success,
    position: 'absolute',
    right: 6,
    top: 20,
  },
  actionText: {
    gap: 3,
  },
  actionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  actionTitlePrimary: {
    color: colors.headerText,
    fontSize: 25,
  },
  actionSubtitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
  actionSubtitlePrimary: {
    color: colors.headerText,
  },
  actionMeta: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.panel,
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  actionMetaPrimary: {
    borderColor: '#99f6e4',
    backgroundColor: '#ccfbf1',
    color: colors.accentDark,
  },
  secondaryGrid: {
    gap: 8,
  },
  cleanDock: {
    minHeight: 62,
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 6,
    gap: 6,
  },
  bottomDock: {
    display: 'none',
    minHeight: 62,
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 6,
    gap: 6,
  },
  dockItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    backgroundColor: colors.panel,
    gap: 3,
  },
  dockIcon: {
    color: colors.accentDark,
    fontSize: 12,
    fontWeight: '900',
  },
  dockText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
  },
  cachePanel: {
    minHeight: 58,
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cacheTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  cacheMeta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  cacheBadge: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 7,
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cacheBadgeReady: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
    color: colors.success,
  },
  cacheBadgeWarning: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
    color: colors.warning,
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
