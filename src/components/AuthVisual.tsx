import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { iconSize, radius, spacing, touch, type } from '../theme/tokens';

type AuthVisualProps = {
  children?: ReactNode;
  back?: () => void;
  compact?: boolean;
};

export function AuthVisual({ children, back, compact = false }: AuthVisualProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.hero, compact ? styles.compact : styles.fullHero, { backgroundColor: colors.info }]}>
      <View style={[styles.orb, styles.orbTop, { backgroundColor: colors.primary, opacity: 0.75 }]} />
      <View style={[styles.orb, styles.orbLight, { backgroundColor: colors.primarySoft }]} />
      <View style={[styles.orb, styles.orbBottom, { backgroundColor: colors.navigation }]} />
      {back ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={back} style={styles.back}>
          <ArrowLeft color={colors.onPrimary} size={iconSize.md} />
          <Text style={[type.label, { color: colors.onPrimary }]}>Back</Text>
        </Pressable>
      ) : (
        <View style={styles.brand}>
          <Text style={[type.heading, { color: colors.onInfo }]}>SalonOS</Text>
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { overflow: 'hidden', position: 'relative' },
  fullHero: { borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl, minHeight: 420, zIndex: 0 },
  compact: { minHeight: 196 },
  brand: { left: spacing.xxl, position: 'absolute', top: spacing.xl },
  back: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, left: spacing.lg, minHeight: touch.min, position: 'absolute', top: spacing.md },
  orb: { borderRadius: radius.pill, position: 'absolute' },
  orbTop: { height: 150, left: -48, top: -62, width: 150 },
  orbLight: { height: 210, right: -66, top: -72, width: 210 },
  orbBottom: { bottom: -132, height: 280, left: 40, opacity: 0.24, width: 280 },
});
