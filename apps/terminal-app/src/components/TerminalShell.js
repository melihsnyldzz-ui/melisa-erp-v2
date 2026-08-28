import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../styles/theme';

export function TerminalShell({ title, subtitle, session, syncState, children, hideScreenHeader = false, hideOperationalChrome = false }) {
  return (
    <View style={styles.shell}>
      {!hideScreenHeader ? (
        <View style={styles.screenHeader}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}

      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: colors.background,
  },
  screenHeader: {
    backgroundColor: colors.white,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  body: {
    flex: 1,
  },
});
