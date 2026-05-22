import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../styles/theme';

export function InfoRow({ label, value, tone = 'normal' }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, tone === 'danger' && styles.danger, tone === 'success' && styles.success]}>
        {value || '-'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 34,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  value: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
  },
  danger: {
    color: colors.danger,
  },
  success: {
    color: colors.success,
  },
});
