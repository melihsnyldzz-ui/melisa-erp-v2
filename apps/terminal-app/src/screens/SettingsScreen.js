import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { TerminalButton } from '../components/TerminalButton';
import { getActiveApiBaseUrl, getRuntimeSettings, resetRuntimeSettings, saveRuntimeSettings, terminalConfig } from '../config/env';
import { pingApi } from '../services/apiClient';
import { colors } from '../styles/theme';

export function SettingsScreen({ navigation, onRefresh }) {
  const [apiBaseUrl, setApiBaseUrl] = useState(terminalConfig.apiBaseUrl);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const settings = await getRuntimeSettings();
      const activeUrl = await getActiveApiBaseUrl();
      setApiBaseUrl(settings.apiBaseUrl || activeUrl);
    }

    load();
  }, []);

  async function save() {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const saved = await saveRuntimeSettings({ apiBaseUrl });
      setApiBaseUrl(saved.apiBaseUrl);
      setMessage('API adresi kaydedildi');
      await onRefresh();
    } catch (saveError) {
      setError(saveError.message || 'Ayar kaydedilemedi');
    } finally {
      setLoading(false);
    }
  }

  async function testConnection() {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await saveRuntimeSettings({ apiBaseUrl });
      const result = await pingApi();
      if (result.online) {
        setMessage('API baglantisi basarili');
      } else {
        setError(result.message || 'API baglantisi yok');
      }
      await onRefresh();
    } catch (testError) {
      setError(testError.message || 'API testi basarisiz');
    } finally {
      setLoading(false);
    }
  }

  async function reset() {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await resetRuntimeSettings();
      setApiBaseUrl(terminalConfig.apiBaseUrl);
      setMessage('Varsayilan API adresine donuldu');
      await onRefresh();
    } catch (resetError) {
      setError(resetError.message || 'Ayar sifirlanamadi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.panel}>
        <Text style={styles.title}>API Baglantisi</Text>
        <Text style={styles.meta}>Telefon ayni Wi-Fi agindaysa PC IP adresini kullanin.</Text>

        <Text style={styles.label}>API adresi</Text>
        <TextInput
          value={apiBaseUrl}
          onChangeText={setApiBaseUrl}
          style={styles.input}
          placeholder="http://192.168.1.47:4100"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.help}>/api yazsaniz bile uygulama tekrar /api/api yapmaz.</Text>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.accentDark} /> : null}

      <TerminalButton label="Kaydet" onPress={save} disabled={loading} />
      <TerminalButton label="Baglantiyi Test Et" onPress={testConnection} disabled={loading} variant="secondary" />
      <TerminalButton label="Varsayilana Don" onPress={reset} disabled={loading} variant="secondary" />
      <TerminalButton label="Ana ekran" onPress={navigation.goHome} variant="secondary" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 12,
    gap: 10,
  },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  input: {
    minHeight: 56,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    paddingHorizontal: 10,
  },
  help: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  message: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '900',
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '900',
  },
});
