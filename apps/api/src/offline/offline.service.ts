import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { CheckoutService } from '../checkout/checkout.service';
import { Permission, ROLE_PERMISSIONS } from '../auth/auth.constants';
import { AccessTokenPayload } from '../auth/auth.types';
import { PrepareOfflineDto, RegisterOfflineDeviceDto, SyncCashDto } from './dto';
import { money } from '../checkout/money';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const limits = { sessionHours: 8, catalogHours: 4, maxSales: 50, maxSaleLkr: '100000.00', maxTotalLkr: '250000.00', uploadDays: 7 };
type Snapshot = { catalog: { id: string; name: string; priceLkr: string; type: string; trackInventory: boolean; stockQuantity: string; category: string | null }[]; staff: { id: string; user: { displayName: string } }[] };

@Injectable()
export class OfflineService {
  constructor(private readonly db: DatabaseService, private readonly checkout: CheckoutService) {}
  private prove(secret: string, expected?: string) {
    if (typeof secret !== 'string' || !/^[a-f0-9]{64}$/.test(secret)) throw new ForbiddenException('Registered device credentials required');
    if (expected && !timingSafeEqual(Buffer.from(digest(secret)), Buffer.from(expected))) throw new ForbiddenException('Registered device credentials required');
    return digest(secret);
  }
  private async member(tx: Prisma.TransactionClient, user: AccessTokenPayload, permission: Permission) {
    const member = await tx.membership.findUnique({ where: { tenantId_userId: { tenantId: user.tenantId, userId: user.sub } } });
    if (!member || !ROLE_PERMISSIONS[member.role].includes(permission)) throw new ForbiddenException('Offline checkout permission revoked');
  }
  async register(user: AccessTokenPayload, dto: RegisterOfflineDeviceDto, secret: string) {
    const secretHash = this.prove(secret);
    return this.serial(async tx => {
      await this.member(tx, user, Permission.BUSINESS_SETTINGS_WRITE);
      const prior = await tx.offlineDevice.findUnique({ where: { id: dto.id } });
      if (prior) {
        if (prior.tenantId !== user.tenantId || prior.secretHash !== secretHash || !prior.active) throw new ForbiddenException('Device cannot be registered');
        return { id: prior.id, name: prior.name };
      }
      if (await tx.offlineDevice.count({ where: { tenantId: user.tenantId, active: true } }) >= 3) throw new ConflictException('This business already has three registered offline devices');
      const device = await tx.offlineDevice.create({ data: { id: dto.id, tenantId: user.tenantId, name: dto.name.trim(), registeredBy: user.sub, secretHash } });
      await tx.auditLog.create({ data: { tenantId: user.tenantId, actorUserId: user.sub, action: 'OFFLINE_DEVICE_REGISTERED', entityType: 'OfflineDevice', entityId: device.id } });
      return { id: device.id, name: device.name };
    });
  }
  list(user: AccessTokenPayload) {
    return this.db.offlineDevice.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true, active: true, createdAt: true } });
  }
  async revoke(user: AccessTokenPayload, id: string) {
    return this.serial(async tx => {
      await this.member(tx, user, Permission.BUSINESS_SETTINGS_WRITE);
      const changed = await tx.offlineDevice.updateMany({ where: { id, tenantId: user.tenantId }, data: { active: false } });
      if (!changed.count) throw new NotFoundException('Device not found');
      await tx.offlineGrant.updateMany({ where: { deviceId: id, tenantId: user.tenantId }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: { tenantId: user.tenantId, actorUserId: user.sub, action: 'OFFLINE_DEVICE_REVOKED', entityType: 'OfflineDevice', entityId: id } });
      return { revoked: true };
    });
  }
  async prepare(user: AccessTokenPayload, dto: PrepareOfflineDto, secret: string) {
    return this.serial(async tx => {
      await this.member(tx, user, Permission.CHECKOUT);
      const device = await tx.offlineDevice.findFirst({ where: { id: dto.deviceId, tenantId: user.tenantId, active: true } });
      if (!device) throw new ForbiddenException('A manager must register this device online');
      this.prove(secret, device.secretHash);
      const branch = await tx.branch.findFirst({ where: { tenantId: user.tenantId, id: dto.branchId } });
      const shift = await tx.cashShift.findFirst({ where: { tenantId: user.tenantId, branchId: dto.branchId, status: 'OPEN' } });
      if (!branch || !shift) throw new ConflictException('Open an online cash shift for this branch before preparing offline checkout');
      const now = new Date();
      const existing = await tx.offlineGrant.findFirst({ where: { deviceId: device.id, expiresAt: { gt: now } }, orderBy: { issuedAt: 'desc' } });
      if (existing && (existing.userId !== user.sub || existing.branchId !== dto.branchId || existing.shiftId !== shift.id || existing.revokedAt)) throw new ConflictException('This device has another active offline session. Wait for its eight-hour window to finish, or resolve it with a manager.');
      const session = await tx.session.findFirst({ where: { id: user.sid, userId: user.sub, tenantId: user.tenantId, revokedAt: null, expiresAt: { gt: now } } });
      if (!session) throw new ForbiddenException('Sign in again before enabling offline checkout');
      const issuedAt = existing?.issuedAt ?? now;
      const expiresAt = existing?.expiresAt ?? new Date(Math.min(now.getTime() + limits.sessionHours * 3600000, session.expiresAt.getTime()));
      const catalog = await tx.catalogItem.findMany({ where: { tenantId: user.tenantId, active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, category: true, type: true, priceLkr: true, trackInventory: true, stockQuantity: true } });
      const staff = await tx.staffProfile.findMany({ where: { tenantId: user.tenantId, branchId: branch.id, active: true }, select: { id: true, user: { select: { displayName: true } } } });
      const snapshot = JSON.parse(JSON.stringify({ catalog, staff, catalogExpiresAt: new Date(Math.min(now.getTime() + limits.catalogHours * 3600000, expiresAt.getTime())).toISOString() })) as Prisma.InputJsonObject;
      const grant = existing
        ? await tx.offlineGrant.update({ where: { id: existing.id }, data: { snapshot, sessionId: user.sid } })
        : await tx.offlineGrant.create({ data: { tenantId: user.tenantId, userId: user.sub, sessionId: user.sid, deviceId: device.id, branchId: branch.id, shiftId: shift.id, issuedAt, expiresAt, snapshot } });
      const acknowledged = await tx.offlineOperation.findMany({ where: { grantId: grant.id, state: 'synchronized' }, select: { id: true } });
      return { grantId: grant.id, tenantId: user.tenantId, userId: user.sub, deviceId: device.id, branch, shiftId: shift.id, issuedAt: issuedAt.toISOString(), expiresAt: expiresAt.toISOString(), downloadedAt: now.toISOString(), catalogExpiresAt: new Date(Math.min(now.getTime() + limits.catalogHours * 3600000, expiresAt.getTime())).toISOString(), limits, acknowledgedOperationIds: acknowledged.map(row => row.id), usedCount: grant.usedCount, usedAmountLkr: grant.usedAmountLkr.toFixed(2), ...snapshot };
    });
  }

  async sync(user: AccessTokenPayload, dto: SyncCashDto, secret: string) {
    const input = dto.checkout;
    const fingerprint = digest(JSON.stringify({ operationId: dto.operationId, grantId: dto.grantId, deviceId: dto.deviceId,
      recordedAt: new Date(dto.recordedAt).toISOString(), checkout: { branchId: input.branchId, customerId: input.customerId ?? null,
        paymentMethod: input.paymentMethod, discountLkr: money(input.discountLkr).toFixed(2),
        cashReceivedLkr: input.cashReceivedLkr === undefined ? null : money(input.cashReceivedLkr).toFixed(2),
        expectedTotalLkr: input.expectedTotalLkr === undefined ? null : money(input.expectedTotalLkr).toFixed(2), bankReference: input.bankReference?.trim() ?? null,
        items: input.items.map(item => ({ itemId: item.itemId, quantity: item.quantity, assignedStaffProfileId: item.assignedStaffProfileId ?? null, expectedUnitPriceLkr: item.expectedUnitPriceLkr === undefined ? null : money(item.expectedUnitPriceLkr).toFixed(2) })) } }));
    // A response can be replayed after lease expiry, but only by the same authenticated user and device.
    const grant = await this.db.offlineGrant.findFirst({ where: { id: dto.grantId, tenantId: user.tenantId, userId: user.sub }, include: { device: true } });
    if (!grant) throw new ForbiddenException('Offline authorization belongs to another account or business');
    if (dto.deviceId !== grant.deviceId) throw new ForbiddenException('Operation belongs to another registered device');
    this.prove(secret, grant.device.secretHash);
    const replay = async () => {
      const prior = await this.db.offlineOperation.findUnique({ where: { id: dto.operationId } });
      if (!prior) return null;
      if (prior.grantId !== grant.id || prior.payloadHash !== fingerprint) throw new ConflictException('Operation ID was already used with different financial details');
      return prior.result;
    };
    const prior = await replay();
    if (prior) return prior;
    try {
      return await this.serial(async tx => {
        const current = await tx.offlineGrant.findUniqueOrThrow({ where: { id: grant.id }, include: { device: true } });
        const duplicate = await tx.offlineOperation.findUnique({ where: { id: dto.operationId } });
        if (duplicate) {
          if (duplicate.payloadHash !== fingerprint || duplicate.grantId !== grant.id) throw new ConflictException('Operation ID conflict');
          return duplicate.result;
        }
        await this.member(tx, user, Permission.CHECKOUT);
        if (!current.device.active || current.revokedAt) throw new ForbiddenException('Device or offline authorization was revoked. Manager review is required.');
        const recorded = new Date(dto.recordedAt), now = new Date();
        if (recorded < current.issuedAt || recorded >= current.expiresAt || recorded.getTime() > now.getTime() + 60000 || now.getTime() > current.expiresAt.getTime() + limits.uploadDays * 86400000) throw new ForbiddenException('Offline session expired or the recorded sale time is outside its authorization');
        const input = dto.checkout;
        if (input.paymentMethod !== 'CASH' || money(input.discountLkr).gt(0) || input.customerId || input.bankReference) throw new ForbiddenException('Offline v1 permits cash, walk-in sales without discounts only');
        if (input.branchId !== current.branchId) throw new ForbiddenException('Offline authorization is bound to another branch');
        const shift = await tx.cashShift.findFirst({ where: { id: current.shiftId, tenantId: user.tenantId, status: 'OPEN' } });
        if (!shift) throw new ConflictException('The original cash shift is closed. Reconcile the collected cash with a manager.');
        const snapshot = current.snapshot as unknown as Snapshot;
        const catalogDeadline = Date.parse((current.snapshot as { catalogExpiresAt: string }).catalogExpiresAt);
        if (!Number.isFinite(catalogDeadline) || recorded.getTime() >= catalogDeadline) throw new ForbiddenException('Catalog freshness limit expired at the time of this sale');
        for (const line of input.items) {
          const item = snapshot.catalog.find(item => item.id === line.itemId);
          if (!item || !line.expectedUnitPriceLkr || !money(line.expectedUnitPriceLkr).eq(money(item.priceLkr))) throw new ConflictException('Recorded price is outside the permitted catalog snapshot');
          if (line.assignedStaffProfileId && !snapshot.staff.some(staff => staff.id === line.assignedStaffProfileId)) throw new ForbiddenException('Staff was not authorized for this offline session');
        }
        if (!input.expectedTotalLkr) throw new BadRequestException('Locally recorded total is required');
        const total = money(input.expectedTotalLkr);
        if (total.gt(limits.maxSaleLkr) || current.usedCount >= limits.maxSales || current.usedAmountLkr.add(total).gt(limits.maxTotalLkr)) throw new ForbiddenException('Offline sale or session value limit exceeded');
        const sale = await this.checkout.checkout(user.tenantId, user.sub, 'offline-' + dto.operationId, input, tx);
        await tx.offlineGrant.update({ where: { id: grant.id }, data: { usedCount: { increment: 1 }, usedAmountLkr: { increment: total } } });
        const result = JSON.parse(JSON.stringify({ operationId: dto.operationId, state: 'synchronized', message: 'Confirmed by the server', saleId: sale.id, receiptNumber: sale.receiptNumber, receiptText: sale.receiptText })) as Prisma.InputJsonObject;
        await tx.offlineOperation.create({ data: { id: dto.operationId, grantId: grant.id, payloadHash: fingerprint, recordedAt: recorded, state: 'synchronized', saleId: sale.id, result } });
        await tx.auditLog.create({ data: { tenantId: user.tenantId, actorUserId: user.sub, action: 'OFFLINE_CASH_SYNCHRONIZED', entityType: 'Sale', entityId: sale.id, metadata: { operationId: dto.operationId, deviceId: current.deviceId, recordedAt: dto.recordedAt, grantId: grant.id } } });
        return result;
      });
    } catch (error) {
      const saved = await replay();
      if (saved) return saved;
      // Transient database/server failures never become permanent rejections.
      if (!(error instanceof HttpException) || error.getStatus() >= 500) throw error;
      const state = error.getStatus() === 409 ? 'conflicted' : 'rejected';
      const result = { operationId: dto.operationId, state, message: error.message };
      try {
        await this.db.offlineOperation.create({ data: { id: dto.operationId, grantId: grant.id, payloadHash: fingerprint, recordedAt: new Date(dto.recordedAt), state, result } });
      } catch (writeError) {
        if ((writeError as { code?: string }).code !== 'P2002') throw writeError;
        const duplicate = await replay();
        if (duplicate) return duplicate;
        throw writeError;
      }
      return result;
    }
  }
  private async serial<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt++) {
      try { return await this.db.$transaction(operation, { isolationLevel: 'Serializable', timeout: 20000, maxWait: 10000 }); }
      catch (error) { if (!['P2034', 'P2002'].includes((error as { code: string }).code)) throw error; }
    }
    throw new Error('Concurrent synchronization is busy. Retry the same operation.');
  }
}
