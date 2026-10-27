import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { Permission, ROLE_PERMISSIONS } from '../auth/auth.constants';
import { BranchPriceDto, PosCustomerDto, StockAdjustmentDto, VoidDto } from './pos.dto';
import { money } from './money';
import { ensureStock, moveStock, permittedBranches, requireBranch, Tx } from './pos-core';

@Injectable()
export class PosService {
  constructor(private readonly db: DatabaseService) {}
  async branches(tenantId: string, userId: string) {
    const allowed = await permittedBranches(this.db, tenantId, userId);
    return this.db.branch.findMany({ where: { tenantId, ...(allowed ? { id: { in: allowed } } : {}) }, orderBy: { name: 'asc' } });
  }
  async catalog(tenantId: string, userId: string, branchId: string) {
    await requireBranch(this.db, tenantId, userId, branchId);
    const items = await this.db.catalogItem.findMany({ where: { tenantId, active: true }, include: { prices: { where: { branchId } }, stocks: { where: { branchId } } }, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
    const singleBranch = await this.db.branch.count({ where: { tenantId } }) === 1;
    return items.filter(i => i.prices[0]?.active !== false).map(i => ({
      id: i.id, name: i.name, category: i.category ?? 'Uncategorized', type: i.type, trackInventory: i.trackInventory,
      priceLkr: (i.prices[0]?.priceLkr ?? i.priceLkr).toFixed(2), taxRateBps: i.prices[0]?.taxRateBps ?? i.taxRateBps, taxLabel: i.prices[0]?.taxLabel ?? i.taxLabel,
      stockQuantity: (i.stocks[0]?.quantity ?? (singleBranch ? i.stockQuantity : new Prisma.Decimal(0))).toFixed(0),
    }));
  }
  async categories(tenantId: string) {
    const rows = await this.db.catalogItem.findMany({ where: { tenantId, active: true, category: { not: null } }, distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } });
    return rows.map(r => r.category);
  }
  async price(tenantId: string, userId: string, branchId: string, itemId: string, dto: BranchPriceDto) {
    return this.tx(async tx => {
      await this.permission(tx, tenantId, userId, Permission.SERVICES_WRITE);
      await requireBranch(tx, tenantId, userId, branchId);
      if (!await tx.catalogItem.findFirst({ where: { tenantId, id: itemId } })) throw new NotFoundException('Item not found');
      const amount = money(dto.priceLkr);
      if (amount.lte(0)) throw new BadRequestException('Price must be positive');
      const data = { priceLkr: amount, taxRateBps: dto.taxRateBps, taxLabel: dto.taxLabel.trim(), active: dto.active };
      const result = await tx.branchPrice.upsert({ where: { tenantId_branchId_itemId: { tenantId, branchId, itemId } }, create: { tenantId, branchId, itemId, ...data }, update: data });
      await this.audit(tx, tenantId, userId, 'BRANCH_PRICE_CHANGED', 'CatalogItem', itemId, { branchId, ...dto });
      return result;
    });
  }
  async customer(tenantId: string, userId: string, dto: PosCustomerDto) {
    return this.tx(async tx => {
      await this.permission(tx, tenantId, userId, Permission.CUSTOMER_WRITE);
      return tx.customer.create({ data: { tenantId, firstName: dto.firstName.trim(), lastName: dto.lastName?.trim(), phone: dto.phone?.trim(), email: dto.email?.trim().toLowerCase() } });
    });
  }
  async policy(tenantId: string, userId: string, branchId: string, policy: string) {
    return this.tx(async tx => {
      await this.permission(tx, tenantId, userId, Permission.BUSINESS_SETTINGS_WRITE);
      await requireBranch(tx, tenantId, userId, branchId);
      const result = await tx.branch.update({ where: { id: branchId }, data: { stockPolicy: policy } });
      await this.audit(tx, tenantId, userId, 'STOCK_POLICY_CHANGED', 'Branch', branchId, { policy });
      return result;
    });
  }
  async inventory(tenantId: string, userId: string, branchId: string) {
    await requireBranch(this.db, tenantId, userId, branchId);
    return this.db.inventoryMovement.findMany({ where: { tenantId, branchId }, include: { item: { select: { name: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100 });
  }
  async adjust(tenantId: string, userId: string, key: string, dto: StockAdjustmentDto) {
    return this.command(tenantId, userId, key, { kind: 'stock', ...dto }, Permission.INVENTORY_WRITE, async tx => {
      await requireBranch(tx, tenantId, userId, dto.branchId);
      const item = await tx.catalogItem.findFirst({ where: { tenantId, id: dto.itemId, type: 'PRODUCT', trackInventory: true } });
      if (!item) throw new NotFoundException('Tracked product not found');
      await ensureStock(tx, tenantId, dto.branchId, dto.itemId);
      const balance = await moveStock(tx, tenantId, dto.branchId, dto.itemId, new Prisma.Decimal(dto.delta), 'ADJUSTMENT', dto.reason, userId);
      await this.audit(tx, tenantId, userId, 'STOCK_ADJUSTED', 'CatalogItem', dto.itemId, { ...dto, balance: balance.quantity.toString() });
      return { quantity: balance.quantity.toFixed(0) };
    });
  }
  async void(tenantId: string, userId: string, id: string, key: string, dto: VoidDto) {
    return this.command(tenantId, userId, key, { kind: 'void', id, ...dto }, Permission.VOIDS, async tx => {
      const sale = await tx.sale.findFirst({ where: { tenantId, id }, include: { lines: true, payments: true, refunds: true } });
      if (!sale) throw new NotFoundException('Sale not found');
      await requireBranch(tx, tenantId, userId, sale.branchId);
      if (sale.status !== 'OPEN' || sale.refunds.length || sale.payments.some(p => p.status !== 'PENDING')) throw new ConflictException('Only unpaid pending sales may be voided. Refund confirmed payments instead.');
      await tx.payment.updateMany({ where: { tenantId, saleId: id, status: 'PENDING' }, data: { status: 'FAILED', resolvedAt: new Date() } });
      for (const line of sale.lines) if (line.inventoryDeducted) await moveStock(tx, tenantId, sale.branchId, line.catalogItemId, line.quantity, 'VOID', dto.reason, userId, id);
      await tx.sale.update({ where: { id }, data: { status: 'VOIDED', voidedAt: new Date(), voidReason: dto.reason } });
      await this.audit(tx, tenantId, userId, 'SALE_VOIDED', 'Sale', id, { reason: dto.reason });
      return { id, status: 'VOIDED' };
    });
  }
  async auditLogs(tenantId: string) {
    return this.db.auditLog.findMany({ where: { tenantId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100 });
  }
  private async command(tenantId: string, userId: string, key: string, payload: object, permission: Permission, work: (tx: Tx) => Promise<Prisma.InputJsonObject>) {
    if (!key || !/^[A-Za-z0-9_-]{8,120}$/.test(key)) throw new BadRequestException('Valid idempotency-key required');
    const requestHash = createHash('sha256').update(JSON.stringify({ userId, payload })).digest('hex');
    return this.tx(async tx => {
      await this.permission(tx, tenantId, userId, permission);
      const previous = await tx.financialCommand.findUnique({ where: { tenantId_key: { tenantId, key } } });
      if (previous) { if (previous.requestHash !== requestHash) throw new ConflictException('Idempotency key belongs to another operation'); return previous.result; }
      const result = await work(tx);
      await tx.financialCommand.create({ data: { tenantId, key, requestHash, result } });
      return result;
    });
  }
  private async permission(tx: Tx, tenantId: string, userId: string, permission: Permission) {
    const member = await tx.membership.findUnique({ where: { tenantId_userId: { tenantId, userId } } });
    if (!member || !ROLE_PERMISSIONS[member.role].includes(permission)) throw new ForbiddenException('Insufficient permissions');
  }
  private audit(tx: Tx, tenantId: string, userId: string, action: string, entityType: string, entityId: string, metadata: Prisma.InputJsonObject) {
    return tx.auditLog.create({ data: { tenantId, actorUserId: userId, action, entityType, entityId, metadata } });
  }
  private async tx<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    for (let n = 0; n < 4; n++) {
      try { return await this.db.$transaction(work, { isolationLevel: 'Serializable', timeout: 20000 }); }
      catch (e) { if (!['P2034', 'P2002'].includes((e as { code?: string }).code ?? '')) throw e; }
    }
    throw new ConflictException('Concurrent change. Retry the same operation key.');
  }
}
