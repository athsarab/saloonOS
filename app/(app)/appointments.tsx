import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays } from 'lucide-react-native';
import { AppCard } from '../../src/components/AppCard';
import { AppHeader } from '../../src/components/AppHeader';
import { AppointmentRow } from '../../src/components/AppointmentRow';
import { AppEmptyState, AppErrorState, AppLoadingState } from '../../src/components/AppStates';
import { Screen } from '../../src/components/ui';
import { friendlyError } from '../../src/lib/errors';
import { useAppointments } from '../../src/lib/salon-api';
import { useTheme } from '../../src/theme/ThemeProvider';
import { iconSize, spacing, type } from '../../src/theme/tokens';

export default function AppointmentsScreen() {
  const { colors } = useTheme();
  const appointments = useAppointments();
  const items = appointments.data?.items ?? [];
  const today = new Date().toLocaleDateString('en-LK', { timeZone: 'Asia/Colombo', weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={appointments.isRefetching} onRefresh={() => void appointments.refetch()} colors={[colors.primary]} tintColor={colors.primary} />}
        >
          <AppHeader title="Appointments" description={today} />
          <AppCard padded={false}>
            {appointments.isPending ? <AppLoadingState label="Loading appointments…" /> : appointments.isError ? (
              <AppErrorState title="Couldn’t load appointments" message={friendlyError(appointments.error, { fallback: 'Please try again.' })} onRetry={() => void appointments.refetch()} retrying={appointments.isFetching} />
            ) : items.length ? items.map((item, index) => <AppointmentRow key={item.id} appointment={item} divider={index > 0} />) : (
              <AppEmptyState icon={<CalendarDays color={colors.textSubtle} size={iconSize.lg} />} title="No appointments today" description="Bookings for today will appear here as soon as they are created." />
            )}
          </AppCard>
          {items.length ? <Text style={[type.caption, { color: colors.textMuted }]}>{items.length} {items.length === 1 ? 'appointment' : 'appointments'} · times in Sri Lanka time</Text> : null}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
});
