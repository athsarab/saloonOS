import { ReactNode, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Building2, ChartColumn, LogOut, Palette, ReceiptText, RefreshCw, Repeat, ShieldCheck, Wallet } from 'lucide-react-native';
import { AppBottomSheet } from '../../src/components/AppBottomSheet';
import { AppCard } from '../../src/components/AppCard';
import { AppDialog } from '../../src/components/AppDialog';
import { AppHeader } from '../../src/components/AppHeader';
import { AppListIcon, AppListItem } from '../../src/components/AppListItem';
import { AppSectionHeader } from '../../src/components/AppSectionHeader';
import { AppStatusBadge } from '../../src/components/AppStatusBadge';
import { ProfileAvatar } from '../../src/components/ProfileAvatar';
import { AppThemeSelector } from '../../src/components/AppThemeSelector';
import { Screen } from '../../src/components/ui';
import { useAuthStore } from '../../src/lib/auth';
import { roleLabel, usePermissions } from '../../src/lib/permissions';
import { useBusinessProfile } from '../../src/lib/salon-api';
import { offlineSupported, useOffline } from '../../src/offline/runtime';
import { useTheme } from '../../src/theme/ThemeProvider';
import { iconSize, layout, spacing, type } from '../../src/theme/tokens';

type Entry = { key: string; title: string; subtitle: string; icon: typeof ReceiptText; onPress: () => void; trailing?: ReactNode };

export default function MoreScreen() {
  const { colors } = useTheme();
  const { role, can } = usePermissions();
  const profile = useBusinessProfile();
  const tenants = useAuthStore((state) => state.tenants);
  const logout = useAuthStore((state) => state.logout);
  const unsynced = useOffline((state) => state.items.filter((item) => item.state !== 'synchronized').length);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const user = useAuthStore((state) => state.user);

  const business: Entry[] = [
    ...(can('checkout') ? [{
      key: 'sales', title: can('reports.read') ? 'Sales & reports' : 'Sales history', icon: can('reports.read') ? ChartColumn : ReceiptText,
      subtitle: can('reports.read') ? 'Receipts, refunds and daily totals' : 'Receipts and transaction history',
      onPress: () => router.push('/(app)/sales'),
    }, {
      key: 'shift', title: 'Cash shift', icon: Wallet, subtitle: 'Open or close the cash drawer in POS',
      onPress: () => router.navigate('/(app)/checkout'),
    }] : []),
    ...(offlineSupported && can('checkout') ? [{
      key: 'sync', title: 'Offline & sync', icon: RefreshCw, subtitle: 'Offline cash till and queued sales',
      onPress: () => router.push('/(app)/sync'),
      trailing: unsynced ? <AppStatusBadge label={`${unsynced} pending`} tone="warning" /> : undefined,
    }] : []),
  ];

  const settings: Entry[] = [
    { key: 'appearance', title: 'Appearance', subtitle: 'Choose your preferred look', icon: Palette, onPress: () => setAppearanceOpen(true) },
    { key: 'business', title: 'Business settings', subtitle: 'Manage your salon workspace', icon: Building2, onPress: () => router.push('/(app)/settings') },
    { key: 'security', title: 'Account & security', subtitle: 'Protect your account', icon: ShieldCheck,  onPress: () => router.push('/(app)/account-security') },
    ...(tenants.length > 1 ? [{ key: 'switch', title: 'Switch business', icon: Repeat, subtitle: `${tenants.length} businesses on this account`, onPress: () => router.push('/business-selection') }] : []),
  ];

  const signOut = async () => {
    setSigningOut(true);
    // Local tokens are always cleared, even if the server can't be reached.
    try { await logout(); } catch { /* signed out locally */ } finally { setSigningOut(false); setConfirmSignOut(false); }
  };

  const group = (title: string, entries: Entry[]) => entries.length ? (
    <View style={styles.group}>
      <AppSectionHeader title={title} />
      <AppCard padded={false}>
        {entries.map((entry, index) => (
          <AppListItem
            key={entry.key}
            divider={index > 0}
            title={entry.title}
            subtitle={entry.subtitle}
            trailing={entry.trailing}
            leading={<AppListIcon><entry.icon color={colors.primary} size={iconSize.md} /></AppListIcon>}
            onPress={entry.onPress}
          />
        ))}
      </AppCard>
    </View>
  ) : null;

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content}>
          <AppHeader title="Profile" description="Your account and salon workspace" />
          <AppCard muted>
            <View style={styles.profileHeader}>
              <ProfileAvatar name={user?.displayName ?? profile.data?.name} onPress={() => setAvatarOpen(true)} />
              <View style={styles.profileCopy}>
                <Text numberOfLines={1} style={[type.heading, { color: colors.text }]}>{user?.displayName ?? 'SalonOS account'}</Text>
                {user?.email ? <Text numberOfLines={1} style={[type.caption, { color: colors.textMuted }]}>{user.email}</Text> : null}
                <Text numberOfLines={1} style={[type.caption, { color: colors.textMuted }]}>{profile.data?.name ?? (profile.isPending ? 'Loading business…' : 'Your business')}</Text>
              </View>
              {role ? <AppStatusBadge label={roleLabel[role]} tone="accent" /> : null}
            </View>
          </AppCard>
          {group('Business', business)}
          {group('Settings', settings)}
          <AppCard padded={false}>
            <AppListItem
              title="Sign out"
              destructive
              chevron={false}
              leading={<AppListIcon tone="danger"><LogOut color={colors.danger} size={iconSize.md} /></AppListIcon>}
              onPress={() => setConfirmSignOut(true)}
            />
          </AppCard>
          <Text style={[type.caption, styles.version, { color: colors.textSubtle }]}>SalonOS {Constants.expoConfig?.version ?? ''}</Text>
        </ScrollView>
      </SafeAreaView>
      <AppDialog
        visible={confirmSignOut}
        title="Sign out of SalonOS?"
        message={unsynced ? `${unsynced} offline cash ${unsynced === 1 ? 'sale has' : 'sales have'} not synchronized. They stay on this device, but offline checkout will be locked until you sign in and prepare it again.` : 'You’ll need your email and password to sign back in.'}
        confirmLabel="Sign out"
        tone="danger"
        loading={signingOut}
        onConfirm={() => void signOut()}
        onCancel={() => setConfirmSignOut(false)}
      />
      <AppBottomSheet visible={appearanceOpen} title="Appearance" onClose={() => setAppearanceOpen(false)}>
        <Text style={[type.body, { color: colors.textMuted }]}>Choose the look that works best for your shift. Changes apply immediately.</Text>
        <AppThemeSelector />
      </AppBottomSheet>
      <AppBottomSheet visible={avatarOpen} title="Profile avatar" onClose={() => setAvatarOpen(false)}>
        <Text style={[type.body, { color: colors.textMuted }]}>Your initials are used as your profile avatar. Photo uploads are not enabled by the current account service yet.</Text>
      </AppBottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing.xxl, padding: spacing.lg, paddingBottom: layout.screenBottomInset },
  profileHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  profileCopy: { flex: 1, gap: spacing.xs },
  group: { gap: spacing.sm },
  version: { textAlign: 'center' },
});
