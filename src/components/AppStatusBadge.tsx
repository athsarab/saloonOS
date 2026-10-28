import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing, type } from '../theme/tokens';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

export function AppStatusBadge({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  const { colors } = useTheme();
  const palette = {
    success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning],
    danger: [colors.dangerSoft, colors.danger],
    info: [colors.infoSoft, colors.info],
    neutral: [colors.surfaceMuted, colors.textMuted],
    accent: [colors.primarySoft, colors.primary],
  }[tone];
  return (
    <View accessibilityLabel={`Status: ${label}`} style={[styles.badge, { backgroundColor: palette[0] }]}>
      <Text numberOfLines={1} style={[type.micro, { color: palette[1] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs + 1 },
});
