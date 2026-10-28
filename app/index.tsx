import { Redirect, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, ShoppingBag, WifiOff } from 'lucide-react-native';
import { AppButton } from '../src/components/AppButton';
import { AppListIcon } from '../src/components/AppListItem';
import { Logo } from '../src/components/Logo';
import { useAuthStore } from '../src/lib/auth';
import { useTheme } from '../src/theme/ThemeProvider';
import { iconSize, spacing, type } from '../src/theme/tokens';

const features = [
  { icon: CalendarDays, title: 'Appointments', copy: 'See the day’s bookings for every stylist.' },
  { icon: ShoppingBag, title: 'Point of sale', copy: 'Take cash and bank transfers with clear receipts.' },
  { icon: WifiOff, title: 'Works offline', copy: 'Keep taking cash on Android when the internet drops.' },
];

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const { hydrated, accessToken } = useAuthStore();
  if (hydrated && accessToken) return <Redirect href="/(app)" />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Logo />
        <View style={styles.hero}>
          <Text accessibilityRole="header" style={[type.display, { color: colors.text }]}>The front desk for your salon</Text>
          <Text style={[type.body, { color: colors.textMuted }]}>Appointments, customers and payments in one place, built for Sri Lankan beauty businesses.</Text>
          <View style={styles.features}>
            {features.map(({ icon: Icon, title, copy }) => (
              <View key={title} style={styles.feature}>
                <AppListIcon><Icon color={colors.primary} size={iconSize.md} /></AppListIcon>
                <View style={styles.featureCopy}>
                  <Text style={[type.bodyStrong, { color: colors.text }]}>{title}</Text>
                  <Text style={[type.caption, { color: colors.textMuted }]}>{copy}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.actions}>
          <AppButton label="Sign in" onPress={() => router.push('/login')} />
          <AppButton label="Create a business account" variant="secondary" onPress={() => router.push('/register')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { alignSelf: 'center', flex: 1, gap: spacing.xxl, justifyContent: 'space-between', maxWidth: 440, padding: spacing.xxl, width: '100%' },
  hero: { gap: spacing.md },
  features: { gap: spacing.lg, marginTop: spacing.lg },
  feature: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  featureCopy: { flex: 1, gap: spacing.xxs },
  actions: { gap: spacing.md },
});
