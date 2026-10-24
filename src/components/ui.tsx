import { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function Screen({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  return <View style={[styles.screen, { backgroundColor: colors.background }]}>{children}</View>;
}

export function Card({ children, style }: PropsWithChildren<{ style?: object }>) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}

type ButtonProps = PressableProps & { label: string; variant?: 'primary' | 'secondary' | 'ghost'; loading?: boolean };
export function Button({ label, variant = 'primary', loading, disabled, ...props }: ButtonProps) {
  const { colors } = useTheme();
  const backgroundColor = variant === 'primary' ? colors.primary : variant === 'secondary' ? colors.surfaceMuted : 'transparent';
  const textColor = variant === 'primary' ? '#FFFFFF' : colors.text;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || loading }} disabled={disabled || loading} style={({ pressed }) => [styles.button, { backgroundColor, opacity: pressed || disabled ? 0.72 : 1, borderColor: colors.border, borderWidth: variant === 'secondary' ? 1 : 0 }, variant === 'ghost' && styles.ghost]} {...props}>{loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>}</Pressable>;
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const { colors } = useTheme();
  return <View style={styles.field}><Text style={[styles.label, { color: colors.text }]}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border }]} {...props} />{error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return <View style={styles.sectionRow}><Text className="font-semibold" style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>{action}</View>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  const { colors } = useTheme();
  return <View style={styles.empty}><Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.emptyDescription, { color: colors.textMuted }]}>{description}</Text></View>;
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const { colors } = useTheme();
  return <View style={styles.empty}><ActivityIndicator color={colors.primary} /><Text style={[styles.emptyDescription, { color: colors.textMuted }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, card: { borderRadius: 18, borderWidth: 1, padding: 18 }, button: { alignItems: 'center', borderRadius: 13, justifyContent: 'center', minHeight: 52, paddingHorizontal: 18 }, ghost: { minHeight: 44 }, buttonText: { fontSize: 16, fontWeight: '700' }, field: { gap: 8 }, label: { fontSize: 14, fontWeight: '600' }, input: { borderRadius: 12, borderWidth: 1, fontSize: 16, minHeight: 52, paddingHorizontal: 15 }, error: { fontSize: 13 }, sectionRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, sectionTitle: { fontSize: 18 }, empty: { alignItems: 'center', gap: 12, justifyContent: 'center', minHeight: 150, padding: 24 }, emptyTitle: { fontSize: 17, fontWeight: '700' }, emptyDescription: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
