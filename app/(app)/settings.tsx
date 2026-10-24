import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, Moon, ShieldCheck, Store } from 'lucide-react-native';
import { AppHeader } from '../../src/components/AppHeader';
import { Card, Screen } from '../../src/components/ui';
import { useTheme } from '../../src/theme/ThemeProvider';

function SettingRow({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" style={styles.row}><View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>{icon}</View><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.rowDescription, { color: colors.textMuted }]}>{description}</Text></View><ChevronRight color={colors.textMuted} size={18} /></Pressable>;
}

export default function SettingsScreen() {
  const { colors } = useTheme();
  return <Screen><SafeAreaView edges={['top']}><ScrollView contentContainerStyle={styles.content}><AppHeader title="Settings" description="Shape SalonOS around the way your team works." /><Card><SettingRow title="Business profile" description="Name, location, contact details" icon={<Store color={colors.primary} size={20} />} /><View style={[styles.divider, { backgroundColor: colors.border }]} /><SettingRow title="Security & access" description="Team members and permissions" icon={<ShieldCheck color={colors.primary} size={20} />} /><View style={[styles.divider, { backgroundColor: colors.border }]} /><SettingRow title="Appearance" description="Use your device theme" icon={<Moon color={colors.primary} size={20} />} /></Card><Text style={[styles.version, { color: colors.textMuted }]}>SalonOS · Workspace settings</Text></ScrollView></SafeAreaView></Screen>;
}

const styles = StyleSheet.create({ content: { gap: 20, padding: 20 }, row: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingVertical: 8 }, icon: { alignItems: 'center', borderRadius: 10, height: 40, justifyContent: 'center', width: 40 }, rowCopy: { flex: 1, gap: 3 }, rowTitle: { fontSize: 15, fontWeight: '700' }, rowDescription: { fontSize: 13 }, divider: { height: 1, marginVertical: 12 }, version: { fontSize: 12, textAlign: 'center' } });
