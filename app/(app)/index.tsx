import { ReactNode, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AlertTriangle, CalendarDays, ChevronRight, ReceiptText, ShoppingBag, UserPlus, Wallet } from 'lucide-react-native';
import { AppCard } from '../../src/components/AppCard';
import { AppListIcon, AppListItem } from '../../src/components/AppListItem';
import { AppSectionHeader } from '../../src/components/AppSectionHeader';
import { AppEmptyState, AppErrorState, AppLoadingState } from '../../src/components/AppStates';
import { AppStatusBadge } from '../../src/components/AppStatusBadge';
import { AppointmentRow } from '../../src/components/AppointmentRow';
import { ProfileAvatar } from '../../src/components/ProfileAvatar';
import { Screen } from '../../src/components/ui';
import { useBranches, useCurrentShift, useDailyReport, useSalesHistory } from '../../src/lib/checkout-api';
import { friendlyError } from '../../src/lib/errors';
import { defaultTimezone, formatDateTime, greeting, saleStatus } from '../../src/lib/format';
import { lkr } from '../../src/lib/money';
import { usePermissions } from '../../src/lib/permissions';
import { useAppointments, useBusinessProfile, useDashboardStats } from '../../src/lib/salon-api';
import { useAuthStore } from '../../src/lib/auth';
import { useTheme } from '../../src/theme/ThemeProvider';
import { iconSize, layout, radius, spacing, type } from '../../src/theme/tokens';

const activeStatuses = ['BOOKED', 'CONFIRMED', 'CHECKED_IN'];

