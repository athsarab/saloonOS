import { createHash } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OfflineService } from '../src/offline/offline.service';
import type { AccessTokenPayload } from '../src/auth/auth.types';
import type { SyncCashDto } from '../src/offline/dto';
const secret = 'a'.repeat(64);
const hashSecret = createHash('sha256').update(secret).digest('hex');
describe('Server-authorized offline cash synchronization', () => {
  let db: any, checkout: any, service: OfflineService, grant: any;
  const user: AccessTokenPayload = { sub: 'owner', tenantId: 'tenant', sid: 'session', role: 'OWNER' };
  const request = (): SyncCashDto => ({
    operationId: 'operation-1', grantId: 'grant-1', deviceId: 'device-1', recordedAt: new Date().toISOString(),
    checkout: { branchId: 'branch', discountLkr: '0', paymentMethod: 'CASH', cashReceivedLkr: '20.00', expectedTotalLkr: '19.99', items: [{ itemId: 'item', quantity: '1', expectedUnitPriceLkr: '19.99' }] },
  });
  beforeEach(() => {
    grant = {
      id: 'grant-1', tenantId: 'tenant', userId: 'owner', deviceId: 'device-1', branchId: 'branch', shiftId: 'shift',
      issuedAt: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() + 3600000), revokedAt: null,
      usedCount: 0, usedAmountLkr: new Prisma.Decimal('0'),
      device: { id: 'device-1', tenantId: 'tenant', active: true, secretHash: hashSecret },
      snapshot: { catalog: [{ id: 'item', priceLkr: '19.99' }], staff: [], catalogExpiresAt: new Date(Date.now() + 3600000).toISOString() },
    };
    db = {
      offlineGrant: { findFirst: jest.fn().mockResolvedValue(grant), findUniqueOrThrow: jest.fn().mockResolvedValue(grant), update: jest.fn().mockResolvedValue(grant) },
      offlineDevice: { findUnique: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(3), create: jest.fn() },
      offlineOperation: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(async ({ data }: any) => data) },
      membership: { findUnique: jest.fn().mockResolvedValue({ role: 'CASHIER' }) },
      cashShift: { findFirst: jest.fn().mockResolvedValue({ id: 'shift' }) },
      auditLog: { create: jest.fn() },
    };
    db.$transaction = jest.fn(async (operation: any) => operation(db));
    checkout = { checkout: jest.fn().mockResolvedValue({ id: 'sale-1', receiptNumber: 'SAL-FINAL', receiptText: 'Server receipt' }) };
    service = new OfflineService(db, checkout);
  });
  it('synchronizes cash atomically, forwards the stable backend idempotency key and audits its origin', async () => {
    const dto = request();
    const result = await service.sync(user, dto, secret) as any;
    expect(result.state).toBe('synchronized');
    expect(checkout.checkout).toHaveBeenCalledWith('tenant', 'owner', 'offline-operation-1', dto.checkout, db);
    expect(db.offlineGrant.update).toHaveBeenCalledWith(expect.objectContaining({ data: { usedCount: { increment: 1 }, usedAmountLkr: { increment: expect.any(Prisma.Decimal) } } }));
    expect(db.offlineOperation.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ saleId: 'sale-1', state: 'synchronized' }) }));
  });
  it('replays a synchronized operation after lease expiry without creating another sale', async () => {
    const dto = request(); const result = await service.sync(user, dto, secret);
    const persisted = db.offlineOperation.create.mock.calls[0][0].data;
    db.offlineOperation.findUnique.mockResolvedValue(persisted);
    grant.expiresAt = new Date(Date.now() - 86400000);
    expect(await service.sync(user, dto, secret)).toEqual(result);
    expect(await service.sync(user, Object.fromEntries(Object.entries(dto).reverse()) as unknown as SyncCashDto, secret)).toEqual(result);
    expect(checkout.checkout).toHaveBeenCalledTimes(1);
    await expect(service.sync(user, { ...dto, checkout: { ...dto.checkout, cashReceivedLkr: '99' } }, secret)).rejects.toThrow('different financial');
  });
  it('blocks forged device secrets and another account or business', async () => {
    await expect(service.sync(user, request(), 'b'.repeat(64))).rejects.toThrow(ForbiddenException);
    db.offlineGrant.findFirst.mockResolvedValue(null);
    await expect(service.sync({ ...user, sub: 'other' }, request(), secret)).rejects.toThrow(ForbiddenException);
    expect(checkout.checkout).not.toHaveBeenCalled();
  });
  it.each(['device', 'grant', 'expired', 'catalog', 'limit', 'value', 'electronic', 'discount', 'shift'])('records a durable decision for %s authorization failure', async mode => {
    const dto = request();
    if (mode === 'device') grant.device.active = false;
    if (mode === 'grant') grant.revokedAt = new Date();
    if (mode === 'expired') grant.expiresAt = new Date(Date.now() - 1000);
    if (mode === 'catalog') grant.snapshot.catalogExpiresAt = new Date(Date.now() - 1000).toISOString();
    if (mode === 'limit') grant.usedCount = 50;
    if (mode === 'value') grant.usedAmountLkr = new Prisma.Decimal('250000');
    if (mode === 'electronic') dto.checkout.paymentMethod = 'BANK_TRANSFER';
    if (mode === 'discount') dto.checkout.discountLkr = '1';
    if (mode === 'shift') db.cashShift.findFirst.mockResolvedValue(null);
    const result = await service.sync(user, dto, secret) as any;
    expect(result.state).toBe(mode === 'shift' ? 'conflicted' : 'rejected');
    expect(checkout.checkout).not.toHaveBeenCalled();
  });
  it('does not silently reprice a cached catalog conflict', async () => {
    const dto = request(); dto.checkout.items[0].expectedUnitPriceLkr = '1.00';
    const result = await service.sync(user, dto, secret) as any;
    expect(result.state).toBe('conflicted');
    expect(checkout.checkout).not.toHaveBeenCalled();
  });
  it('keeps server errors retriable without persisting a rejection', async () => {
    checkout.checkout.mockRejectedValue(new Error('Database interrupted'));
    await expect(service.sync(user, request(), secret)).rejects.toThrow('Database interrupted');
    expect(db.offlineOperation.create).not.toHaveBeenCalled();
  });
  it('enforces manager registration and the three-device cap', async () => {
    await expect(service.register(user, { id: 'device', name: 'Till' }, secret)).rejects.toThrow(ForbiddenException);
    db.membership.findUnique.mockResolvedValue({ role: 'OWNER' });
    await expect(service.register(user, { id: 'device', name: 'Till' }, secret)).rejects.toThrow('three registered');
    expect(db.offlineDevice.create).not.toHaveBeenCalled();
  });
});
