import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KeyboardSafeScrollView, KeyboardSafeTextInput } from '../components/KeyboardSafeScrollView';
import { TerminalButton } from '../components/TerminalButton';
import {
  getActiveApiBaseUrl,
  normalizeApiBaseUrl,
  saveRuntimeSettings,
  terminalConfig,
} from '../config/env';
import { listTerminalUsers } from '../services/authService';
import { colors } from '../styles/theme';

function prepareApiBaseUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  return normalizeApiBaseUrl(withProtocol);
}

function isValidApiBaseUrl(value) {
  return /^https?:\/\/[^\s/]+(?::\d+)?$/i.test(value);
}

export function LoginScreen({ onLogin, onApiBaseUrlChange, syncState }) {
  const [apiBaseUrl, setApiBaseUrl] = useState(terminalConfig.apiBaseUrl);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiMessage, setApiMessage] = useState('');
  const [apiSaving, setApiSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUsername, setSelectedUsername] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      const activeUrl = await getActiveApiBaseUrl();
      if (!mounted) return;
      if (activeUrl) setApiBaseUrl(activeUrl);

      setUsersLoading(true);
      try {
        const result = await listTerminalUsers();
        if (!mounted) return;
        setUsers(result.users);
        setSelectedUsername((current) => (
          result.users.some((user) => user.username === current)
            ? current
            : ''
        ));
      } catch (loadError) {
        if (mounted) setError(loadError.message || 'Terminal kullanicilari alinamadi');
      } finally {
        if (mounted) setUsersLoading(false);
      }
    }

    initialize();
    return () => {
      mounted = false;
    };
  }, []);

  async function persistApiBaseUrl({ testConnection = false, showMessage = false } = {}) {
    const normalized = prepareApiBaseUrl(apiBaseUrl);
    if (!isValidApiBaseUrl(normalized)) {
      throw new Error('Gecerli bir API adresi girin. Ornek: 10.0.2.2:4100');
    }

    const saved = await saveRuntimeSettings({ apiBaseUrl: normalized });
    setApiBaseUrl(saved.apiBaseUrl);

    if (testConnection && onApiBaseUrlChange) {
      await onApiBaseUrlChange(saved.apiBaseUrl);
    }
    if (showMessage) setApiMessage('API adresi kaydedildi ve baglanti denetlendi.');
    return saved.apiBaseUrl;
  }

  async function loadUsers({ showMessage = false } = {}) {
    setUsersLoading(true);
    try {
      const result = await listTerminalUsers();
      setUsers(result.users);
      setSelectedUsername((current) => (
        result.users.some((user) => user.username === current)
          ? current
          : ''
      ));
      if (showMessage) setApiMessage(`${result.users.length} terminal kullanicisi yuklendi.`);
    } finally {
      setUsersLoading(false);
    }
  }

  async function saveAndTestApi() {
    setError('');
    setApiMessage('');
    setApiSaving(true);
    try {
      await persistApiBaseUrl({ testConnection: true, showMessage: true });
      await loadUsers();
      setSettingsOpen(false);
    } catch (saveError) {
      setError(saveError.message || 'API adresi kaydedilemedi');
    } finally {
      setApiSaving(false);
    }
  }

  async function refreshUsers() {
    setError('');
    setApiMessage('');
    try {
      await persistApiBaseUrl();
      await loadUsers({ showMessage: true });
    } catch (loadError) {
      setError(loadError.message || 'Terminal kullanicilari alinamadi');
    }
  }

  async function submit() {
    setError('');
    setApiMessage('');
    if (!selectedUsername) {
      setError('Once personelinizi secin.');
      return;
    }
    if (!password) {
      setError('Sifre zorunludur.');
      return;
    }

    setSubmitting(true);
    try {
      await persistApiBaseUrl();
      await onLogin({ username: selectedUsername, password });
    } catch (submitError) {
      setError(submitError.message || 'Giris basarisiz');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardSafeScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}><Text style={styles.brandMarkText}>M</Text></View>
              <View style={styles.brandText}>
                <Text style={styles.title}>Melisa Terminal</Text>
                <Text style={styles.subtitle}>{terminalConfig.deviceName}</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Baglanti ayarlari"
              onPress={() => {
                setSettingsOpen((current) => !current);
                setApiMessage('');
                setError('');
              }}
              style={({ pressed }) => [
                styles.settingsButton,
                settingsOpen && styles.settingsButtonActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.settingsIcon, settingsOpen && styles.settingsIconActive]}>⚙</Text>
              <Text style={[styles.settingsText, settingsOpen && styles.settingsTextActive]}>Ayarlar</Text>
            </Pressable>
          </View>

          <View style={styles.connectionRow}>
            <View style={[styles.connectionDot, syncState.online ? styles.connectionDotOnline : styles.connectionDotOffline]} />
            <Text style={[styles.connectionText, syncState.online ? styles.online : styles.offline]}>
              {syncState.online ? 'Baglanti hazir' : 'Baglanti yok'}
            </Text>
            <Text style={styles.connectionDivider}>•</Text>
            <Text style={styles.terminalCode}>{terminalConfig.terminalCode}</Text>
          </View>

          {settingsOpen ? (
            <View style={styles.settingsPanel}>
              <View style={styles.settingsPanelHeader}>
                <View style={styles.settingsPanelIcon}><Text style={styles.settingsPanelIconText}>⚙</Text></View>
                <View style={styles.settingsPanelHeading}>
                  <Text style={styles.settingsPanelTitle}>Baglanti ayarlari</Text>
                  <Text style={styles.settingsPanelSubtitle}>Terminalin ERP sunucusuna ulasacagi adresi belirleyin.</Text>
                </View>
              </View>
              <Text style={styles.label}>Sunucu / API adresi</Text>
              <KeyboardSafeTextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                value={apiBaseUrl}
                onChangeText={setApiBaseUrl}
                style={[styles.input, styles.apiInput]}
                placeholder="192.168.1.46:4100"
                placeholderTextColor={colors.muted}
                returnKeyType="done"
                onSubmitEditing={saveAndTestApi}
              />
              <Text style={styles.apiHint}>Telefon: bilgisayar IP adresi + 4100  •  Emulator: 10.0.2.2:4100</Text>
              <TerminalButton
                label={apiSaving ? 'Baglanti denetleniyor' : 'Kaydet ve Baglantiyi Test Et'}
                onPress={saveAndTestApi}
                disabled={apiSaving || submitting}
                variant="secondary"
              />
              {apiMessage ? <Text style={styles.success}>{apiMessage}</Text> : null}
            </View>
          ) : null}

          <View style={styles.loginIntro}>
            <Text style={styles.eyebrow}>PERSONEL GIRISI</Text>
            <Text style={styles.loginTitle}>Kim giris yapiyor?</Text>
            <Text style={styles.loginSubtitle}>Personelinizi secin. Ardindan size ait sifre alani acilacaktir.</Text>
          </View>

          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionLabel}>Personel secin</Text>
            <Pressable onPress={refreshUsers} disabled={usersLoading || submitting}>
              <Text style={styles.refreshText}>{usersLoading ? 'Yukleniyor...' : 'Listeyi yenile'}</Text>
            </Pressable>
          </View>
          {usersLoading ? <ActivityIndicator style={styles.userLoader} color={colors.accentDark} /> : null}
          {!usersLoading && users.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Terminal personeli bulunamadi</Text>
              <Text style={styles.emptyText}>
                ERP Personel Tanimlari ekraninda personeli, kullanici adini ve ilk sifresini birlikte kaydedin.
              </Text>
            </View>
          ) : null}
          <View style={styles.userList}>
            {users.map((user) => {
              const selected = selectedUsername === user.username;
              return (
                <Pressable
                  key={user.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${user.displayName || user.username} personelini sec`}
                  onPress={() => {
                    setSelectedUsername(user.username);
                    setPassword('');
                    setError('');
                  }}
                  style={[styles.userOption, selected && styles.userOptionSelected]}
                >
                  <View style={[styles.avatar, selected && styles.avatarSelected]}>
                    <Text style={[styles.avatarText, selected && styles.avatarTextSelected]}>
                      {(user.displayName || user.username).trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userText}>
                    <Text style={styles.userDisplayName}>{user.displayName || user.username}</Text>
                    <Text style={styles.userName}>@{user.username}</Text>
                  </View>
                  <View style={[styles.selectionMark, selected && styles.selectionMarkSelected]}>
                    <Text style={[styles.selectionMarkText, selected && styles.selectionMarkTextSelected]}>{selected ? '✓' : '›'}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {selectedUsername ? (
            <View style={styles.passwordPanel}>
              <View style={styles.passwordHeader}>
                <View>
                  <Text style={styles.passwordEyebrow}>SECILEN PERSONEL</Text>
                  <Text style={styles.passwordPerson}>
                    {users.find((user) => user.username === selectedUsername)?.displayName || selectedUsername}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setSelectedUsername('');
                    setPassword('');
                    setError('');
                  }}
                  style={styles.changePersonButton}
                >
                  <Text style={styles.changePersonText}>Degistir</Text>
                </Pressable>
              </View>
              <Text style={styles.passwordLabel}>Personel sifresi</Text>
              <KeyboardSafeTextInput
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                placeholder="Sifrenizi girin"
                placeholderTextColor={colors.muted}
                secureTextEntry
                returnKeyType="go"
                onSubmitEditing={submit}
                editable={!submitting}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TerminalButton
                label={submitting ? 'Giris yapiliyor...' : 'Programa Gir'}
                onPress={submit}
                disabled={submitting || !password}
              />
              {submitting ? <ActivityIndicator style={styles.loader} color={colors.accentDark} /> : null}
            </View>
          ) : (
            <View style={styles.selectionHint}>
              <Text style={styles.selectionHintIcon}>↑</Text>
              <Text style={styles.selectionHintText}>Devam etmek icin personelinizi secin.</Text>
            </View>
          )}
          {!selectedUsername && error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.securityNote}>Guvenli personel oturumu  •  Yetkiler ERP tarafindan yonetilir</Text>
        </View>
      </KeyboardSafeScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef2f6' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 560, alignSelf: 'center', backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 20, boxShadow: '0 10px 24px rgba(15, 23, 42, 0.12)', elevation: 6 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.accent },
  brandMarkText: { color: colors.headerText, fontSize: 22, fontWeight: '900' },
  brandText: { flex: 1 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  subtitle: { marginTop: 3, color: colors.muted, fontSize: 12, fontWeight: '700' },
  settingsButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 6, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, backgroundColor: colors.panel },
  settingsButtonActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  settingsIcon: { color: colors.muted, fontSize: 16, fontWeight: '900' },
  settingsIconActive: { color: colors.accentDark },
  settingsText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  settingsTextActive: { color: colors.accentDark },
  pressed: { opacity: 0.7 },
  connectionRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', borderRadius: 10, backgroundColor: colors.panel, paddingHorizontal: 12, paddingVertical: 9 },
  connectionDot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  connectionDotOnline: { backgroundColor: colors.success },
  connectionDotOffline: { backgroundColor: colors.danger },
  connectionText: { fontSize: 12, fontWeight: '900' },
  connectionDivider: { marginHorizontal: 8, color: colors.borderDark, fontSize: 12 },
  terminalCode: { flex: 1, color: colors.muted, fontSize: 11, fontWeight: '800' },
  online: { color: colors.success },
  offline: { color: colors.danger },
  settingsPanel: { marginTop: 12, borderColor: '#b8d9d4', borderWidth: 1, borderRadius: 14, backgroundColor: '#f3fbf9', padding: 14, gap: 8 },
  settingsPanelHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  settingsPanelIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  settingsPanelIconText: { color: colors.accentDark, fontSize: 16, fontWeight: '900' },
  settingsPanelHeading: { flex: 1 },
  settingsPanelTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  settingsPanelSubtitle: { marginTop: 2, color: colors.muted, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  loginIntro: { marginTop: 22, marginBottom: 12 },
  eyebrow: { color: colors.accentDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  loginTitle: { marginTop: 5, color: colors.text, fontSize: 23, fontWeight: '900' },
  loginSubtitle: { marginTop: 5, color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  sectionLabel: { color: colors.text, fontSize: 13, fontWeight: '900' },
  label: { marginTop: 10, marginBottom: 4, color: colors.text, fontSize: 13, fontWeight: '800' },
  refreshText: { color: colors.accentDark, fontSize: 12, fontWeight: '900', padding: 7 },
  input: { minHeight: 52, borderColor: colors.borderDark, borderWidth: 1, borderRadius: 11, backgroundColor: colors.input, color: colors.text, fontSize: 17, fontWeight: '800', paddingHorizontal: 14 },
  apiInput: { minHeight: 48, fontSize: 15 },
  apiHint: { color: colors.muted, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  success: { marginTop: 7, color: colors.success, fontSize: 12, fontWeight: '800' },
  userLoader: { marginVertical: 12 },
  userList: { gap: 8 },
  userOption: { minHeight: 66, flexDirection: 'row', alignItems: 'center', borderColor: colors.border, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, backgroundColor: colors.white },
  userOptionSelected: { borderColor: colors.accent, borderWidth: 2, backgroundColor: colors.accentSoft },
  avatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 11, backgroundColor: '#e9eef5' },
  avatarSelected: { backgroundColor: colors.accent },
  avatarText: { color: colors.text, fontSize: 16, fontWeight: '900' },
  avatarTextSelected: { color: colors.white },
  userText: { flex: 1 },
  userDisplayName: { color: colors.text, fontSize: 15, fontWeight: '900' },
  userName: { marginTop: 2, color: colors.muted, fontSize: 11, fontWeight: '700' },
  selectionMark: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panel },
  selectionMarkSelected: { backgroundColor: colors.accent },
  selectionMarkText: { color: colors.muted, fontSize: 18, fontWeight: '900' },
  selectionMarkTextSelected: { color: colors.white, fontSize: 13 },
  emptyState: { borderColor: colors.border, borderWidth: 1, borderRadius: 12, backgroundColor: colors.panel, padding: 14 },
  emptyTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  emptyText: { marginTop: 5, color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  passwordPanel: { marginTop: 14, borderColor: '#b8d9d4', borderWidth: 1, borderRadius: 14, backgroundColor: '#f7fcfb', padding: 14, gap: 8 },
  passwordHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 2 },
  passwordEyebrow: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  passwordPerson: { marginTop: 3, color: colors.text, fontSize: 17, fontWeight: '900' },
  changePersonButton: { borderColor: colors.border, borderWidth: 1, borderRadius: 9, backgroundColor: colors.white, paddingHorizontal: 10, paddingVertical: 7 },
  changePersonText: { color: colors.accentDark, fontSize: 11, fontWeight: '900' },
  passwordLabel: { color: colors.text, fontSize: 12, fontWeight: '900' },
  selectionHint: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderColor: colors.border, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, backgroundColor: colors.panel, padding: 13 },
  selectionHintIcon: { color: colors.accentDark, fontSize: 17, fontWeight: '900' },
  selectionHintText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  error: { marginVertical: 5, color: colors.danger, fontSize: 13, fontWeight: '800' },
  loader: { marginTop: 12 },
  securityNote: { marginTop: 18, color: colors.muted, fontSize: 10, textAlign: 'center', fontWeight: '700' },
});
