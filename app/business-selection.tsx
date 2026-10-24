import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../src/components/AppHeader';
import { Card, Screen } from '../src/components/ui';
import { apiRequest, setAccessToken } from '../src/lib/api';
import { useAuthStore } from '../src/lib/auth';
import { useTheme } from '../src/theme/ThemeProvider';
import { Redirect } from 'expo-router';

export default function BusinessSelectionScreen() {
  const { colors } = useTheme();
  const { tenants, hydrated, accessToken } = useAuthStore();
  if (!hydrated) return null;
  if (!accessToken) return <Redirect href="/login" />;
  const choose = async (tenantId: string) => {
    const session = await apiRequest<{ accessToken: string }>('/v1/auth/select-tenant', { method: 'POST', body: JSON.stringify({ tenantId }) });
    await setAccessToken(session.accessToken);
    router.replace('/(app)');
  };
  return <Screen><SafeAreaView edges={['top']}><ScrollView contentContainerStyle={styles.content}><AppHeader title="Choose a business" description="Select the workspace you want to use right now." />{tenants.map((tenant) => <Pressable key={tenant.id} onPress={() => void choose(tenant.id)} accessibilityRole="button"><Card><Text style={[styles.name, { color: colors.text }]}>{tenant.name}</Text><Text style={{ color: colors.textMuted }}>{tenant.role}</Text></Card></Pressable>)}</ScrollView></SafeAreaView></Screen>;
}

const styles = StyleSheet.create({ content: { gap: 16, padding: 20 }, name: { fontSize: 18, fontWeight: '700', marginBottom: 6 } });
