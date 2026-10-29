import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, touch, type } from '../theme/tokens';

type AppSectionHeaderProps = { title: string; actionLabel?: string; onAction?: () => void; action?: ReactNode };

export function AppSectionHeader({ title, actionLabel, onAction, action }: AppSectionHeaderProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text accessibilityRole="header" style={[type.heading, styles.title, { color: colors.text }]}>{title}</Text>
      {action}
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${actionLabel}: ${title}`} hitSlop={8} onPress={onAction} style={styles.action}>
          <Text style={[type.label, { color: colors.primary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between', minHeight: touch.min - 12 },
  title: { flexShrink: 1 },
  action: { justifyContent: 'center', minHeight: touch.min },
});
