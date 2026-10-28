import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing, type } from '../theme/tokens';

export type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type AppButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: AppButtonVariant;
  size?: 'md' | 'sm';
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AppButton({ label, variant = 'primary', size = 'md', loading, disabled, icon, fullWidth = true, style, accessibilityLabel, ...props }: AppButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const palette = {
    primary: { background: colors.primary, text: colors.onPrimary, border: colors.primary },
    secondary: { background: colors.surface, text: colors.text, border: colors.borderStrong },
    ghost: { background: 'transparent', text: colors.primary, border: 'transparent' },
    danger: { background: colors.danger, text: '#FFFFFF', border: colors.danger },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      hitSlop={size === 'sm' ? 4 : undefined}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: palette.background, borderColor: palette.border, opacity: disabled && !loading ? 0.45 : pressed ? 0.82 : 1 },
        fullWidth ? styles.full : styles.inline,
        style,
      ]}
      {...props}
    >
      {loading ? <ActivityIndicator color={palette.text} /> : (
        <View style={styles.content}>
          {icon}
          <Text numberOfLines={1} style={[size === 'sm' ? type.label : type.bodyStrong, { color: palette.text }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', borderRadius: radius.md, borderWidth: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  md: { minHeight: 48 },
  sm: { minHeight: 40, paddingHorizontal: spacing.md },
  full: { alignSelf: 'stretch' },
  inline: { alignSelf: 'flex-start' },
  content: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
});
