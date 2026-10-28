import { PropsWithChildren } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/tokens';

type AppCardProps = PropsWithChildren<{
  /** Set false for cards that hold edge-to-edge list rows. */
  padded?: boolean;
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}>;

export function AppCard({ children, padded = true, muted, style, onPress, accessibilityLabel }: AppCardProps) {
  const { colors } = useTheme();
  const cardStyle = [
    styles.card,
    padded && styles.padded,
    { backgroundColor: muted ? colors.surfaceMuted : colors.surface, borderColor: muted ? colors.surfaceMuted : colors.border },
    style,
  ];
  if (!onPress) return <View style={cardStyle}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [cardStyle, pressed && { backgroundColor: colors.surfaceMuted }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  padded: { gap: spacing.md, padding: spacing.lg },
});
