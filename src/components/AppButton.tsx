import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { control, radius, spacing, type } from '../theme/tokens';

export type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'auth';

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
    danger: { background: colors.danger, text: colors.onDanger, border: colors.danger },
    auth: { background: colors.primary, text: colors.onPrimary, border: colors.primary },
  }[variant];

  return (
    <View
      style={[
        styles.frame,
        size === 'sm' ? styles.sm : styles.md,
        fullWidth ? styles.full : styles.inline,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          opacity: disabled && !loading ? 0.45 : 1,
        },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: !!inactive, busy: !!loading }}
        disabled={inactive}
        hitSlop={size === 'sm' ? 4 : undefined}
        style={({ pressed }) => [styles.pressable, pressed && { opacity: 0.82 }]}
        {...props}
      >
        {loading ? <ActivityIndicator color={palette.text} /> : (
          <View style={styles.content}>
            {icon}
            <Text numberOfLines={1} style={[size === 'sm' ? type.label : type.bodyStrong, { color: palette.text }]}>{label}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, justifyContent: 'center', minWidth: control.button, overflow: 'hidden' },
  pressable: { alignItems: 'center', alignSelf: 'stretch', flex: 1, height: '100%', justifyContent: 'center', width: '100%' },
  md: { height: control.button, minHeight: control.button },
  sm: { height: control.buttonSm, minHeight: control.buttonSm, paddingHorizontal: spacing.md },
  full: { alignSelf: 'stretch' },
  inline: { alignSelf: 'flex-start', flexShrink: 0 },
  content: { alignItems: 'center', flexDirection: 'row', flexShrink: 0, gap: spacing.sm },
});
