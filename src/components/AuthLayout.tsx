import { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppHeader } from './AppHeader';
import { AuthVisual } from './AuthVisual';

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
            <AuthVisual compact back={onBack} />
            <View style={[styles.panel, { backgroundColor: colors.surface, zIndex: 2 }]}>
              <AppHeader size="screen" title={title} description={description} />
              <View style={styles.body}>{children}</View>
            </View>
          </View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'space-between', paddingBottom: spacing.xxl },
  inner: { alignSelf: 'center', gap: 0, maxWidth: 440, width: '100%' },
  panel: { borderRadius: spacing.xl, marginTop: -spacing.xl, padding: spacing.xl, position: 'relative' },
  body: { gap: spacing.md },
  footer: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center', paddingTop: spacing.xxl },
});
