import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AppHeader } from '../../src/components/AppHeader';
import { Button, Card, Screen } from '../../src/components/ui';
import { useAuthStore } from '../../src/lib/auth';
import { apiRequest } from '../../src/lib/api';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function AccountSecurityScreen() {
  const { colors } = useTheme();
  const logout = useAuthStore((state) => state.logout);
  const logoutAll = async () => {
    try { await apiRequest('/v1/auth/logout-all', { method: 'POST' }); } finally { await logout(); }
  };
  return <Screen><SafeAreaView edges={['top']}><ScrollView contentContainerStyle={styles.content}><AppHeader title="Account & security" description="Protect access to your SalonOS workspace." /><Card><Text style={[styles.title, { color: colors.text }]}>Sessions</Text><Text style={[styles.copy, { color: colors.textMuted }]}>Signing out of all devices revokes every server session.</Text><Button label="Sign out all devices" variant="secondary" onPress={() => void logoutAll()} /></Card><Button label="Back to settings" variant="ghost" onPress={() => router.back()} /></ScrollView></SafeAreaView></Screen>;
}

const styles = StyleSheet.create({ content: { gap: 20, padding: 20 }, title: { fontSize: 18, fontWeight: '700' }, copy: { fontSize: 14, lineHeight: 21, marginVertical: 12 } });
