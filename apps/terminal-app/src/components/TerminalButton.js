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
      <Text style={[styles.text, variant === 'secondary' && styles.secondaryText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: 4,
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
  secondary: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.danger,
    borderColor: '#6f1e1e',
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
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  secondaryText: {
    color: colors.text,
  },
});
