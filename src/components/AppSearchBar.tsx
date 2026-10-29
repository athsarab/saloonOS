import { Pressable, StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { control, iconSize, radius, spacing, touch, type } from '../theme/tokens';

type AppSearchBarProps = Omit<TextInputProps, 'onChangeText' | 'value'> & {
  value: string;
  onChangeText: (value: string) => void;
};

export function AppSearchBar({ value, onChangeText, placeholder = 'Search', accessibilityLabel, ...props }: AppSearchBarProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: colors.surfaceMuted }]}>
      <Search color={colors.textMuted} size={iconSize.md} />
      <TextInput
        accessibilityLabel={accessibilityLabel ?? placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, type.body, { color: colors.text }]}
        {...props}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} onPress={() => onChangeText('')} style={styles.clear}>
          <X color={colors.textMuted} size={iconSize.sm + 2} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { alignItems: 'center', borderRadius: radius.md, flexDirection: 'row', gap: spacing.sm, minHeight: control.input, paddingLeft: spacing.md },
  input: { flex: 1, minHeight: control.input, paddingVertical: spacing.sm },
  clear: { alignItems: 'center', height: touch.min, justifyContent: 'center', width: touch.min },
});
