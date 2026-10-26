import { cents, decimal } from '../lib/money';
import type { CheckoutRequest } from '../lib/checkout-api';
import type { OfflineOperation, OfflineSnapshot } from './types';

export function offlineQuote(snapshot: OfflineSnapshot, request: CheckoutRequest, now: number, lastClock = 0) {
  if (now < Date.parse(snapshot.issuedAt) || now + 60000 < lastClock) throw new Error('Device clock moved backwards. Reconnect and refresh offline authorization.');
  if (now >= Date.parse(snapshot.expiresAt)) throw new Error('Offline session expired. Sign in and prepare checkout online again.');
  if (now >= Date.parse(snapshot.catalogExpiresAt)) throw new Error('Catalog is older than four hours. Refresh it online before taking more cash.');
  if (request.paymentMethod !== 'CASH' || cents(request.discountLkr) !== 0n || request.customerId || request.bankReference) throw new Error('Offline checkout permits cash walk-in sales without discounts only.');
  if (request.branchId !== snapshot.branch.id) throw new Error('Offline checkout is authorized for another branch.');
  if (!request.items.length || request.items.length > 100) throw new Error('Select 1 to 100 items.');
  let total = 0n;
  for (const input of request.items) {
    if (!/^[1-9]\d{0,5}$/.test(input.quantity)) throw new Error('Quantity must be a positive whole number.');
    const item = snapshot.catalog.find(item => item.id === input.itemId);
    if (!item || !input.expectedUnitPriceLkr || cents(item.priceLkr) !== cents(input.expectedUnitPriceLkr)) throw new Error('Item or price is not in your downloaded catalog.');
    if (item.type === 'SERVICE' && !snapshot.staff.some(staff => staff.id === input.assignedStaffProfileId)) throw new Error('Assign an authorized staff member to every service.');
    if (item.type === 'PRODUCT' && input.assignedStaffProfileId) throw new Error('Only services may have assigned staff.');
    total += cents(item.priceLkr) * BigInt(input.quantity);
  }
  if (total <= 0n || total > cents(snapshot.limits.maxSaleLkr)) throw new Error('Sale exceeds the offline transaction limit.');
  if (!request.cashReceivedLkr || cents(request.cashReceivedLkr) < total) throw new Error('Enter sufficient cash received.');
  if (request.expectedTotalLkr && cents(request.expectedTotalLkr) !== total) throw new Error('Recorded total does not match the cached prices.');
  return { totalLkr: decimal(total), changeLkr: decimal(cents(request.cashReceivedLkr) - total) };
}

export function assertBudget(snapshot: OfflineSnapshot, operations: OfflineOperation[], request: CheckoutRequest, total: string) {
  const acknowledged = new Set(snapshot.acknowledgedOperationIds);
  const unacknowledged = operations.filter(operation => !acknowledged.has(operation.operationId));
  if (snapshot.usedCount + unacknowledged.length >= snapshot.limits.maxSales ||
      cents(snapshot.usedAmountLkr) + unacknowledged.reduce((sum, operation) => sum + cents(operation.checkout.expectedTotalLkr!), 0n) + cents(total) > cents(snapshot.limits.maxTotalLkr)) throw new Error('Offline session sale count or cash value limit reached. Synchronize and consult a manager.');
  const requested = new Map<string, bigint>();
  for (const operation of [...unacknowledged.map(operation => operation.checkout), request]) {
    for (const line of operation.items) requested.set(line.itemId, (requested.get(line.itemId) ?? 0n) + BigInt(line.quantity));
  }
  for (const item of snapshot.catalog) {
    // Stock is a decimal DB field; whole-unit sales use the integral portion conservatively.
    if (item.trackInventory && (requested.get(item.id) ?? 0n) > BigInt(item.stockQuantity.split('.')[0])) throw new Error('Not enough locally available stock for ' + item.name + '.');
  }
}
export const retryDelay = (attempts: number, jitter = Math.random()) =>
  Math.min(300000, 2000 * 2 ** Math.min(attempts, 8)) + Math.floor(Math.max(0, Math.min(jitter, 1)) * 1000);
