import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './api';
import { useAuthStore } from './auth';

export type CatalogItem = { id: string; name: string; category: string | null; type: 'SERVICE' | 'PRODUCT'; priceLkr: string; trackInventory: boolean; stockQuantity: string };
export type CheckoutCustomer = { id: string; firstName: string; lastName: string | null; phone: string | null };
export type CheckoutStaff = { id: string; user: { displayName: string } };
export type Branch = { id: string; name: string; timezone: string };
export type Sale = {
  id: string; receiptNumber: string; subtotalLkr: string; discountLkr: string; totalLkr: string;
  refundableLkr: string; refundedLkr: string; receiptText: string; status: string; createdAt: string;
  changeLkr: string | null; cashReceivedLkr: string | null;
  lines: { id: string; itemName: string; quantity: string; unitPriceLkr: string; lineTotalLkr: string }[];
  payments: { id: string; method: string; status: string; amountLkr: string; reference: string | null }[];
  refunds: { id: string; amountLkr: string; status: string; reason: string }[];
};
export type Shift = { id: string; openingAmountLkr: string; cashSalesLkr: string; cashRefundsLkr: string; expectedClosingLkr: string; differenceLkr: string | null; status: string; openedAt: string };
export type Quote = { subtotalLkr: string; discountLkr: string; totalLkr: string };
export type DailyReport = { date: string; timezone: string; salesCount: number; pendingCount: number; grossLkr: string; discountsLkr: string; collectedLkr: string; refundsLkr: string; netLkr: string; payments: Record<string, string> };
export type CheckoutRequest = {
  branchId: string; customerId?: string; discountLkr: string; paymentMethod: 'CASH' | 'BANK_TRANSFER';
  cashReceivedLkr?: string; bankReference?: string; expectedTotalLkr?: string;
  items: { itemId: string; quantity: string; assignedStaffProfileId?: string; expectedUnitPriceLkr?: string }[];
};
export type NewCatalogItem = { name: string; category?: string; type: CatalogItem['type']; priceLkr: string; trackInventory?: boolean; stockQuantity: string };

// Retain this key with its exact payload until a pending online request is resolved.
export const requestKey = () => 'pos-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

function useScope() { return useAuthStore(state => state.accessToken); }
export function useCheckoutAccess() {
  const scope = useScope();
  return useQuery({ queryKey: ['checkout', scope, 'access'], queryFn: () => apiRequest<{ role: string; permissions: string[] }>('/v1/checkout/access'), enabled: !!scope, retry: false });
}
export function useBranches() {
  const scope = useScope();
  return useQuery({ queryKey: ['checkout', scope, 'branches'], queryFn: () => apiRequest<Branch[]>('/v1/salon/branches'), enabled: !!scope });
}
export function useCatalog(search = '') {
  const scope = useScope();
  return useQuery({ queryKey: ['checkout', scope, 'catalog', search], queryFn: () => apiRequest<CatalogItem[]>('/v1/checkout/catalog?search=' + encodeURIComponent(search)), enabled: !!scope });
}
export function useCreateCatalogItem() {
  const query = useQueryClient();
  return useMutation({
    mutationFn: (item: NewCatalogItem) => apiRequest<CatalogItem>('/v1/checkout/catalog', { method: 'POST', body: JSON.stringify(item) }),
    onSuccess: () => { void query.invalidateQueries({ queryKey: ['checkout'] }); void query.invalidateQueries({ queryKey: ['salon-services'] }); },
    retry: false,
  });
}
export function useCustomers(search: string) {
  const scope = useScope();
  return useQuery({ queryKey: ['checkout', scope, 'customers', search], queryFn: () => apiRequest<CheckoutCustomer[]>('/v1/checkout/customers?search=' + encodeURIComponent(search)), enabled: !!scope });
}
export function useStaff(branchId?: string) {
  const scope = useScope();
  return useQuery({ queryKey: ['checkout', scope, 'staff', branchId], queryFn: () => apiRequest<CheckoutStaff[]>('/v1/checkout/staff?branchId=' + branchId), enabled: !!scope && !!branchId });
}
export function useCurrentShift(branchId?: string) {
  const scope = useScope();
  return useQuery({ queryKey: ['checkout', scope, 'shift', branchId], queryFn: () => apiRequest<Shift | null>('/v1/checkout/shifts/current?branchId=' + branchId), enabled: !!scope && !!branchId });
}
function useInvalidate() {
  const query = useQueryClient();
  return () => { void query.invalidateQueries({ queryKey: ['checkout'] }); void query.invalidateQueries({ queryKey: ['salon-dashboard'] }); };
}
export function useOpenShift() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (payload: { branchId: string; openingAmountLkr: string }) => apiRequest<Shift>('/v1/checkout/shifts', { method: 'POST', body: JSON.stringify(payload) }), onSuccess: invalidate, retry: false });
}
export function useCloseShift() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (payload: { shiftId: string; closingAmountLkr: string }) => apiRequest<Shift>('/v1/checkout/shifts/' + payload.shiftId + '/close', { method: 'POST', body: JSON.stringify({ closingAmountLkr: payload.closingAmountLkr }) }), onSuccess: invalidate, retry: false });
}
export function useCheckout() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ payload, idempotencyKey }: { payload: CheckoutRequest; idempotencyKey: string }) => apiRequest<Sale>('/v1/checkout/sales', { method: 'POST', headers: { 'idempotency-key': idempotencyKey }, body: JSON.stringify(payload) }),
    onSuccess: invalidate, retry: false,
  });
}
export function useQuote() {
  return useMutation({ mutationFn: (payload: CheckoutRequest) => apiRequest<Quote>('/v1/checkout/quote', { method: 'POST', body: JSON.stringify(payload) }), retry: false });
}
export function useSalesHistory(branchId?: string, offset = 0) {
  const scope = useScope();
  return useQuery({ queryKey: ['checkout', scope, 'sales', branchId, offset], queryFn: () => apiRequest<{ items: Sale[]; total: number; limit: number; offset: number }>('/v1/checkout/sales?branchId=' + branchId + '&offset=' + offset + '&limit=20'), enabled: !!branchId && !!scope });
}
export function useSaleReceipt(id?: string) {
  const scope = useScope();
  return useQuery({ queryKey: ['checkout', scope, 'receipt', id], queryFn: () => apiRequest<Sale>('/v1/checkout/sales/' + id + '/receipt'), enabled: !!id && !!scope });
}
export function useDailyReport(branchId?: string, date?: string, enabled = true) {
  const scope = useScope();
  return useQuery({ queryKey: ['checkout', scope, 'report', branchId, date], queryFn: () => apiRequest<DailyReport>('/v1/checkout/report/daily?branchId=' + branchId + (date ? '&date=' + date : '')), enabled: !!branchId && !!scope && enabled });
}
export function useRefund() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: { saleId: string; amountLkr: string; reason: string; idempotencyKey: string }) => apiRequest('/v1/checkout/sales/' + payload.saleId + '/refunds', { method: 'POST', headers: { 'idempotency-key': payload.idempotencyKey }, body: JSON.stringify({ amountLkr: payload.amountLkr, reason: payload.reason }) }),
    onSuccess: invalidate, retry: false,
  });
}
export function useVerifyTransfer() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: ({ paymentId, status }: { paymentId: string; status: 'VERIFIED' | 'FAILED' }) => apiRequest('/v1/checkout/payments/' + paymentId + '/verify-transfer', { method: 'POST', body: JSON.stringify({ status }) }), onSuccess: invalidate, retry: false });
}
