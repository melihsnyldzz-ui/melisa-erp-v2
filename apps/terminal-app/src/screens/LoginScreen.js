import { useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { TerminalButton } from '../components/TerminalButton';
import { terminalConfig } from '../config/env';
import { colors } from '../styles/theme';

export function LoginScreen({ onLogin, syncState }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError('');
    setSubmitting(true);

    try {
      await onLogin({ username: username.trim(), password });
    } catch (submitError) {
      setError(submitError.message || 'Giris basarisiz');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Melisa Terminal v2</Text>
        <Text style={styles.subtitle}>{terminalConfig.terminalCode} / {terminalConfig.deviceName}</Text>

        <View style={styles.statusStrip}>
          <Text style={[styles.statusText, syncState.online ? styles.online : styles.offline]}>
            {syncState.online ? 'API ONLINE' : 'API OFFLINE'}
          </Text>
          <Text style={styles.statusMeta}>{terminalConfig.apiBaseUrl}</Text>
        </View>

        <Text style={styles.label}>Kullanici adi</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
          style={styles.input}
          placeholder="admin"
          returnKeyType="next"
        />

        <Text style={styles.label}>Sifre</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          placeholder="Sifre"
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={submit}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TerminalButton label={submitting ? 'Giris yapiliyor' : 'Giris'} onPress={submit} disabled={submitting} />
        {submitting ? <ActivityIndicator style={styles.loader} color={colors.accentDark} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.header,
    padding: 16,
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 6,
    padding: 16,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  statusStrip: {
    marginVertical: 14,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: '#ffffff',
    padding: 10,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '900',
  },
  statusMeta: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 11,
  },
  online: {
    color: colors.success,
  },
  offline: {
    color: colors.danger,
  },
  label: {
    marginTop: 10,
    marginBottom: 4,
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    minHeight: 52,
    borderColor: colors.borderDark,
    borderWidth: 1,
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    paddingHorizontal: 12,
  },
  error: {
    marginVertical: 10,
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
  },
  loader: {
    marginTop: 12,
  },
});
