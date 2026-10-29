import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Moon, Sun, Stars } from 'lucide-react-native';
import { Appearance, useTheme } from '../theme/ThemeProvider';
import { iconSize, radius, spacing, type } from '../theme/tokens';

const options: { value: Appearance; label: string; description: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', description: 'Bright and crisp', icon: Sun },
  { value: 'dark', label: 'Dark', description: 'Comfortable contrast', icon: Moon },
  { value: 'night', label: 'Night', description: 'Low-glare evening mode', icon: Stars },
];

export function AppThemeSelector() {
  const { colors, appearance, setAppearance } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={styles.group}>
      {options.map(({ value, label, description, icon: Icon }) => {
        const selected = value === appearance;
        return (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => setAppearance(value)}
            style={({ pressed }) => [styles.option, { backgroundColor: selected ? colors.primarySoft : colors.surface, borderColor: selected ? colors.primary : colors.border, opacity: pressed ? 0.8 : 1 }]}
          >
            <Icon color={selected ? colors.primary : colors.textMuted} size={iconSize.md} />
            <View style={styles.copy}>
              <Text style={[type.bodyStrong, { color: colors.text }]}>{label}</Text>
              <Text style={[type.caption, { color: colors.textMuted }]}>{description}</Text>
            </View>
            <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.borderStrong }]}>{selected ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}</View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  option: { alignItems: 'center', borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 64, paddingHorizontal: spacing.md },
  copy: { flex: 1, gap: spacing.xxs },
  radio: { alignItems: 'center', borderRadius: radius.pill, borderWidth: 2, height: 20, justifyContent: 'center', width: 20 },
  dot: { borderRadius: radius.pill, height: 10, width: 10 },
});