/** Current time, refreshed every minute so "Up next" drops finished appointments. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const { role, can } = usePermissions();
  const user = useAuthStore((state) => state.user);
  const canSell = can('checkout'), canReport = can('reports.read');

  const profile = useBusinessProfile();
  const branches = useBranches();
  const branch = branches.data?.[0];
  const timeZone = branch?.timezone ?? defaultTimezone;
  const now = useNow();
  const stats = useDashboardStats();
  const appointments = useAppointments();
  // Queries the role can't use are disabled by passing no branch, so they never hit the API.
  const report = useDailyReport(canReport ? branch?.id : undefined, '', canReport);
  const shift = useCurrentShift(canSell ? branch?.id : undefined);
  const sales = useSalesHistory(canSell ? branch?.id : undefined, 0);

  const upcoming = (appointments.data?.items ?? [])
    .filter((item) => activeStatuses.includes(item.status) && new Date(item.endsAt).getTime() > now)
    .slice(0, 4);
  const recentSales = (sales.data?.items ?? []).slice(0, 4);

  const refreshing = stats.isRefetching || appointments.isRefetching || report.isRefetching || sales.isRefetching;
  const refresh = () => {
    void stats.refetch(); void appointments.refetch(); void profile.refetch(); void branches.refetch();
    if (canReport && branch) void report.refetch();
    if (canSell && branch) { void shift.refetch(); void sales.refetch(); }
  };

  const alerts: { key: string; title: string; detail: string; onPress?: () => void }[] = [];
  if (canSell && branches.isSuccess && !branch) alerts.push({ key: 'branch', title: 'No branch set up', detail: 'POS needs a branch before it can take payments.' });
  if (canSell && shift.isSuccess && !shift.data) alerts.push({ key: 'shift', title: 'Cash drawer isn’t open', detail: 'Open a cash shift in POS before taking cash.', onPress: () => router.navigate('/(app)/checkout') });
  if (report.data?.pendingCount) alerts.push({
    key: 'transfers', title: `${report.data.pendingCount} bank ${report.data.pendingCount === 1 ? 'transfer' : 'transfers'} to verify`,
    detail: 'Pending transfers aren’t counted as collected until verified.', onPress: () => router.push('/(app)/sales'),
  });

  const actions = [
    canSell && { key: 'sale', label: 'New sale', icon: ShoppingBag, onPress: () => router.navigate('/(app)/checkout') },
    can('customer.write') && { key: 'customer', label: 'Add customer', icon: UserPlus, onPress: () => router.navigate({ pathname: '/(app)/customers', params: { new: '1' } }) },
    { key: 'schedule', label: 'Schedule', icon: CalendarDays, onPress: () => router.navigate('/(app)/appointments') },
    canSell && !canReport && { key: 'shift', label: 'Cash shift', icon: Wallet, onPress: () => router.navigate('/(app)/checkout') },
    canSell && canReport && { key: 'sales', label: 'Sales', icon: ReceiptText, onPress: () => router.push('/(app)/sales') },
  ].filter((action): action is Exclude<typeof action, false> => !!action).slice(0, 4);

  const context = [profile.data?.name, branch?.name].filter(Boolean).join(' · ');

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} tintColor={colors.primary} />}
        >
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <View style={styles.flex}>
              <Text style={[type.micro, { color: colors.primary }]}>SALONOS / TODAY</Text>
              <Text accessibilityRole="header" style={[type.title, { color: colors.text }]}>{greeting(timeZone)}</Text>
              <Text numberOfLines={1} style={[type.body, { color: colors.textMuted }]}>{context || (profile.isPending ? 'Loading your business…' : 'Your business')}</Text>
            </View>
            <ProfileAvatar name={user?.displayName ?? profile.data?.name} onPress={() => router.navigate('/(app)/more')} />
          </View>

          <TodaySummary
            role={role}
            canReport={canReport}
            stats={stats.data}
            statsError={stats.isError ? friendlyError(stats.error, { fallback: 'Please try again.' }) : undefined}
            onRetry={() => void stats.refetch()}
            net={report.data ? lkr(report.data.netLkr) : canReport && (report.isPending && !!branch) ? '…' : canReport && report.isError ? 'Unavailable' : undefined}
            salesCount={report.data?.salesCount}
          />

          {alerts.length ? (
            <AppCard padded={false} style={{ borderColor: colors.warningSoft }}>
              {alerts.map((alert, index) => (
                <AppListItem
                  key={alert.key}
                  divider={index > 0}
                  title={alert.title}
                  subtitle={alert.detail}
                  leading={<View style={[styles.alertIcon, { backgroundColor: colors.warningSoft }]}><AlertTriangle color={colors.warning} size={iconSize.md} /></View>}
                  onPress={alert.onPress}
                />
              ))}
            </AppCard>
          ) : null}

          <View style={styles.actions}>
            {actions.map(({ key, label, icon: Icon, onPress }) => (
              <QuickAction key={key} label={label} onPress={onPress} icon={<Icon color={colors.primary} size={iconSize.md} />} />
            ))}
          </View>

          <Section title="Up next" actionLabel="See all" onAction={() => router.navigate('/(app)/appointments')}>
            <AppCard padded={false}>
              {appointments.isPending ? <AppLoadingState compact label="Loading appointments…" /> : appointments.isError ? (
                <AppErrorState compact title="Couldn’t load appointments" message={friendlyError(appointments.error, { fallback: 'Please try again.' })} onRetry={() => void appointments.refetch()} retrying={appointments.isFetching} />
              ) : upcoming.length ? upcoming.map((item, index) => <AppointmentRow key={item.id} appointment={item} divider={index > 0} timeZone={timeZone} />) : (
                <AppEmptyState compact title="No more appointments today" description={appointments.data?.items.length ? 'Everything booked for today has finished or been cancelled.' : 'New bookings for today will appear here.'} />
              )}
            </AppCard>
          </Section>

          {canSell ? (
            <Section title="Recent sales" actionLabel={recentSales.length ? 'See all' : undefined} onAction={() => router.push('/(app)/sales')}>
              <AppCard padded={false}>
                {!branch ? (
                  branches.isError ? <AppErrorState compact title="Couldn’t load branches" message={friendlyError(branches.error, { fallback: 'Please try again.' })} onRetry={() => void branches.refetch()} />
                    : branches.isPending ? <AppLoadingState compact label="Loading sales…" />
                      : <AppEmptyState compact title="No sales yet" description="Sales appear here once a branch is set up." />
                ) : sales.isPending ? <AppLoadingState compact label="Loading sales…" /> : sales.isError ? (
                  <AppErrorState compact title="Couldn’t load sales" message={friendlyError(sales.error, { fallback: 'Please try again.' })} onRetry={() => void sales.refetch()} retrying={sales.isFetching} />
                ) : recentSales.length ? recentSales.map((sale, index) => {
                  const status = saleStatus(sale.status);
                  return (
                    <AppListItem
                      key={sale.id}
                      divider={index > 0}
                      title={lkr(sale.totalLkr)}
                      subtitle={`${sale.receiptNumber} · ${formatDateTime(sale.createdAt, timeZone)}`}
                      trailing={<AppStatusBadge label={status.label} tone={status.tone} />}
                      onPress={() => router.push('/(app)/sales')}
                    />
                  );
                }) : <AppEmptyState compact title="No sales yet" description="Completed checkouts will appear here." />}
              </AppCard>
            </Section>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

function Section({ title, actionLabel, onAction, children }: { title: string; actionLabel?: string; onAction?: () => void; children: ReactNode }) {
  return <View style={styles.section}><AppSectionHeader title={title} actionLabel={actionLabel} onAction={onAction} />{children}</View>;
}

type SummaryProps = {
  role: ReturnType<typeof usePermissions>['role'];
  canReport: boolean;
  stats?: { total: number; completed: number; cancelled: number; upcoming: number };
  statsError?: string;
  onRetry: () => void;
  net?: string;
  salesCount?: number;
};

function TodaySummary({ role, canReport, stats, statsError, onRetry, net, salesCount }: SummaryProps) {
  const { colors } = useTheme();
  const metric = (label: string, value: string | number | undefined) => (
    <View accessible accessibilityLabel={`${label}: ${value ?? 'loading'}`} style={styles.metric}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[type.metric, { color: colors.text }]}>{value ?? '–'}</Text>
      <Text numberOfLines={1} style={[type.caption, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
  return (
    <AppCard muted>
      <Text style={[type.label, { color: colors.textMuted }]}>{role === 'OWNER' || role === 'MANAGER' ? 'Business today' : role === 'CASHIER' ? 'Till today' : 'Your day'}</Text>
      {canReport && net !== undefined ? (
        <View accessible accessibilityLabel={`Net sales today: ${net}`} style={styles.net}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[type.display, { color: colors.text }]}>{net}</Text>
          <Text style={[type.caption, { color: colors.textMuted }]}>Net collected{salesCount !== undefined ? ` · ${salesCount} ${salesCount === 1 ? 'sale' : 'sales'}` : ''}</Text>
        </View>
      ) : null}
      {statsError ? <AppErrorState compact title="Couldn’t load today’s numbers" message={statsError} onRetry={onRetry} /> : (
        <View style={[styles.metrics, canReport && net !== undefined && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md }]}>
          {metric('Appointments', stats?.total)}
          {metric('Still to come', stats?.upcoming)}
          {metric('Completed', stats?.completed)}
        </View>
      )}
    </AppCard>
  );
}

function QuickAction({ label, icon, onPress }: { label: string; icon: ReactNode; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.action, { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceMuted : colors.surface }]}>
      <AppListIcon>{icon}</AppListIcon>
      <Text numberOfLines={1} style={[type.label, styles.actionLabel, { color: colors.text }]}>{label}</Text>
      <ChevronRight color={colors.textSubtle} size={iconSize.sm} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing.xxl, padding: spacing.lg, paddingBottom: layout.screenBottomInset },
  header: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, paddingBottom: spacing.lg },
  net: { gap: spacing.xxs },
  metrics: { flexDirection: 'row', gap: spacing.sm },
  metric: { flex: 1, gap: spacing.xxs },
  alertIcon: { alignItems: 'center', borderRadius: radius.sm + 2, height: 36, justifyContent: 'center', width: 36 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { alignItems: 'center', borderRadius: radius.md, borderWidth: 1, flexBasis: '47%', flexDirection: 'row', flexGrow: 1, gap: spacing.sm, minHeight: 56, paddingHorizontal: spacing.md },
  actionLabel: { flex: 1 },
  section: { gap: spacing.sm },
});
