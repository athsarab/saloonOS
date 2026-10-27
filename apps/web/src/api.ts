let refreshing: Promise<Response> | undefined;
export async function api<T>(path: string, body?: unknown, key?: string): Promise<T> {
  const send = () => fetch('/api/backend/' + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
  let response = await send();
  if (response.status === 401 && !path.startsWith('auth/')) {
    refreshing ??= fetch('/api/backend/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).finally(() => { refreshing = undefined; });
    const renewed = await refreshing;
    if (renewed.ok) response = await send();
    else { window.location.assign('/login'); throw new Error('Your session expired. Sign in again.'); }
  }
  const data = await response.json();
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? data.error?.message ?? 'Request failed');
  return data as T;
}
// Format strings with integer cents. Financial arithmetic stays on the API.
export function lkr(value: string = '0') {
  const [whole, fraction = ''] = value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return 'LKR ' + grouped + '.' + fraction.padEnd(2, '0').slice(0, 2);
}
export type Item = { id: string; name: string; category: string; type: 'SERVICE' | 'PRODUCT'; priceLkr: string; stockQuantity: string; trackInventory: boolean; taxRateBps: number; taxLabel: string };
export type Branch = { id: string; name: string; code: string; stockPolicy: string };
export type Customer = { id: string; firstName: string; lastName?: string; phone?: string };
export type Staff = { id: string; user: { displayName: string } };
export type Sale = { id: string; receiptNumber: string; branchName: string; customerName?: string; createdAt: string; status: string; subtotalLkr: string; discountLkr: string; taxLkr: string; totalLkr: string; refundableLkr: string; refundedLkr: string; receiptText: string; payments: { id: string; method: string; status: string; reference?: string }[]; lines: { id: string; itemName: string; quantity: string; unitPriceLkr: string; lineTotalLkr: string; taxLkr: string; taxLabel: string }[] };
export type Shift = { id: string; openingAmountLkr: string; cashSalesLkr: string; cashRefundsLkr: string; expectedClosingLkr: string };
export type Report = { date: string; timezone: string; asOf: string; salesCount: number; pendingCount: number; grossLkr: string; discountsLkr: string; taxLkr: string; collectedLkr: string; refundsLkr: string; netLkr: string; payments: Record<string, string> };
