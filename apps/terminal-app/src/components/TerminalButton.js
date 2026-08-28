import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../styles/theme';

export function TerminalButton({ label, onPress, variant = 'primary', disabled = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[
        styles.text,
        variant === 'primary' && styles.primaryText,
        variant === 'success' && styles.successText,
        variant === 'secondary' && styles.secondaryText,
        variant === 'danger' && styles.dangerText,
        disabled && styles.disabledText,
      ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accentDark,
  },
  success: {
    backgroundColor: '#15803d',
    borderColor: '#166534',
  },
  secondary: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.danger,
    borderColor: '#7f1d1d',
  },
  disabled: {
    backgroundColor: colors.disabled,
    borderColor: colors.disabled,
  },
  pressed: {
    opacity: 0.75,
  },
  text: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  primaryText: {
    color: colors.headerText,
  },
  successText: {
    color: colors.headerText,
  },
  secondaryText: {
    color: colors.text,
  },
  dangerText: {
    color: colors.headerText,
  },
  disabledText: {
    color: colors.muted,
  },
});
