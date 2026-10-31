import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './api';
import { useAuthStore } from './auth';

export type DashboardStats = { total: number; completed: number; cancelled: number; upcoming: number };
export type Appointment = {
  id: string;
  branchId: string;
  customerId: string;
  serviceId: string;
  staffProfileId?: string | null;
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

export type SalonService = { id: string; name: string; category: string | null; description: string | null; priceLkr: string; durationMinutes: number | null; active: boolean };
export type SalonStaff = { id: string; branchId: string; title: string | null; user: { displayName: string; email?: string }; active: boolean };
export type StaffJobs = {
  staff: SalonStaff & { user: { id: string; displayName: string; email: string }; branch: { name: string } };
  appointments: { id: string; startsAt: string; customer: { firstName: string; lastName?: string | null }; service?: { name: string } | null }[];
  sales: { id: string; itemName: string; quantity: string; lineTotalLkr: string; sale: { id: string; receiptNumber: string; createdAt: string; customerName?: string | null } }[];
};

export function useAppointments(date = new Date(), filters?: { staffProfileId?: string; status?: string }) {
  const bounds = dayBounds(date);
  const query = new URLSearchParams({ from: bounds.from, to: bounds.to, limit: '100' });
  if (filters?.staffProfileId) query.set('staffProfileId', filters.staffProfileId);
  if (filters?.status) query.set('status', filters.status);
  return useQuery({ queryKey: ['salon-appointments', bounds.from, filters], queryFn: () => apiRequest<AppointmentPage>(`/v1/salon/appointments?${query.toString()}`) });
}

export function useAppointment(id?: string) {
  const scope = useScope();
  return useQuery({ queryKey: ['salon-appointment', scope, id], queryFn: () => apiRequest<Appointment & { branch?: { name: string; timezone: string }; notes?: string | null }>(`/v1/salon/appointments/${id}`), enabled: !!scope && !!id });
}

export function useSalonServices(search = '') {
  const scope = useScope();
  return useQuery({ queryKey: ['salon-services', scope, search], queryFn: () => apiRequest<{ items: SalonService[]; total: number }>(`/v1/salon/services?limit=100&search=${encodeURIComponent(search)}`), enabled: !!scope });
}

export function useSalonStaff() {
  const scope = useScope();
  return useQuery({ queryKey: ['salon-staff', scope], queryFn: () => apiRequest<SalonStaff[]>('/v1/salon/staff'), enabled: !!scope });
}

export function useMyJobs(enabled = true) {
  const scope = useScope();
  return useQuery({ queryKey: ['salon-my-jobs', scope], queryFn: () => apiRequest<StaffJobs>('/v1/salon/staff/me/jobs'), enabled: !!scope && enabled });
}

export function useStaffJobs(id?: string) {
  const scope = useScope();
  return useQuery({ queryKey: ['salon-staff-jobs', scope, id], queryFn: () => apiRequest<StaffJobs>(`/v1/salon/staff/${id}/jobs`), enabled: !!scope && !!id });
}

export type AppointmentInput = { branchId: string; customerId: string; serviceId: string; staffProfileId?: string; startsAt: string; notes?: string };

export function useCreateAppointment() {
  const query = useQueryClient();
  return useMutation({
    mutationFn: (payload: AppointmentInput) => apiRequest<Appointment>('/v1/salon/appointments', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => { void query.invalidateQueries({ queryKey: ['salon-appointments'] }); void query.invalidateQueries({ queryKey: ['salon-dashboard'] }); },
    retry: false,
  });
}

export function useUpdateAppointment() {
  const query = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<AppointmentInput> & { id: string; status?: string }) => apiRequest<Appointment>(`/v1/salon/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    onSuccess: () => { void query.invalidateQueries({ queryKey: ['salon-appointments'] }); void query.invalidateQueries({ queryKey: ['salon-appointment'] }); void query.invalidateQueries({ queryKey: ['salon-dashboard'] }); },
    retry: false,
  });
}

export type BusinessProfile = {
  id: string; name: string; slug: string;
  whatsappRemindersEnabled: boolean;
  branches: { id: string; name: string; code: string; address: string | null; timezone: string }[];
};
export type NewBranch = { name: string; code: string; address?: string; timezone?: string };
export type NewSalonService = { name: string; category?: string; description?: string; priceLkr: number; durationMinutes: number };
export type NewStaffMember = { displayName: string; email: string; password: string; branchId: string; title?: string; role: 'STYLIST' | 'CASHIER' };
export type Customer = { id: string; firstName: string; lastName: string | null; phone: string | null; email: string | null; notes: string | null; createdAt: string };
export type CustomerDetail = Customer & { appointments: Appointment[] };
export type NewCustomer = { firstName: string; lastName?: string; phone?: string; email?: string; notes?: string };

const useScope = () => useAuthStore((state) => state.accessToken);

export function useBusinessProfile() {
  const scope = useScope();
  return useQuery({ queryKey: ['salon-profile', scope], queryFn: () => apiRequest<BusinessProfile>('/v1/salon/profile'), enabled: !!scope, staleTime: 5 * 60_000 });
}

export function useUpdateBusinessProfile() {
  const query = useQueryClient();
  return useMutation({
    mutationFn: (payload: { whatsappRemindersEnabled?: boolean; name?: string; address?: string }) => apiRequest<BusinessProfile>('/v1/salon/profile', { method: 'PATCH', body: JSON.stringify(payload) }),
    onSuccess: () => { void query.invalidateQueries({ queryKey: ['salon-profile'] }); },
    retry: false,
  });
}

export function useCreateBranch() {
  const query = useQueryClient();
  return useMutation({
    mutationFn: (branch: NewBranch) => apiRequest<BusinessProfile['branches'][number]>('/v1/salon/branches', { method: 'POST', body: JSON.stringify(branch) }),
    onSuccess: () => { void query.invalidateQueries({ queryKey: ['salon-profile'] }); void query.invalidateQueries({ queryKey: ['checkout'] }); },
    retry: false,
  });
}

export function useCreateSalonService() {
  const query = useQueryClient();
  return useMutation({
    mutationFn: (service: NewSalonService) => apiRequest<SalonService>('/v1/salon/services', { method: 'POST', body: JSON.stringify(service) }),
    onSuccess: () => { void query.invalidateQueries({ queryKey: ['salon-services'] }); void query.invalidateQueries({ queryKey: ['checkout'] }); },
    retry: false,
  });
}

export function useCreateStaffMember() {
  const query = useQueryClient();
  return useMutation({
    mutationFn: (member: NewStaffMember) => apiRequest<SalonStaff>('/v1/salon/staff/members', { method: 'POST', body: JSON.stringify(member) }),
    onSuccess: () => { void query.invalidateQueries({ queryKey: ['salon-staff'] }); void query.invalidateQueries({ queryKey: ['checkout'] }); },
    retry: false,
  });
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

export function useCustomer(id?: string) {
  const scope = useScope();
  return useQuery({
    queryKey: ['salon-customer', scope, id],
    queryFn: () => apiRequest<CustomerDetail>(`/v1/salon/customers/${id}`),
    enabled: Boolean(scope && id),
  });
}
