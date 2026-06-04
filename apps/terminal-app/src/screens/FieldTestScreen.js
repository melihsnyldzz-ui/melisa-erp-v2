import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { InfoRow } from '../components/InfoRow';
import { TerminalButton } from '../components/TerminalButton';
import { colors } from '../styles/theme';

const testItems = [
  {
    key: 'api',
    title: 'API baglantisi',
    note: 'Ayarlar veya ana ekranda API online gorunmeli.',
  },
  {
    key: 'data',
    title: 'Veri guncelle',
    note: 'Urun ve cari cache sayilari guncellenmeli.',
  },
  {
    key: 'customer',
    title: 'Pesin cari secimi',
    note: 'TRY/USD/EUR pesin cari veya gercek musteri secilmeli.',
  },
  {
    key: 'barcode',
    title: 'Barkod okutma',
    note: 'Barkod okutunca urun detayi ya API ya cache uzerinden gelmeli.',
  },
  {
    key: 'offline',
    title: 'Offline satis queue',
    note: 'Baglanti yokken tamamlanan satis bekleyen kuyruya alinmali.',
  },
  {
    key: 'sync',
    title: 'Tekrar online sync',
    note: 'Baglanti gelince bekleyenler gonderilmeli.',
  },
  {
    key: 'duplicate',
    title: 'Duplicate gonderim kontrolu',
    note: 'Ayni client event tekrar gonderilirse ikinci fis olusmamali.',
  },
];

export function FieldTestScreen({ navigation, syncState }) {
  const [checked, setChecked] = useState({});

  const completedCount = useMemo(
    () => Object.values(checked).filter(Boolean).length,
    [checked],
  );

  const toggle = (key) => {
    setChecked((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.panelDark}>
        <Text style={styles.heroLabel}>Saha test durumu</Text>
        <Text style={styles.heroTitle}>{completedCount}/{testItems.length} adim</Text>
        <Text style={styles.heroText}>Telefon testini sonra yapacagiz; bu ekran simdilik uygulama ici akisi netlestirir.</Text>
      </View>

      <View style={styles.statusPanel}>
        <InfoRow label="API" value={syncState.online ? 'Online' : 'Offline'} tone={syncState.online ? 'success' : 'danger'} />
        <InfoRow label="Bekleyen satis" value={String(syncState.salePendingCount || 0)} />
        <InfoRow label="Hatali satis" value={String(syncState.saleFailedCount || 0)} tone={syncState.saleFailedCount ? 'danger' : 'success'} />
        <InfoRow label="Urun cache" value={String(syncState.productCount || 0)} />
        <InfoRow label="Cari cache" value={String(syncState.customerCount || 0)} />
      </View>

      <View style={styles.checklist}>
        {testItems.map((item) => {
          const isDone = Boolean(checked[item.key]);
          return (
            <Pressable
              key={item.key}
              onPress={() => toggle(item.key)}
              style={[styles.checkItem, isDone && styles.checkItemDone]}
            >
              <View style={[styles.checkBox, isDone && styles.checkBoxDone]}>
                <Text style={styles.checkMark}>{isDone ? 'OK' : ''}</Text>
              </View>
              <View style={styles.checkText}>
                <Text style={styles.checkTitle}>{item.title}</Text>
                <Text style={styles.checkNote}>{item.note}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <TerminalButton label="Tumunu sifirla" onPress={() => setChecked({})} variant="secondary" />
      <TerminalButton label="Ana ekran" onPress={navigation.goHome} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 12,
    gap: 10,
  },
  panelDark: {
    backgroundColor: colors.panelDark,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 4,
    padding: 14,
  },
  heroLabel: {
    color: colors.headerSubtle,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.headerText,
    fontSize: 26,
    fontWeight: '900',
    marginTop: 4,
  },
  heroText: {
    color: colors.headerSubtle,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: 6,
  },
  statusPanel: {
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  checklist: {
    gap: 8,
  },
  checkItem: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 4,
    padding: 10,
  },
  checkItemDone: {
    backgroundColor: '#ecfff3',
    borderColor: colors.success,
  },
  checkBox: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.borderDark,
    backgroundColor: colors.panel,
  },
  checkBoxDone: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  checkMark: {
    color: colors.headerText,
    fontSize: 13,
    fontWeight: '900',
  },
  checkText: {
    flex: 1,
  },
  checkTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  checkNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    marginTop: 3,
  },
});
