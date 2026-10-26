import type { CatalogItem, CheckoutRequest, CheckoutStaff, Branch } from '../lib/checkout-api';
export type OfflineSnapshot = {
  grantId: string; tenantId: string; userId: string; deviceId: string;
  branch: Branch; shiftId: string; issuedAt: string; expiresAt: string; downloadedAt: string; catalogExpiresAt: string;
  catalog: CatalogItem[]; staff: CheckoutStaff[]; usedCount: number; usedAmountLkr: string;
  acknowledgedOperationIds: string[];
  limits: { sessionHours: number; catalogHours: number; maxSales: number; maxSaleLkr: string; maxTotalLkr: string; uploadDays: number };
};
export type OfflineState = 'pending' | 'syncing' | 'synchronized' | 'rejected' | 'conflicted' | 'blocked';
export type OfflineOperation = {
  operationId: string; grantId: string; deviceId: string; recordedAt: string; checkout: CheckoutRequest;
  provisionalReceipt: string;
};
export type SyncResult = { operationId: string; state: 'synchronized' | 'rejected' | 'conflicted'; message: string; saleId?: string; receiptNumber?: string; receiptText?: string };
export type QueueRow = { id: string; scope: string; grant_id: string; state: OfflineState; body: string; result: string | null; attempts: number; next_retry_at: number; message: string; created_at: number };
export type QueueItem = Omit<QueueRow, 'body' | 'result'> & { operation: OfflineOperation; result: SyncResult | null };
export type DeviceCredential = { id: string; secret: string };
export const scopeFor = (snapshot: Pick<OfflineSnapshot, 'tenantId' | 'userId'>) => snapshot.tenantId + ':' + snapshot.userId;
export function sessionScope(token: string | null): string | null {
  try {
    const encoded = token!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='))) as { sub?: string; tenantId?: string };
    return payload.sub && payload.tenantId ? payload.tenantId + ':' + payload.sub : null;
  } catch { return null; }
}
