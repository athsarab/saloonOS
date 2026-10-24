import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './api';

export type DashboardStats = { total: number; completed: number; cancelled: number; upcoming: number };
export type Appointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  notes?: string | null;
  customer: { firstName: string; lastName?: string | null };
  service?: { name: string; durationMinutes?: number | null } | null;
  staffProfile?: { user?: { displayName: string } } | null;
};
type AppointmentPage = { items: Appointment[]; total: number; limit: number; offset: number };

const dayBounds = (date = new Date()) => {
  const from = new Date(date); from.setHours(0, 0, 0, 0);
  const to = new Date(from); to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
};

export function useDashboardStats() {
  const bounds = dayBounds();
  return useQuery({ queryKey: ['salon-dashboard', bounds.from], queryFn: () => apiRequest<DashboardStats>(`/v1/salon/dashboard?from=${encodeURIComponent(bounds.from)}&to=${encodeURIComponent(bounds.to)}`) });
}

export function useAppointments(date = new Date()) {
  const bounds = dayBounds(date);
  return useQuery({ queryKey: ['salon-appointments', bounds.from], queryFn: () => apiRequest<AppointmentPage>(`/v1/salon/appointments?from=${encodeURIComponent(bounds.from)}&to=${encodeURIComponent(bounds.to)}&limit=100`) });
}
