import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './api';
import { useAuthStore } from './auth';

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

export type BusinessProfile = {
  id: string; name: string; slug: string;
  branches: { id: string; name: string; code: string; address: string | null; timezone: string }[];
};
export type Customer = { id: string; firstName: string; lastName: string | null; phone: string | null; email: string | null; notes: string | null; createdAt: string };
export type NewCustomer = { firstName: string; lastName?: string; phone?: string; email?: string; notes?: string };

const useScope = () => useAuthStore((state) => state.accessToken);

export function useBusinessProfile() {
  const scope = useScope();
  return useQuery({ queryKey: ['salon-profile', scope], queryFn: () => apiRequest<BusinessProfile>('/v1/salon/profile'), enabled: !!scope, staleTime: 5 * 60_000 });
}

export function useCustomerList(search: string) {
  const scope = useScope();
  return useQuery({
    queryKey: ['salon-customers', scope, search],
    queryFn: () => apiRequest<{ items: Customer[]; total: number }>(`/v1/salon/customers?limit=50&search=${encodeURIComponent(search)}`),
    enabled: !!scope,
    placeholderData: (previous) => previous,
  });
}

export function useCreateCustomer() {
  const query = useQueryClient();
  return useMutation({
    mutationFn: (customer: NewCustomer) => apiRequest<Customer>('/v1/salon/customers', { method: 'POST', body: JSON.stringify(customer) }),
    onSuccess: () => { void query.invalidateQueries({ queryKey: ['salon-customers'] }); void query.invalidateQueries({ queryKey: ['checkout'] }); },
    retry: false,
  });
}
