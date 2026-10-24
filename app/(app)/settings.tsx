import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, Moon, ShieldCheck, Store } from 'lucide-react-native';
import { AppHeader } from '../../src/components/AppHeader';
import { Card, Screen } from '../../src/components/ui';
import { Button } from '../../src/components/ui';
import { useAuthStore } from '../../src/lib/auth';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';

function SettingRow({ icon, title, description, onPress }: { icon: ReactNode; title: string; description: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}><View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>{icon}</View><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.rowDescription, { color: colors.textMuted }]}>{description}</Text></View><ChevronRight color={colors.textMuted} size={18} /></Pressable>;
}

export default function SettingsScreen() {
  const { colors } = useTheme();
  const logout = useAuthStore((state) => state.logout);
  return <Screen><SafeAreaView edges={['top']}><ScrollView contentContainerStyle={styles.content}><AppHeader title="Settings" description="Shape SalonOS around the way your team works." /><Card><SettingRow title="Business profile" description="Name, location, contact details" icon={<Store color={colors.primary} size={20} />} /><View style={[styles.divider, { backgroundColor: colors.border }]} /><SettingRow title="Account & security" description="Password, sessions, and sign out" icon={<ShieldCheck color={colors.primary} size={20} />} onPress={() => router.push('/(app)/account-security')} /><View style={[styles.divider, { backgroundColor: colors.border }]} /><SettingRow title="Appearance" description="Use your device theme" icon={<Moon color={colors.primary} size={20} />} /></Card><Button label="Sign out" variant="secondary" onPress={() => void logout()} /><Text style={[styles.version, { color: colors.textMuted }]}>SalonOS · Workspace settings</Text></ScrollView></SafeAreaView></Screen>;
}

const styles = StyleSheet.create({ content: { gap: 20, padding: 20 }, row: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingVertical: 8 }, icon: { alignItems: 'center', borderRadius: 10, height: 40, justifyContent: 'center', width: 40 }, rowCopy: { flex: 1, gap: 3 }, rowTitle: { fontSize: 15, fontWeight: '700' }, rowDescription: { fontSize: 13 }, divider: { height: 1, marginVertical: 12 }, version: { fontSize: 12, textAlign: 'center' } });
