import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin } from 'lucide-react-native';
import { AppCard } from '../../src/components/AppCard';
import { AppHeader } from '../../src/components/AppHeader';
import { AppListIcon, AppListItem } from '../../src/components/AppListItem';
import { AppSectionHeader } from '../../src/components/AppSectionHeader';
import { AppEmptyState, AppErrorState, AppLoadingState } from '../../src/components/AppStates';
import { AppStatusBadge } from '../../src/components/AppStatusBadge';
import { Screen } from '../../src/components/ui';
import { friendlyError } from '../../src/lib/errors';
import { roleLabel, usePermissions } from '../../src/lib/permissions';
import { useBusinessProfile } from '../../src/lib/salon-api';
import { useTheme } from '../../src/theme/ThemeProvider';
import { iconSize, spacing, type } from '../../src/theme/tokens';

export default function BusinessSettingsScreen() {
  const { colors } = useTheme();
  const { role } = usePermissions();
  const profile = useBusinessProfile();
  const business = profile.data;

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={profile.isRefetching} onRefresh={() => void profile.refetch()} colors={[colors.primary]} tintColor={colors.primary} />}
        >
          <AppHeader back title="Business settings" description="Details your team and receipts use." />
          {profile.isPending ? <AppLoadingState label="Loading business details…" /> : profile.isError ? (
            <AppErrorState title="Couldn’t load business details" message={friendlyError(profile.error, { fallback: 'Please try again.' })} onRetry={() => void profile.refetch()} retrying={profile.isFetching} />
          ) : business ? (
            <>
              <AppCard>
                <View style={styles.row}>
                  <Text style={[type.caption, { color: colors.textMuted }]}>Business name</Text>
                  {role ? <AppStatusBadge label={`You: ${roleLabel[role]}`} tone="accent" /> : null}
                </View>
                <Text style={[type.heading, { color: colors.text }]}>{business.name}</Text>
                <Text style={[type.caption, { color: colors.textMuted }]}>Workspace ID: {business.slug}</Text>
              </AppCard>
              <View style={styles.group}>
                <AppSectionHeader title={`Branches (${business.branches.length})`} />
                <AppCard padded={false}>
                  {business.branches.length ? business.branches.map((branch, index) => (
                    <AppListItem
                      key={branch.id}
                      divider={index > 0}
                      title={branch.name}
                      subtitle={[branch.code, branch.address, branch.timezone].filter(Boolean).join(' · ')}
                      leading={<AppListIcon><MapPin color={colors.primary} size={iconSize.md} /></AppListIcon>}
                    />
                  )) : <AppEmptyState compact title="No branches yet" description="A branch is needed before you can take payments." />}
                </AppCard>
              </View>
              <Text style={[type.caption, { color: colors.textMuted }]}>Editing business details and adding branches will be available in a later update.</Text>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing.xxl, padding: spacing.lg, paddingBottom: spacing.xxxl },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  group: { gap: spacing.sm },
});
