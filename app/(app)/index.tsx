import { ReactNode, useEffect, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, Clock3, MapPin, ReceiptText, ShoppingBag, UserPlus, Wallet } from 'lucide-react-native';
import { AppCard } from '../../src/components/AppCard';
import { AppListItem } from '../../src/components/AppListItem';
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
import { useAppointments, useBusinessProfile, useDashboardStats, useMyJobs } from '../../src/lib/salon-api';
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
  const myJobs = useMyJobs(role === 'STYLIST' || role === 'CASHIER');

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
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Image source={require('../../assets/logo 2.png')} style={styles.brandIcon} />
              <Text style={[styles.brandName, { color: colors.text }]}>saloon<Text style={{ color: colors.primary }}>OS</Text></Text>
              <View style={styles.headerSpacer} />
              <View style={styles.notification}><View style={[styles.notificationDot, { backgroundColor: colors.danger }]} /><AlertTriangle color={colors.text} size={22} /></View>
              <ProfileAvatar name={user?.displayName ?? profile.data?.name} onPress={() => router.navigate('/(app)/more')} />
            </View>
            <Image source={require('../../assets/desing 1.png')} style={styles.heroArt} resizeMode="contain" />
            <Text accessibilityRole="header" style={[styles.greeting, { color: colors.text }]}>{greeting(timeZone)},</Text>
            <View style={styles.locationRow}>
              <Text numberOfLines={1} style={[type.heading, { color: colors.text }]}>{context || (profile.isPending ? 'Loading your business…' : 'Your business')}</Text>
              <MapPin color={colors.primary} size={18} fill={colors.primary} />
            </View>
            <Text style={[type.body, { color: colors.textMuted }]}>Let’s make today productive ✨</Text>
          </View>

          <TodaySummary
            role={role}
            canReport={canReport}
            stats={stats.data}
            statsError={stats.isError ? friendlyError(stats.error, { fallback: 'Please try again.' }) : undefined}
            onRetry={() => void stats.refetch()}
            net={report.data ? lkr(report.data.netLkr) : canReport && (report.isPending && !!branch) ? '…' : canReport && report.isError ? 'Unavailable' : undefined}
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

          <Section title="Upcoming appointments" actionLabel="See all →" onAction={() => router.navigate('/(app)/appointments')}>
            <AppCard padded={false} style={styles.featureCard}>
              {appointments.isPending ? <AppLoadingState compact label="Loading appointments…" /> : appointments.isError ? (
                <AppErrorState compact title="Couldn’t load appointments" message={friendlyError(appointments.error, { fallback: 'Please try again.' })} onRetry={() => void appointments.refetch()} retrying={appointments.isFetching} />
              ) : upcoming.length ? upcoming.map((item, index) => <AppointmentRow key={item.id} appointment={item} divider={index > 0} timeZone={timeZone} />) : (
                <AppEmptyState compact title="No more appointments today" description={appointments.data?.items.length ? 'Everything booked for today has finished or been cancelled.' : 'New bookings for today will appear here.'} />
              )}
            </AppCard>
          </Section>

          {role === 'STYLIST' || role === 'CASHIER' ? (
            <Section title="Jobs you’ve completed" actionLabel="View all →" onAction={() => router.push('/(app)/more')}>
              <AppCard padded={false} style={styles.featureCard}>
                {myJobs.isPending ? <AppLoadingState compact label="Loading your completed jobs…" /> : myJobs.isError ? (
                  <AppErrorState compact title="Couldn’t load your jobs" message={friendlyError(myJobs.error, { fallback: 'Please try again.' })} onRetry={() => void myJobs.refetch()} retrying={myJobs.isFetching} />
                ) : myJobs.data?.appointments.length || myJobs.data?.sales.length ? (
                  <>
                    {myJobs.data.appointments.slice(0, 3).map((job, index) => (
                      <AppListItem key={job.id} divider={index > 0} title={job.service?.name ?? 'Completed appointment'} subtitle={`${job.customer.firstName} ${job.customer.lastName ?? ''}`.trim()} trailing={<AppStatusBadge label="Completed" tone="success" />} />
                    ))}
                    {myJobs.data.sales.slice(0, Math.max(0, 3 - myJobs.data.appointments.length)).map((sale, index) => (
                      <AppListItem key={sale.id} divider={myJobs.data.appointments.length + index > 0} title={sale.itemName} subtitle={`${sale.sale.receiptNumber} · ${lkr(sale.lineTotalLkr)}`} trailing={<AppStatusBadge label="Sale" tone="accent" />} />
                    ))}
                  </>
                ) : <AppEmptyState compact title="No completed jobs yet" description="Completed appointments and POS services assigned to you will appear here." />}
              </AppCard>
            </Section>
          ) : null}

          {canSell ? (
            <Section title="Recent sales" actionLabel={recentSales.length ? 'See all →' : undefined} onAction={() => router.push('/(app)/sales')}>
              <AppCard padded={false} style={styles.featureCard}>
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
};

function TodaySummary({ role, canReport, stats, statsError, onRetry, net }: SummaryProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.summary, { backgroundColor: colors.primary }]}>
      <View style={styles.summaryTop}>
        <View style={styles.summaryTitle}>
          <CalendarDays color={colors.onPrimary} size={24} />
          <Text style={[type.heading, { color: colors.onPrimary }]}>{role === 'OWNER' || role === 'MANAGER' ? "Today's Revenue" : role === 'CASHIER' ? 'Till today' : 'Your day'}</Text>
        </View>
        <View style={styles.summarySpark}>
          <View style={styles.sparkLine} />
          <View style={[styles.sparkPoint, { backgroundColor: colors.onPrimary }]} />
        </View>
      </View>
      {canReport && net !== undefined ? (
        <View accessible accessibilityLabel={`Net sales today: ${net}`} style={styles.net}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.revenue, { color: colors.onPrimary }]}>{net}</Text>
          <View style={styles.changePill}><Text style={[type.caption, { color: colors.onPrimary }]}>↗  0% vs yesterday</Text></View>
        </View>
      ) : null}
      {statsError ? <AppErrorState compact title="Couldn’t load today’s numbers" message={statsError} onRetry={onRetry} /> : (
        <View style={[styles.metrics, { backgroundColor: colors.surface }, canReport && net !== undefined && styles.summaryMetrics]}>
          <SummaryMetric icon={<CalendarDays color={colors.primary} size={24} />} label="Appointments" value={stats?.total} />
          <SummaryMetric icon={<Clock3 color={colors.primary} size={24} />} label="Upcoming" value={stats?.upcoming} />
          <SummaryMetric icon={<CheckCircle2 color={colors.primary} size={24} />} label="Completed" value={stats?.completed} />
        </View>
      )}
    </View>
  );
}

