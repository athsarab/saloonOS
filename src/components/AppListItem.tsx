import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { iconSize, layout, radius, spacing, type } from '../theme/tokens';

type AppListItemProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  divider?: boolean;
  destructive?: boolean;
  accessibilityLabel?: string;
};

export function AppListItem({ title, subtitle, leading, trailing, onPress, chevron = !!onPress, divider, destructive, accessibilityLabel }: AppListItemProps) {
  const { colors } = useTheme();
  const body = (
    <>
      {leading}
      <View style={styles.copy}>
        <Text numberOfLines={1} style={[type.bodyStrong, { color: destructive ? colors.danger : colors.text }]}>{title}</Text>
        {subtitle ? <Text numberOfLines={2} style={[type.caption, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {trailing}
      {chevron ? <ChevronRight color={colors.textSubtle} size={iconSize.md} /> : null}
    </>
  );
  const rowStyle = [styles.row, divider && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }];
  if (!onPress) return <View style={rowStyle}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      onPress={onPress}
      style={({ pressed }) => [rowStyle, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      {body}
    </Pressable>
  );
}

/** Square tile for a list item's leading icon. */
export function AppListIcon({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'neutral' | 'danger' }) {
  const { colors } = useTheme();
  const backgroundColor = tone === 'accent' ? colors.primarySoft : tone === 'danger' ? colors.dangerSoft : colors.surfaceMuted;
  return <View style={[styles.icon, { backgroundColor }]}>{children}</View>;
}

/** Circular initials avatar for people. */
export function AppAvatar({ name }: { name: string }) {
  const { colors } = useTheme();
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
  return (
    <View importantForAccessibility="no" style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
      <Text style={[type.micro, { color: colors.primary }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', borderBottomWidth: 0, flexDirection: 'row', gap: spacing.md, minHeight: 60, paddingHorizontal: layout.screenGutter, paddingVertical: spacing.md },
  copy: { flex: 1, gap: spacing.xxs },
  icon: { alignItems: 'center', borderRadius: radius.sm + 2, height: 36, justifyContent: 'center', width: 36 },
  avatar: { alignItems: 'center', borderRadius: radius.pill, height: 36, justifyContent: 'center', width: 36 },
});
