import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { Card, EmptyState, Screen, SectionTitle } from '../../src/components/ui';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function DashboardScreen() {
  const { colors } = useTheme();
  return <Screen><SafeAreaView edges={['top']}><ScrollView contentContainerStyle={styles.content}><AppHeader eyebrow="Tuesday, 24 October" title="Good morning, Amaya" description="Here’s the shape of your day at The Green Room." /><Card style={styles.balance}><Text style={[styles.balanceLabel, { color: colors.textMuted }]}>TODAY’S REVENUE</Text><Text style={[styles.balanceValue, { color: colors.text }]}>—</Text><Text style={[styles.balanceHint, { color: colors.textMuted }]}>Connect your account to see live performance</Text></Card><View style={styles.stats}><Card style={styles.stat}><Text style={[styles.statValue, { color: colors.text }]}>—</Text><Text style={[styles.statLabel, { color: colors.textMuted }]}>Appointments</Text></Card><Card style={styles.stat}><Text style={[styles.statValue, { color: colors.text }]}>—</Text><Text style={[styles.statLabel, { color: colors.textMuted }]}>Open slots</Text></Card></View><SectionTitle title="Today’s schedule" /><Card><EmptyState title="Your schedule is clear" description="Appointments from your connected workspace will appear here." /></Card></ScrollView></SafeAreaView></Screen>;
}

const styles = StyleSheet.create({ content: { gap: 20, padding: 20 }, balance: { gap: 8, marginTop: 6, padding: 22 }, balanceLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1 }, balanceValue: { fontSize: 34, fontWeight: '800' }, balanceHint: { fontSize: 13 }, stats: { flexDirection: 'row', gap: 12 }, stat: { flex: 1, gap: 6, padding: 16 }, statValue: { fontSize: 25, fontWeight: '800' }, statLabel: { fontSize: 13 } });
