import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard } from '../../../src/components/AppCard';
import { AppHeader } from '../../../src/components/AppHeader';
import { AppListItem } from '../../../src/components/AppListItem';
import { AppEmptyState, AppErrorState, AppLoadingState } from '../../../src/components/AppStates';
import { AppSectionHeader } from '../../../src/components/AppSectionHeader';
import { Screen } from '../../../src/components/ui';
import { useStaffJobs } from '../../../src/lib/salon-api';
import { friendlyError } from '../../../src/lib/errors';
import { formatDateTime } from '../../../src/lib/format';
import { lkr } from '../../../src/lib/money';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { spacing, type } from '../../../src/theme/tokens';

export default function StaffJobsScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobs = useStaffJobs(id);
  const data = jobs.data;
  return (
    <Screen>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={jobs.isRefetching} onRefresh={() => void jobs.refetch()} colors={[colors.primary]} tintColor={colors.primary} />}>
          <AppHeader back title={data?.staff.user.displayName ?? 'Staff member'} description={data ? `${data.staff.title ?? 'Team member'} · ${data.staff.branch.name}` : 'Completed work and activity'} />
          {jobs.isPending ? <AppLoadingState label="Loading staff activity…" /> : jobs.isError ? <AppErrorState title="Couldn’t load staff activity" message={friendlyError(jobs.error, { fallback: 'Please try again.' })} onRetry={() => void jobs.refetch()} retrying={jobs.isFetching} /> : data ? (
            <>
              <AppCard>
                <Text style={[type.bodyStrong, { color: colors.text }]}>{data.staff.user.email}</Text>
                <Text style={[type.caption, { color: colors.textMuted }]}>{data.appointments.length + data.sales.length} completed jobs recorded</Text>
              </AppCard>
              <View style={styles.section}>
                <AppSectionHeader title="Completed appointments" />
                <AppCard padded={false}>
                  {data.appointments.length ? data.appointments.map((job, index) => <AppListItem key={job.id} divider={index > 0} title={job.service?.name ?? 'Appointment'} subtitle={`${job.customer.firstName} ${job.customer.lastName ?? ''}`.trim() + ` · ${formatDateTime(job.startsAt)}`} />) : <AppEmptyState compact title="No completed appointments" description="Completed appointments assigned to this member will appear here." />}
                </AppCard>
              </View>
              <View style={styles.section}>
                <AppSectionHeader title="POS services" />
                <AppCard padded={false}>
                  {data.sales.length ? data.sales.map((sale, index) => <AppListItem key={sale.id} divider={index > 0} title={sale.itemName} subtitle={`${sale.sale.receiptNumber} · ${formatDateTime(sale.sale.createdAt)}`} trailing={<Text style={[type.label, { color: colors.primary }]}>{lkr(sale.lineTotalLkr)}</Text>} />) : <AppEmptyState compact title="No POS services" description="Services assigned to this member during checkout will appear here." />}
                </AppCard>
              </View>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { gap: spacing.xxl, padding: spacing.lg }, section: { gap: spacing.sm } });
