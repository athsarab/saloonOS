import { Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function AppHeader({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  const { colors } = useTheme();
  return <View style={styles.wrap}>{eyebrow ? <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text> : null}<Text style={[styles.title, { color: colors.text }]}>{title}</Text>{description ? <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text> : null}</View>;
}

const styles = StyleSheet.create({ wrap: { gap: 6 }, eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' }, title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 }, description: { fontSize: 15, lineHeight: 22 } });
