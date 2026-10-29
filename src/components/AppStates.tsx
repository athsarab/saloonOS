import { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { iconSize, radius, spacing, type } from '../theme/tokens';
import { AppButton } from './AppButton';

export function AppLoadingState({ label = 'Loading…', compact }: { label?: string; compact?: boolean }) {
  const { colors } = useTheme();
  return (
    <View accessibilityLiveRegion="polite" style={[styles.state, compact && styles.compact]}>
      <ActivityIndicator color={colors.primary} />
      <Text style={[type.caption, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

type AppEmptyStateProps = { title: string; description?: string; icon?: ReactNode; action?: ReactNode; compact?: boolean };

export function AppEmptyState({ title, description, icon, action, compact }: AppEmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.state, compact && styles.compact]}>
      {icon}
      <Text style={[type.bodyStrong, styles.center, { color: colors.text }]}>{title}</Text>
      {description ? <Text style={[type.caption, styles.center, styles.copy, { color: colors.textMuted }]}>{description}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

type AppErrorStateProps = { title?: string; message?: string; onRetry?: () => void; retrying?: boolean; compact?: boolean };

export function AppErrorState({ title = 'Something went wrong', message = 'Check your connection and try again.', onRetry, retrying, compact }: AppErrorStateProps) {
  const { colors } = useTheme();
  return (
    <View accessibilityLiveRegion="polite" style={[styles.state, compact && styles.compact]}>
      <AlertCircle color={colors.danger} size={iconSize.lg} />
      <Text style={[type.bodyStrong, styles.center, { color: colors.text }]}>{title}</Text>
      <Text style={[type.caption, styles.center, styles.copy, { color: colors.textMuted }]}>{message}</Text>
      {onRetry ? <View style={styles.action}><AppButton label="Try again" variant="secondary" size="sm" fullWidth={false} loading={retrying} onPress={onRetry} /></View> : null}
    </View>
  );
}

/** Inline error block for forms and panels. */
export function AppInlineError({ message }: { message?: string }) {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={[styles.inline, { backgroundColor: colors.dangerSoft }]}>
      <AlertCircle color={colors.danger} size={iconSize.md} />
      <Text style={[type.caption, styles.inlineText, { color: colors.danger }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', gap: spacing.sm, justifyContent: 'center', minHeight: 160, padding: spacing.xxl },
  compact: { minHeight: 0, paddingVertical: spacing.xl },
  center: { textAlign: 'center' },
  copy: { maxWidth: 320 },
  action: { marginTop: spacing.sm },
  inline: { alignItems: 'flex-start', borderRadius: radius.md, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  inlineText: { flex: 1 },
});
