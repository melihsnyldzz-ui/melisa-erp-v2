import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { KeyboardSafeScrollView, KeyboardSafeTextInput } from '../components/KeyboardSafeScrollView';
import { TerminalButton } from '../components/TerminalButton';
import { getPendingQueue } from '../services/queueService';
import { colors, terminalStyles } from '../styles/theme';

const collectStateKey = 'terminalReceiptCollectStateV1';

function formatDate(value) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return String(value);
  }
}

function receiptDate(event = {}) {
  return event.lastAttemptAt || event.clientCreatedAt;
}

function receiptNumber(event = {}) {
  const response = event.serverResponse || {};
  return response.receiptNo || response.salesReceiptNo || response.documentNo || response.id || event.clientEventId;
}

function saleQuantity(payload = {}) {
  return (payload.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function saleCurrency(payload = {}) {
  return payload.documentCurrency || payload.items?.[0]?.currency || 'TRY';
}

function saleTotal(payload = {}) {
  return (payload.items || []).reduce((sum, item) => (
    sum + Number(item.quantity || 0) * Number(item.unitPrice || 0)
  ), 0);
}

function formatMoney(value, currency = 'TRY') {
  return `${Number(value || 0).toFixed(2)} ${currency}`;
}

function normalizeSearch(value) {
  return String(value || '').trim().toLocaleLowerCase('tr-TR');
}

function itemKey(item = {}, index) {
  return String(item.productId || item.stockCode || item.barcode || `line-${index}`);
}

function itemMatchesScan(item = {}, scanValue) {
  const normalized = normalizeSearch(scanValue);
  if (!normalized) return false;

  return [
    item.barcode,
    item.stockCode,
  ].some((value) => normalizeSearch(value) === normalized);
}

async function readCollectState() {
  const raw = await AsyncStorage.getItem(collectStateKey);
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeCollectState(state) {
  await AsyncStorage.setItem(collectStateKey, JSON.stringify(state));
}

function ReceiptCard({ event, pickedCount, totalCount, onPress }) {
  const payload = event.payload || {};
  const currency = saleCurrency(payload);
  const done = totalCount > 0 && pickedCount >= totalCount;

  return (
    <Pressable onPress={() => onPress(event)} style={({ pressed }) => [styles.receiptCard, done && styles.receiptCardDone, pressed && styles.pressed]}>
      <View style={styles.receiptHeader}>
        <View style={styles.receiptTitleBlock}>
          <Text style={styles.receiptCustomer} numberOfLines={1}>{payload.customerName || payload.customerCode || '-'}</Text>
          <Text style={styles.receiptMeta}>{payload.customerCode || '-'} / {formatDate(receiptDate(event))}</Text>
        </View>
        <Text style={[styles.statusPill, done && styles.statusDone]}>{done ? 'Toplandi' : `${pickedCount}/${totalCount}`}</Text>
      </View>
      <View style={styles.receiptFacts}>
        <Text style={styles.factChip}>Fis {String(receiptNumber(event)).slice(0, 16)}</Text>
        <Text style={styles.factChip}>{saleQuantity(payload)} adet</Text>
        <Text style={styles.factChip}>{formatMoney(saleTotal(payload), currency)}</Text>
      </View>
    </Pressable>
  );
}

function CollectLine({ item, index, picked, active, onSelect }) {
  return (
    <Pressable onPress={onSelect} style={({ pressed }) => [styles.collectLine, picked && styles.collectLinePicked, active && styles.collectLineActive, pressed && styles.pressed]}>
      <View style={styles.collectLineMain}>
        <Text style={styles.collectCode} numberOfLines={1}>{item.stockCode || item.barcode || `Satir ${index + 1}`}</Text>
        <Text style={styles.collectName} numberOfLines={2}>{item.productName || '-'}</Text>
        <Text style={styles.collectMeta}>{formatMoney(item.unitPrice, item.currency)}</Text>
      </View>
      <View style={styles.quantityBox}>
        <Text style={styles.quantityValue}>{Number(item.quantity || 0)}</Text>
        <Text style={styles.quantityLabel}>adet</Text>
      </View>
      {picked ? (
        <Text style={styles.doneBadge}>✓</Text>
      ) : null}
    </Pressable>
  );
}

function ScanResultPanel({ line, error, onMarkPicked }) {
  if (error) {
    return (
      <View style={[styles.scanResultPanel, styles.scanResultError]}>
        <Text style={styles.scanResultLabel}>Bu urun secili fis icinde yok</Text>
        <Text style={styles.scanResultErrorText}>{error}</Text>
      </View>
    );
  }

  if (!line?.item) return null;

  const item = line.item;

  return (
    <View style={styles.scanResultPanel}>
      <View style={styles.scanResultText}>
        <Text style={styles.scanResultLabel}>Bulunan urun</Text>
        <Text style={styles.scanResultCode} numberOfLines={1}>{item.stockCode || item.barcode || '-'}</Text>
        <Text style={styles.scanResultName} numberOfLines={2}>{item.productName || '-'}</Text>
      </View>
      <View style={styles.scanResultQty}>
        <Text style={styles.scanResultQtyValue}>{Number(item.quantity || 0)}</Text>
        <Text style={styles.scanResultQtyLabel}>adet var</Text>
        <TerminalButton label="Eklendi" onPress={onMarkPicked} />
      </View>
    </View>
  );
}

export function ReceiptCollectScreen({ navigation, onRefresh }) {
  const barcodeRef = useRef(null);
  const [queue, setQueue] = useState([]);
  const [collectState, setCollectState] = useState({});
  const [selectedEventId, setSelectedEventId] = useState('');
  const [barcode, setBarcode] = useState('');
  const [itemQuery, setItemQuery] = useState('');
  const [activeItemKey, setActiveItemKey] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const finalizedReceipts = useMemo(() => (
    queue
      .filter((event) => event.eventType === 'terminal_sale' && event.status === 'synced')
      .sort((a, b) => String(receiptDate(b)).localeCompare(String(receiptDate(a))))
  ), [queue]);

  const selectedEvent = useMemo(() => (
    finalizedReceipts.find((event) => event.clientEventId === selectedEventId) || null
  ), [finalizedReceipts, selectedEventId]);

  const selectedItems = selectedEvent?.payload?.items || [];
  const selectedPicked = collectState[selectedEventId] || {};
  const sortedItems = useMemo(() => (
    selectedItems
      .map((item, index) => ({ item, index, key: itemKey(item, index), picked: Boolean(selectedPicked[itemKey(item, index)]) }))
      .filter((line) => {
        const query = normalizeSearch(itemQuery);
        if (!query) return true;
        return [
          line.item.stockCode,
          line.item.barcode,
          line.item.productName,
        ].some((value) => normalizeSearch(value).includes(query));
      })
      .sort((a, b) => Number(a.picked) - Number(b.picked))
  ), [itemQuery, selectedItems, selectedPicked]);
  const activeLine = useMemo(() => (
    selectedItems
      .map((item, index) => ({ item, index, key: itemKey(item, index), picked: Boolean(selectedPicked[itemKey(item, index)]) }))
      .find((line) => line.key === activeItemKey) || null
  ), [activeItemKey, selectedItems, selectedPicked]);
  const pickedCount = sortedItems.filter((line) => line.picked).length;

  async function refreshScreen() {
    const [nextQueue, nextState] = await Promise.all([
      getPendingQueue(),
      readCollectState(),
    ]);
    setQueue(nextQueue);
    setCollectState(nextState);
    await onRefresh?.();
  }

  useEffect(() => {
    refreshScreen();
  }, []);

  function openReceipt(event) {
    setSelectedEventId(event.clientEventId);
    setBarcode('');
    setItemQuery('');
    setActiveItemKey('');
    setMessage('Barkod okutun veya stok kodu girin.');
    setError('');
    setTimeout(() => barcodeRef.current?.focus(), 120);
  }

  function closeReceipt() {
    setSelectedEventId('');
    setBarcode('');
    setItemQuery('');
    setActiveItemKey('');
    setMessage('');
    setError('');
  }

  function findLineByScan(scanValue) {
    return selectedItems
      .map((item, index) => ({ item, index, key: itemKey(item, index) }))
      .find((line) => itemMatchesScan(line.item, scanValue));
  }

  function selectLine(line) {
    setActiveItemKey(line.key);
    setError('');
    setMessage(`${line.item.stockCode || line.item.barcode}: fiste ${Number(line.item.quantity || 0)} adet var`);
    setTimeout(() => barcodeRef.current?.focus(), 80);
  }

  function scanProduct() {
    const value = barcode.trim();
    if (!selectedEvent) {
      setError('Once fis secin');
      return;
    }

    if (!value) {
      setError('Barkod veya stok kodu okutun');
      return;
    }

    const line = findLineByScan(value);
    if (!line) {
      setActiveItemKey('');
      setError('Bu urun secili fis icinde yok');
      setMessage('');
      try {
        Vibration.vibrate([0, 80, 50, 80]);
      } catch {
        // Optional on web.
      }
      return;
    }

    setActiveItemKey(line.key);
    setError('');
    setMessage(`${line.item.stockCode || line.item.barcode}: fiste ${Number(line.item.quantity || 0)} adet var`);
    setBarcode('');
    try {
      Vibration.vibrate(35);
    } catch {
      // Optional on web.
    }
    setTimeout(() => barcodeRef.current?.focus(), 80);
  }

  async function markPicked(key = activeItemKey) {
    if (!selectedEvent || !key) {
      setError('Once urun okutun veya satirdan Eklendi secin');
      return;
    }

    const nextState = {
      ...collectState,
      [selectedEventId]: {
        ...(collectState[selectedEventId] || {}),
        [key]: true,
      },
    };
    await writeCollectState(nextState);
    setCollectState(nextState);
    setActiveItemKey('');
    setMessage('Urun eklendi olarak isaretlendi');
    setError('');
    setTimeout(() => barcodeRef.current?.focus(), 80);
  }

  async function clearReceiptCollect() {
    if (!selectedEventId) return;
    const nextState = { ...collectState };
    delete nextState[selectedEventId];
    await writeCollectState(nextState);
    setCollectState(nextState);
    setActiveItemKey('');
    setMessage('Bu fisin toplama isaretleri temizlendi');
    setError('');
  }

  if (selectedEvent) {
    const payload = selectedEvent.payload || {};
    const allPicked = selectedItems.length > 0 && pickedCount >= selectedItems.length;

    return (
      <KeyboardSafeScrollView contentContainerStyle={styles.content}>
        <View style={[styles.detailPanel, allPicked && styles.detailPanelDone]}>
          <View style={styles.detailHeader}>
            <View style={styles.receiptTitleBlock}>
              <Text style={styles.detailTitle} numberOfLines={1}>{payload.customerName || payload.customerCode || '-'}</Text>
              <Text style={styles.receiptMeta}>{formatDate(receiptDate(selectedEvent))}</Text>
            </View>
            <Text style={[styles.statusPill, allPicked && styles.statusDone]}>{pickedCount}/{selectedItems.length}</Text>
          </View>
          <Text style={styles.detailMeta} numberOfLines={1}>{receiptNumber(selectedEvent)}</Text>
        </View>

        {allPicked ? (
          <View style={styles.completedBanner}>
            <Text style={styles.completedTitle}>Fis tamamen toplandi</Text>
            <Text style={styles.completedText}>Tum urun satirlari personel tarafindan eklendi olarak isaretlendi.</Text>
          </View>
        ) : null}

        <View style={styles.scanPanel}>
          <Text style={styles.scanTitle}>Barkod / Stok Kodu</Text>
          <KeyboardSafeTextInput
            ref={barcodeRef}
            value={barcode}
            onChangeText={setBarcode}
            onSubmitEditing={scanProduct}
            style={styles.scanInput}
            placeholder="Barkod okut"
            showSoftInputOnFocus={false}
            keyboardType="number-pad"
            returnKeyType="done"
            blurOnSubmit={false}
          />
          <Pressable onPress={scanProduct} style={styles.findButton}>
            <Text style={styles.findButtonText}>Urunu Bul</Text>
          </Pressable>
        </View>

        <ScanResultPanel line={activeLine} error={activeLine ? '' : error} onMarkPicked={() => markPicked()} />
        {message && !activeLine ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.itemSearchPanel}>
          <Text style={styles.itemSearchLabel}>Barkod okumazsa fis icinde ara</Text>
          <KeyboardSafeTextInput
            value={itemQuery}
            onChangeText={setItemQuery}
            style={styles.itemSearchInput}
            placeholder="Urun adi, stok kodu veya barkod"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.lineList}>
          {sortedItems.map((line) => (
            <CollectLine
              key={line.key}
              item={line.item}
              index={line.index}
              picked={line.picked}
              active={activeItemKey === line.key}
              onSelect={() => selectLine(line)}
            />
          ))}
          {sortedItems.length === 0 ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>Urun bulunamadi</Text>
              <Text style={styles.emptyText}>Bu fis icinde aramaya uyan satir yok.</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.footerActions}>
          <Pressable onPress={clearReceiptCollect} style={styles.footerButton}>
            <Text style={styles.footerButtonText}>Temizle</Text>
          </Pressable>
          <Pressable onPress={closeReceipt} style={styles.footerButton}>
            <Text style={styles.footerButtonText}>Liste</Text>
          </Pressable>
          <Pressable onPress={navigation.goHome} style={styles.footerButton}>
            <Text style={styles.footerButtonText}>Ana Ekran</Text>
          </Pressable>
        </View>
      </KeyboardSafeScrollView>
    );
  }

  return (
    <KeyboardSafeScrollView contentContainerStyle={styles.content}>
      <View style={styles.heroPanel}>
        <Text style={styles.heroTitle}>Fis Toplama</Text>
        <Text style={styles.heroText}>Kesinlesen fisleri secin, urunleri okutun, toplanan satirlari isaretleyin.</Text>
      </View>

      {finalizedReceipts.length ? finalizedReceipts.map((event) => {
        const items = event.payload?.items || [];
        const pickedMap = collectState[event.clientEventId] || {};
        const totalCount = items.length;
        const picked = items.filter((item, index) => pickedMap[itemKey(item, index)]).length;
        return (
          <ReceiptCard
            key={event.clientEventId}
            event={event}
            pickedCount={picked}
            totalCount={totalCount}
            onPress={openReceipt}
          />
        );
      }) : (
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyTitle}>Kesinlesen fis yok</Text>
          <Text style={styles.emptyText}>Gonderilen/kesinlesen fisler burada toplanir.</Text>
        </View>
      )}

      <TerminalButton label="Yenile" onPress={refreshScreen} variant="secondary" />
      <TerminalButton label="Ana ekran" onPress={navigation.goHome} variant="secondary" />
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 8,
    paddingBottom: 104,
    gap: 8,
  },
  heroPanel: {
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    padding: 10,
    gap: 4,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  heroText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  receiptCard: {
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderLeftColor: colors.warning,
    borderLeftWidth: 5,
    borderRadius: 8,
    backgroundColor: colors.white,
    padding: 9,
    gap: 7,
    ...terminalStyles.rowShadow,
  },
  receiptCardDone: {
    borderLeftColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  pressed: {
    opacity: 0.75,
  },
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  receiptTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  receiptCustomer: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  receiptMeta: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  receiptFacts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  factChip: {
    overflow: 'hidden',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.panel,
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  statusPill: {
    overflow: 'hidden',
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.warningSoft,
    color: colors.warning,
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusDone: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
    color: colors.success,
  },
  detailPanel: {
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.warningSoft,
    padding: 9,
    gap: 4,
  },
  detailPanelDone: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  detailMeta: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  completedBanner: {
    borderColor: colors.success,
    borderWidth: 2,
    borderRadius: 8,
    backgroundColor: colors.successSoft,
    padding: 11,
    gap: 3,
  },
  completedTitle: {
    color: colors.success,
    fontSize: 18,
    fontWeight: '900',
  },
  completedText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  scanPanel: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    padding: 9,
    gap: 8,
  },
  scanTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  scanInput: {
    minHeight: 58,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.panel,
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    paddingHorizontal: 12,
  },
  findButton: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
  },
  findButtonText: {
    color: colors.headerText,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  scanResultPanel: {
    borderColor: colors.success,
    borderWidth: 2,
    borderLeftColor: colors.success,
    borderLeftWidth: 8,
    borderRadius: 8,
    backgroundColor: colors.successSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
  },
  scanResultError: {
    borderColor: colors.danger,
    borderLeftColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  scanResultText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  scanResultLabel: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  scanResultCode: {
    color: colors.danger,
    fontSize: 18,
    fontWeight: '900',
  },
  scanResultName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 18,
  },
  scanResultErrorText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '900',
  },
  scanResultQty: {
    minWidth: 86,
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    paddingHorizontal: 8,
    gap: 4,
  },
  scanResultQtyValue: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
  scanResultQtyLabel: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  itemSearchPanel: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    padding: 8,
    gap: 6,
  },
  itemSearchLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  itemSearchInput: {
    minHeight: 42,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.panel,
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    paddingHorizontal: 10,
  },
  lineList: {
    gap: 7,
  },
  collectLine: {
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderLeftColor: colors.warning,
    borderLeftWidth: 5,
    borderRadius: 8,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
  },
  collectLineActive: {
    borderColor: colors.accent,
    borderLeftColor: colors.accent,
    backgroundColor: colors.white,
  },
  collectLinePicked: {
    borderColor: colors.success,
    borderLeftColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  collectLineMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  collectCode: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '900',
  },
  collectName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  collectMeta: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '900',
  },
  quantityBox: {
    minWidth: 74,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
  },
  quantityValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
  },
  quantityLabel: {
    color: colors.accentDark,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  doneBadge: {
    minWidth: 44,
    overflow: 'hidden',
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    color: colors.success,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    paddingVertical: 8,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  footerButton: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    paddingHorizontal: 8,
  },
  footerButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  message: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '900',
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '900',
  },
  emptyPanel: {
    minHeight: 130,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    padding: 12,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
});
