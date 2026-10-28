import type { StatusTone } from '../components/AppStatusBadge';

export const defaultTimezone = 'Asia/Colombo';

export function formatTime(iso: string, timeZone = defaultTimezone) {
  return new Date(iso).toLocaleTimeString('en-LK', { timeZone, hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(iso: string, timeZone = defaultTimezone) {
  return new Date(iso).toLocaleString('en-LK', { timeZone, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function greeting(timeZone = defaultTimezone, now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now));
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

export function fullName(person: { firstName: string; lastName?: string | null }) {
  return [person.firstName, person.lastName].filter(Boolean).join(' ');
}

export const appointmentStatus: Record<string, { label: string; tone: StatusTone }> = {
  BOOKED: { label: 'Booked', tone: 'info' },
  CONFIRMED: { label: 'Confirmed', tone: 'accent' },
  CHECKED_IN: { label: 'Checked in', tone: 'warning' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  NO_SHOW: { label: 'No-show', tone: 'danger' },
};

const saleStatuses: Record<string, { label: string; tone: StatusTone }> = {
  OPEN: { label: 'Transfer pending', tone: 'warning' },
  COMPLETED: { label: 'Paid', tone: 'success' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
  VOIDED: { label: 'Voided', tone: 'danger' },
};

export const saleStatus = (status: string) =>
  saleStatuses[status] ?? { label: status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' '), tone: 'neutral' as StatusTone };
