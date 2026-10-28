import { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, Home, LucideIcon, MoreHorizontal, ShoppingBag, Users } from 'lucide-react-native';
import { usePermissions } from '../lib/permissions';
import { useTheme } from '../theme/ThemeProvider';
import { iconSize, radius, spacing, type } from '../theme/tokens';
import { AppOfflineBanner } from './AppOfflineBanner';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

type Destination = { name: string; label: string; icon: LucideIcon; permission?: 'checkout' };

export const destinations: Destination[] = [
  { name: 'index', label: 'Home', icon: Home },
  { name: 'appointments', label: 'Appointments', icon: CalendarDays },
  { name: 'checkout', label: 'POS', icon: ShoppingBag, permission: 'checkout' },
  { name: 'customers', label: 'Customers', icon: Users },
  { name: 'more', label: 'More', icon: MoreHorizontal },
];

// Sub-screens highlight the destination they belong to.
const parentOf: Record<string, string> = {
  sales: 'more', settings: 'more', sync: 'more', 'account-security': 'more', 'offline-checkout': 'checkout',
};

export function AppTabBar({ state, emitter, navigateToTab }: TabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { can } = usePermissions();
  const focusedName = state.routes[state.index]?.name ?? 'index';
  const active = parentOf[focusedName] ?? focusedName;
  const visible = destinations.filter((item) => !item.permission || can(item.permission));

  return (
    <View>
      <AppOfflineBanner />
      <View accessibilityRole="tablist" style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        {visible.map((item) => {
          const route = state.routes.find((value) => value.name === item.name);
          if (!route) return null;
          const selected = active === item.name;
          const color = selected ? colors.primary : colors.textMuted;
          const Icon = item.icon;
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (focusedName !== item.name && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <Pressable
              key={item.name}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              onPress={onPress}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              style={styles.item}
            >
              <View style={[styles.indicator, selected && { backgroundColor: colors.primarySoft }]}>
                <Icon color={color} size={iconSize.lg - 2} strokeWidth={selected ? 2.25 : 2} />
              </View>
              <Text numberOfLines={1} style={[type.micro, { color: selected ? colors.primary : colors.textMuted }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', paddingHorizontal: spacing.xs, paddingTop: spacing.xs + 2 },
  item: { alignItems: 'center', flex: 1, gap: spacing.xxs, justifyContent: 'center', minHeight: 56 },
  indicator: { alignItems: 'center', borderRadius: radius.pill, height: 30, justifyContent: 'center', width: 56 },
});
