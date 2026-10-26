import { Redirect, Tabs } from 'expo-router';
import { CalendarDays, HandCoins, LayoutDashboard, ReceiptText, Settings } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAuthStore } from '../../src/lib/auth';
import { LoadingState } from '../../src/components/ui';

export default function AppLayout() {
  const { colors } = useTheme();
  const { hydrated, accessToken } = useAuthStore();
  if (!hydrated) return <LoadingState label="Restoring your secure session…" />;
  if (!accessToken) return <Redirect href="/login" />;
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textMuted, tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border }, tabBarLabelStyle: { fontSize: 11, fontWeight: '600' } }}><Tabs.Screen name="index" options={{ title: 'Overview', tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} /> }} /><Tabs.Screen name="appointments" options={{ title: 'Appointments', tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} /> }} /><Tabs.Screen name="checkout" options={{ title: 'Checkout', tabBarIcon: ({ color, size }) => <HandCoins color={color} size={size} /> }} /><Tabs.Screen name="sales" options={{ title: 'Sales', tabBarIcon: ({ color, size }) => <ReceiptText color={color} size={size} /> }} /><Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Settings color={color} size={size} /> }} /><Tabs.Screen name="account-security" options={{ href: null }} /></Tabs>;
}
