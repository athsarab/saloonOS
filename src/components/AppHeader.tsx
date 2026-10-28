import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { iconSize, spacing, touch, type } from '../theme/tokens';

type AppHeaderProps = {
  title: string;
  description?: string;
  /** @deprecated Kept for older call sites; prefer a clear title. */
  eyebrow?: string;
  /** Show a back button. `true` uses router history with `fallbackHref` when there is none. */
  back?: boolean;
  onBack?: () => void;
  fallbackHref?: Parameters<typeof router.navigate>[0];
  right?: ReactNode;
  size?: 'screen' | 'auth';
};

export function AppHeader({ title, description, eyebrow, back, onBack, fallbackHref = '/(app)/more', right, size = 'screen' }: AppHeaderProps) {
  const { colors } = useTheme();
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.navigate(fallbackHref)));
  const showBack = back || !!onBack;

  return (
    <View style={styles.wrap}>
      {showBack || right ? (
        <View style={styles.bar}>
          {showBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} onPress={goBack} style={styles.back}>
              <ArrowLeft color={colors.text} size={iconSize.lg} />
            </Pressable>
          ) : <View />}
          {right}
        </View>
      ) : null}
      {eyebrow ? <Text style={[type.micro, { color: colors.primary }]}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" style={[size === 'auth' ? type.display : type.title, { color: colors.text }]}>{title}</Text>
      {description ? <Text style={[type.body, { color: colors.textMuted }]}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs + 2 },
  bar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs, marginLeft: -spacing.sm, minHeight: touch.min },
  back: { alignItems: 'center', height: touch.min, justifyContent: 'center', width: touch.min },
});
