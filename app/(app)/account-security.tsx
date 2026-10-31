import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppDialog } from '../../src/components/AppDialog';
import { AppHeader } from '../../src/components/AppHeader';
import { AppInlineError } from '../../src/components/AppStates';
import { Screen } from '../../src/components/ui';
import { apiRequest } from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/auth';
import { friendlyError } from '../../src/lib/errors';
import { useTheme } from '../../src/theme/ThemeProvider';
import { layout, spacing, type } from '../../src/theme/tokens';

export default function AccountSecurityScreen() {
  const { colors } = useTheme();
  const logout = useAuthStore((state) => state.logout);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const logoutAll = async () => {
    setPending(true);
    setError('');
    try {
      await apiRequest('/v1/auth/logout-all', { method: 'POST' });
    } catch (failure) {
      // Sessions were not revoked on the server; keep the user signed in so they can retry.
      setError(friendlyError(failure, { fallback: 'Other devices could not be signed out. Please try again.' }));
      setPending(false);
      setConfirming(false);
      return;
    }
    try { await logout(); } catch { /* local session is cleared regardless */ }
  };

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content}>
          <AppHeader back title="Account & security" description="Control where your SalonOS account is signed in." />
          <AppCard>
            <Text style={[type.heading, { color: colors.text }]}>Signed-in devices</Text>
            <Text style={[type.body, { color: colors.textMuted }]}>Sign out everywhere if a phone is lost or someone else knows your password. Every device, including this one, will need to sign in again.</Text>
            <AppInlineError message={error} />
            <AppButton label="Sign out of all devices" variant="secondary" onPress={() => setConfirming(true)} />
          </AppCard>
          <AppCard>
            <Text style={[type.heading, { color: colors.text }]}>Password</Text>
            <Text style={[type.body, { color: colors.textMuted }]}>To change your password, request a reset link. We’ll email it to the address you sign in with.</Text>
            <AppButton label="Send a reset link" variant="ghost" fullWidth={false} onPress={() => router.push('/forgot-password')} />
          </AppCard>
        </ScrollView>
      </SafeAreaView>
      <AppDialog
        visible={confirming}
        title="Sign out of all devices?"
        message="All active sessions will end, including this one. Unsynchronized offline cash stays on its device."
        confirmLabel="Sign out all"
        tone="danger"
        loading={pending}
        onConfirm={() => void logoutAll()}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: layout.screenBottomInset },
});
