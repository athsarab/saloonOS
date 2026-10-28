import { useRef, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { Store } from 'lucide-react-native';
import { AppButton } from '../src/components/AppButton';
import { AppCard } from '../src/components/AppCard';
import { AppListIcon, AppListItem } from '../src/components/AppListItem';
import { AppEmptyState, AppInlineError, AppLoadingState } from '../src/components/AppStates';
import { AuthLayout } from '../src/components/AuthLayout';
import { Screen } from '../src/components/ui';
import { apiRequest, setAccessToken } from '../src/lib/api';
import { useAuthStore } from '../src/lib/auth';
import { friendlyError } from '../src/lib/errors';
import { Role, roleLabel } from '../src/lib/permissions';
import { useTheme } from '../src/theme/ThemeProvider';
import { iconSize } from '../src/theme/tokens';

export default function BusinessSelectionScreen() {
  const { colors } = useTheme();
  const { tenants, hydrated, accessToken } = useAuthStore();
  const [choosing, setChoosing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  if (!hydrated) return <Screen><AppLoadingState label="Restoring your secure session…" /></Screen>;
  if (!accessToken) return <Redirect href="/login" />;

  const choose = async (tenantId: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setChoosing(tenantId);
    setError('');
    try {
      const session = await apiRequest<{ accessToken: string }>('/v1/auth/select-tenant', { method: 'POST', body: JSON.stringify({ tenantId }) });
      await setAccessToken(session.accessToken);
      useAuthStore.setState({ accessToken: session.accessToken });
      router.replace('/(app)');
    } catch (failure) {
      setError(friendlyError(failure, { fallback: 'We couldn’t open that business. Please try again.', byStatus: { 401: 'You no longer have access to that business. Choose another or sign in again.' } }));
    } finally {
      inFlight.current = false;
      setChoosing(null);
    }
  };

  return (
    <AuthLayout title="Choose a business" description="Your account belongs to more than one business. Pick the one you’re working in now — you can switch later from More.">
      {tenants.length ? (
        <AppCard padded={false}>
          {tenants.map((tenant, index) => (
            <AppListItem
              key={tenant.id}
              divider={index > 0}
              title={tenant.name}
              subtitle={roleLabel[tenant.role as Role] ?? tenant.role}
              leading={<AppListIcon><Store color={colors.primary} size={iconSize.md} /></AppListIcon>}
              trailing={choosing === tenant.id ? <ActivityIndicator color={colors.primary} /> : undefined}
              chevron={choosing !== tenant.id}
              onPress={choosing ? undefined : () => void choose(tenant.id)}
            />
          ))}
        </AppCard>
      ) : (
        <AppEmptyState
          title="Continue to your workspace"
          description="The business list isn’t available after the app restarts. Continue with your current business, or sign in again to choose another."
          action={<AppButton label="Continue" fullWidth={false} onPress={() => router.replace('/(app)')} />}
        />
      )}
      <AppInlineError message={error} />
    </AuthLayout>
  );
}
