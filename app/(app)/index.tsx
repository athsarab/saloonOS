import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { Card, EmptyState, Screen, SectionTitle } from '../../src/components/ui';
import { useDashboardStats, useAppointments } from '../../src/lib/salon-api';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function DashboardScreen() {
  const { colors } = useTheme();
  const stats = useDashboardStats();
  const appointments = useAppointments();
  const stat = stats.data;
  return <Screen><SafeAreaView edges={['top']}><ScrollView contentContainerStyle={styles.content}>
    <AppHeader title="Today at a glance" description="Keep the team moving and every guest looked after." />
    {stats.isError ? <Card><Text style={{ color: colors.danger }}>Unable to load today’s appointments. Pull to retry.</Text></Card> : null}
    <View style={styles.stats}>
      {[
        ['Total', stat?.total ?? '—'],
        ['Upcoming', stat?.upcoming ?? '—'],
        ['Completed', stat?.completed ?? '—'],
        ['Cancelled', stat?.cancelled ?? '—'],
      ].map(([label, value]) => <Card key={label} style={styles.stat}><Text style={[styles.value, { color: colors.text }]}>{value}</Text><Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text></Card>)}
    </View>
    <SectionTitle title="Today’s schedule" />
    <Card>{appointments.isPending ? <Text style={{ color: colors.textMuted }}>Loading schedule…</Text> : appointments.data?.items.length ? appointments.data.items.map((item) => <View key={item.id} style={styles.row}><Text style={[styles.time, { color: colors.primary }]}>{new Date(item.startsAt).toLocaleTimeString('en-LK', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit' })}</Text><View><Text style={[styles.name, { color: colors.text }]}>{item.customer.firstName} {item.customer.lastName ?? ''}</Text><Text style={[styles.detail, { color: colors.textMuted }]}>{item.service?.name ?? 'Service'} · {item.status.toLowerCase()}</Text></View></View>) : <EmptyState title="No appointments today" description="New bookings will appear here as soon as they are created." />}</Card>
  </ScrollView></SafeAreaView></Screen>;
}

const styles = StyleSheet.create({ content: { gap: 20, padding: 20 }, stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, stat: { flexBasis: '47%', flexGrow: 1, gap: 6, padding: 16 }, value: { fontSize: 26, fontWeight: '800' }, label: { fontSize: 13 }, row: { flexDirection: 'row', gap: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D8DDE5' }, time: { width: 72, fontWeight: '700' }, name: { fontSize: 15, fontWeight: '700' }, detail: { marginTop: 3, fontSize: 13 } });
