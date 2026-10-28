import { StyleSheet, Text, View } from 'react-native';
import type { Appointment } from '../lib/salon-api';
import { appointmentStatus, formatTime, fullName } from '../lib/format';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, type } from '../theme/tokens';
import { AppStatusBadge } from './AppStatusBadge';

/** One appointment in a list: time, customer, service and stylist, status. */
export function AppointmentRow({ appointment, divider, timeZone }: { appointment: Appointment; divider?: boolean; timeZone?: string }) {
  const { colors } = useTheme();
  const status = appointmentStatus[appointment.status] ?? { label: appointment.status, tone: 'neutral' as const };
  const name = fullName(appointment.customer);
  const details = [appointment.service?.name ?? 'Service', appointment.staffProfile?.user?.displayName].filter(Boolean).join(' · ');
  const time = formatTime(appointment.startsAt, timeZone);
  return (
    <View accessible accessibilityLabel={`${time}, ${name}, ${details}, ${status.label}`} style={[styles.row, divider && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <Text style={[type.bodyStrong, styles.time, { color: colors.text }]}>{time}</Text>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={[type.bodyStrong, { color: colors.text }]}>{name}</Text>
        <Text numberOfLines={1} style={[type.caption, { color: colors.textMuted }]}>{details}</Text>
      </View>
      <AppStatusBadge label={status.label} tone={status.tone} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 64, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  time: { fontVariant: ['tabular-nums'], width: 72 },
  copy: { flex: 1, gap: spacing.xxs },
});
