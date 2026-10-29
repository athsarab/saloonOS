import { Redirect, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthVisual } from '../src/components/AuthVisual';
import { AppButton } from '../src/components/AppButton';
import { useAuthStore } from '../src/lib/auth';
import { useTheme } from '../src/theme/ThemeProvider';
import { spacing, type } from '../src/theme/tokens';

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const { hydrated, accessToken } = useAuthStore();
  if (hydrated && accessToken) return <Redirect href="/(app)" />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <AuthVisual>
          <View style={styles.welcomeCopy}>
            <Text accessibilityRole="header" style={[type.display, { color: colors.onInfo }]}>Welcome to SalonOS</Text>
            <Text style={[type.body, { color: colors.onInfo, opacity: 0.88 }]}>Run appointments, customers and payments with confidence.</Text>
          </View>
        </AuthVisual>
        <View style={[styles.actions, { backgroundColor: colors.surface }]}>
          <AppButton label="Sign in" variant="auth" onPress={() => router.push('/login')} />
          <AppButton label="Sign up" variant="secondary" onPress={() => router.push('/register')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { alignSelf: 'center', flex: 1, justifyContent: 'space-between', maxWidth: 440, width: '100%' },
  welcomeCopy: { bottom: 76, gap: spacing.md, left: spacing.xxl, position: 'absolute', right: spacing.xxl },
  actions: { borderTopLeftRadius: spacing.xl, borderTopRightRadius: spacing.xl, gap: spacing.md, marginTop: -spacing.xl, padding: spacing.xxl, position: 'relative' },
});
