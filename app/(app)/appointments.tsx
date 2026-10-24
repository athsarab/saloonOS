import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { Card, EmptyState, Screen } from '../../src/components/ui';
import { useAppointments } from '../../src/lib/salon-api';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function AppointmentsScreen() {
  const { colors } = useTheme();
  const appointments = useAppointments();
  return <Screen><SafeAreaView edges={['top']}><ScrollView contentContainerStyle={styles.content}>
    <AppHeader title="Appointments" description="See today’s bookings in Sri Lankan local time." />
    <Card>
      {appointments.isPending ? <Text style={{ color: colors.textMuted }}>Loading appointments…</Text> : appointments.isError ? <Text style={{ color: colors.danger }}>Couldn’t load appointments. Try again.</Text> : appointments.data?.items.length ? appointments.data.items.map((item) => <View key={item.id} style={[styles.item, { borderBottomColor: colors.border }]}><Text style={[styles.time, { color: colors.primary }]}>{new Date(item.startsAt).toLocaleTimeString('en-LK', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit' })}</Text><View style={styles.details}><Text style={[styles.name, { color: colors.text }]}>{item.customer.firstName} {item.customer.lastName ?? ''}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>{item.service?.name ?? 'Service'} · {item.status.toLowerCase()}</Text></View></View>) : <EmptyState title="No appointments today" description="Create a booking from the new appointment flow when your customer and service records are ready." />}
    </Card>
  </ScrollView></SafeAreaView></Screen>;
}

const styles = StyleSheet.create({ content: { gap: 20, padding: 20 }, item: { flexDirection: 'row', gap: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth }, time: { width: 76, fontWeight: '800' }, details: { flex: 1, gap: 4 }, name: { fontSize: 15, fontWeight: '700' }, meta: { fontSize: 13 } });
