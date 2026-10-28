import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { touch, type } from '../theme/tokens';

/** Inline text action with a full-size touch target. */
export function TextLink({ label, onPress, align = 'auto' }: { label: string; onPress: () => void; align?: 'auto' | 'center' | 'right' }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} hitSlop={6} onPress={onPress} style={[styles.link, align === 'right' && styles.right, align === 'center' && styles.center]}>
      <Text style={[type.label, { color: colors.primary, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { justifyContent: 'center', minHeight: touch.min },
  right: { alignSelf: 'flex-end' },
  center: { alignSelf: 'center' },
});