function SummaryMetric({ icon, label, value }: { icon: ReactNode; label: string; value?: number }) {
  const { colors } = useTheme();
  return <View style={styles.summaryMetric}>{icon}<Text style={[styles.summaryValue, { color: colors.text }]}>{value ?? '–'}</Text><Text style={[type.caption, { color: colors.textMuted }]}>{label}</Text></View>;
}

function QuickAction({ label, icon, onPress }: { label: string; icon: ReactNode; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.action, { borderColor: colors.border, backgroundColor: pressed ? colors.primarySoft : colors.surface }]}>
      <View style={[styles.actionIcon, { backgroundColor: colors.primarySoft }]}>{icon}</View>
      <View style={styles.actionCopy}>
        <Text numberOfLines={1} style={[type.bodyStrong, styles.actionLabel, { color: colors.text }]}>{label}</Text>
        <Text numberOfLines={1} style={[type.caption, { color: colors.textMuted }]}>{label === 'New sale' ? 'Create a transaction' : label === 'Add customer' ? 'Register a client' : label === 'Schedule' ? 'Book an appointment' : 'View reports'}</Text>
      </View>
      <ChevronRight color={colors.textSubtle} size={iconSize.sm} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing.xxl, padding: spacing.lg, paddingBottom: layout.screenBottomInset },
  header: { gap: spacing.sm, minHeight: 212, overflow: 'hidden', position: 'relative' },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, zIndex: 1 },
  brandIcon: { borderRadius: radius.pill, height: 38, width: 38 },
  brandName: { fontSize: 22, fontWeight: '700', letterSpacing: -0.8 },
  headerSpacer: { flex: 1 },
  notification: { alignItems: 'center', height: 42, justifyContent: 'center', position: 'relative', width: 42 },
  notificationDot: { borderRadius: radius.pill, height: 8, position: 'absolute', right: 7, top: 5, width: 8, zIndex: 1 },
  heroArt: { height: 210, opacity: 0.58, position: 'absolute', right: -74, top: 35, width: 260 },
  greeting: { fontSize: 38, fontWeight: '700', letterSpacing: -1.2, marginTop: spacing.xxl, zIndex: 1 },
  locationRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, maxWidth: '72%', zIndex: 1 },
  net: { gap: spacing.sm, paddingBottom: spacing.xl, paddingHorizontal: spacing.xl },
  summary: { borderRadius: radius.xl, overflow: 'hidden' },
  summaryTop: { minHeight: 150, padding: spacing.xl, position: 'relative' },
  summaryTitle: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  revenue: { fontSize: 42, fontWeight: '700', letterSpacing: -1, marginTop: spacing.sm },
  changePill: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  summarySpark: { bottom: 20, height: 80, position: 'absolute', right: 24, width: 160 },
  sparkLine: { borderColor: '#B9A1FF', borderTopLeftRadius: 60, borderTopRightRadius: 60, borderWidth: 3, height: 48, left: 0, position: 'absolute', top: 25, transform: [{ rotate: '-12deg' }], width: 150 },
  sparkPoint: { borderRadius: radius.pill, height: 9, position: 'absolute', right: 0, top: 7, width: 9 },
  metrics: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  summaryMetrics: { borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  summaryMetric: { alignItems: 'center', borderRightColor: '#E8E4F2', borderRightWidth: StyleSheet.hairlineWidth, flex: 1, gap: spacing.xs },
  summaryValue: { fontSize: 24, fontWeight: '700' },
  alertIcon: { alignItems: 'center', borderRadius: radius.sm + 2, height: 36, justifyContent: 'center', width: 36 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, flexBasis: '47%', flexDirection: 'row', flexGrow: 1, gap: spacing.sm, minHeight: 100, paddingHorizontal: spacing.md },
  actionIcon: { alignItems: 'center', borderRadius: radius.md, height: 48, justifyContent: 'center', width: 48 },
  actionCopy: { flex: 1, gap: spacing.xxs },
  actionLabel: { flex: 1 },
  featureCard: { borderRadius: radius.xl },
  section: { gap: spacing.sm },
});
