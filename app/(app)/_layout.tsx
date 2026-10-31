import { Redirect, Tabs } from 'expo-router';
import { AppTabBar } from '../../src/components/AppTabBar';
import { AppLoadingState } from '../../src/components/AppStates';
import { Screen } from '../../src/components/ui';
import { useAuthStore } from '../../src/lib/auth';

export default function AppLayout() {
  const { hydrated, accessToken } = useAuthStore();
  if (!hydrated) return <Screen><AppLoadingState label="Restoring your secure session…" /></Screen>;
  if (!accessToken) return <Redirect href="/login" />;
  // The custom tab bar decides which destinations are shown (by role) and which one is highlighted.
  // Sub-screens stay in this navigator so their existing URLs keep working.
  return (
    <Tabs backBehavior="history" tabBar={(props) => <AppTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="appointments" options={{ title: 'Appointments' }} />
      <Tabs.Screen name="checkout" options={{ title: 'POS' }} />
      <Tabs.Screen name="customers" options={{ title: 'Customers' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
      <Tabs.Screen name="sales" options={{ title: 'Sales & reports' }} />
      <Tabs.Screen name="settings" options={{ title: 'Business settings' }} />
      <Tabs.Screen name="sync" options={{ title: 'Offline & sync' }} />
      <Tabs.Screen name="account-security" options={{ title: 'Account & security' }} />
      <Tabs.Screen name="offline-checkout" options={{ title: 'Offline cash till' }} />
      <Tabs.Screen name="staff/[id]" options={{ href: null }} />
    </Tabs>
  );
}
