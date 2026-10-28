import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight, CloudOff, RefreshCw } from 'lucide-react-native';
import { offlineSupported, useOffline } from '../offline/runtime';
import { useTheme } from '../theme/ThemeProvider';
import { iconSize, spacing, type } from '../theme/tokens';

/** Connectivity and unsynchronized-cash notice. Renders nothing when everything is healthy. */
export function AppOfflineBanner() {
  const { colors } = useTheme();
  const { apiOnline, checking, items, error, syncing } = useOffline();
  const pending = items.filter((item) => item.state !== 'synchronized').length;
  const offline = !apiOnline && !checking;
  if (!offline && !pending && !(offlineSupported && error)) return null;

  const title = offline ? 'Offline · server unreachable' : syncing ? 'Synchronizing cash sales…' : pending ? 'Cash sales need attention' : 'Sync problem';
  const detail = pending
    ? `${pending} offline cash ${pending === 1 ? 'sale is' : 'sales are'} not yet confirmed. Receipts stay provisional.`
    : offline ? 'Changes can’t be saved until the connection returns.' : error;
  const tone = pending || error ? { bg: colors.warningSoft, fg: colors.warning } : { bg: colors.surfaceMuted, fg: colors.textMuted };
  const Icon = syncing ? RefreshCw : CloudOff;

  const content = (
    <>
      <Icon color={tone.fg} size={iconSize.md} />
      <View style={styles.copy}>
        <Text style={[type.label, { color: colors.text }]}>{title}</Text>
        {detail ? <Text numberOfLines={2} style={[type.caption, { color: colors.textMuted }]}>{detail}</Text> : null}
      </View>
      {offlineSupported ? <ChevronRight color={colors.textMuted} size={iconSize.md} /> : null}
    </>
  );

  if (!offlineSupported) return <View accessibilityLiveRegion="polite" style={[styles.banner, { backgroundColor: tone.bg }]}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail ?? ''} Open sync status.`}
      accessibilityLiveRegion="polite"
      onPress={() => router.push('/(app)/sync')}
      style={({ pressed }) => [styles.banner, { backgroundColor: tone.bg, opacity: pressed ? 0.85 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  copy: { flex: 1, gap: spacing.xxs },
});
