import { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppHeader } from './AppHeader';
import { Logo } from './Logo';

type AuthLayoutProps = PropsWithChildren<{
  title: string;
  description?: string;
  /** Show a back arrow instead of the logo. */
  onBack?: () => void;
  footer?: ReactNode;
}>;

/** Keyboard-safe, scrollable frame shared by the sign-in and onboarding screens. */
export function AuthLayout({ title, description, onBack, footer, children }: AuthLayoutProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
          <View style={styles.inner}>
            {onBack ? null : <Logo />}
            <AppHeader size="auth" title={title} description={description} onBack={onBack} />
            <View style={styles.body}>{children}</View>
          </View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxl, paddingTop: spacing.lg },
  inner: { alignSelf: 'center', gap: spacing.xxl, maxWidth: 440, width: '100%' },
  body: { gap: spacing.lg },
  footer: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center', paddingTop: spacing.xxl },
});
