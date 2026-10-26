import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useOffline, offlineSupported } from '../offline/runtime';
import { useTheme } from '../theme/ThemeProvider';
export function OfflineBanner() {
  const { colors } = useTheme();
  const state = useOffline();
  const pending = state.items.filter(item => item.state !== 'synchronized').length;
  if (!offlineSupported || (state.apiOnline && !pending && !state.error)) return null;
  return <Pressable accessibilityRole="button" onPress={() => router.push('/(app)/sync')} style={[styles.banner, { backgroundColor: colors.primarySoft }]}>
    <Text style={{ color: colors.text, fontWeight: '700' }}>{state.checking ? 'Checking API connectivity' : state.apiOnline ? 'Online' : 'OFFLINE / API unreachable'}{pending ? ' / ' + pending + ' cash operations need attention' : ''}</Text>
    <Text style={{ color: colors.textMuted }}>Open Sync Status. Offline receipts remain provisional.</Text>
  </Pressable>;
}
const styles = StyleSheet.create({ banner: { padding: 12, gap: 4, minHeight: 56 } });
