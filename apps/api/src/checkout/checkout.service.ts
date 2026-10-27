import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CatalogItemType, PaymentMethod, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { Permission, ROLE_PERMISSIONS } from '../auth/auth.constants';
import { CatalogDto, CheckoutDto, CloseShiftDto, OpenShiftDto, RefundDto, SalesQueryDto, VerifyTransferDto } from './dto';
import { money, zero } from './money';
import { allocateDiscount, ensureStock, moveStock, permittedBranches, requireBranch } from './pos-core';

const includeSale = {
  lines: { include: { assignedStaffProfile: { include: { user: { select: { displayName: true } } } } } },
  payments: true, customer: true, branch: true, refunds: true,
} as const;
type SaleRecord = Prisma.SaleGetPayload<{ include: typeof includeSale }>;
type Tx = Prisma.TransactionClient;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

@Injectable()
export class CheckoutService {
  constructor(private readonly db: DatabaseService) {}

  async catalog(tenantId: string, search?: string) {
    return this.db.catalogItem.findMany({
      where: { tenantId, active: true, ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { category: { contains: search, mode: 'insensitive' as const } }] } : {}) },
      orderBy: [{ type: 'asc' }, { category: 'asc' }, { name: 'asc' }],
    });
  }
  async createCatalog(tenantId: string, userId: string, dto: CatalogDto) {
    return this.transaction(async tx => {
      await this.authorize(tx, tenantId, userId, Permission.INVENTORY_WRITE);
      const price = money(dto.priceLkr);
      if (price.lte(0)) throw new BadRequestException('Price must be positive');
      if (!/^\d{1,7}$/.test(dto.stockQuantity)) throw new BadRequestException('Stock must be a nonnegative whole number');
      const branches = await tx.branch.findMany({ where: { tenantId }, select: { id: true } });
      if (branches.length !== 1 && new Prisma.Decimal(dto.stockQuantity).gt(0)) throw new BadRequestException('Create with zero stock, then record stock for each branch');
      const item = await tx.catalogItem.create({ data: { tenantId, name: dto.name.trim(), category: dto.category?.trim(), type: dto.type, priceLkr: price, trackInventory: dto.type === 'PRODUCT' && dto.trackInventory, stockQuantity: dto.stockQuantity } });
      if (item.trackInventory && branches.length === 1) await ensureStock(tx, tenantId, branches[0].id, item.id);
      await this.audit(tx, tenantId, userId, 'CATALOG_CREATED', 'CatalogItem', item.id, { stockQuantity: dto.stockQuantity, priceLkr: price.toFixed(2) });
      return item;
    });
  }
  async customers(tenantId: string, search?: string) {
    return this.db.customer.findMany({ where: { tenantId, ...(search ? { OR: [{ firstName: { contains: search, mode: 'insensitive' as const } }, { lastName: { contains: search, mode: 'insensitive' as const } }, { phone: { contains: search } }] } : {}) }, orderBy: { firstName: 'asc' }, take: 50 });
  }
  async staff(tenantId: string, branchId: string, userId?: string) {
    if (userId) await requireBranch(this.db, tenantId, userId, branchId);
    return this.db.staffProfile.findMany({ where: { tenantId, branchId, active: true }, include: { user: { select: { id: true, displayName: true } } }, orderBy: { user: { displayName: 'asc' } } });
  }
  async access(tenantId: string, userId: string) {
    const membership = await this.db.membership.findUnique({ where: { tenantId_userId: { tenantId, userId } } });
    if (!membership) throw new ForbiddenException('Business membership required');
    return { role: membership.role, permissions: ROLE_PERMISSIONS[membership.role] };
  }

  private async priceCart(tx: Tx, tenantId: string, userId: string, dto: CheckoutDto) {
    await this.authorize(tx, tenantId, userId, Permission.CHECKOUT);
    const discount = money(dto.discountLkr);
    if (discount.gt(0)) await this.authorize(tx, tenantId, userId, Permission.DISCOUNTS);
    if (!Object.values(PaymentMethod).includes(dto.paymentMethod)) throw new BadRequestException('Unsupported payment method');
    const branch = await requireBranch(tx, tenantId, userId, dto.branchId);
    if (!branch) throw new NotFoundException('Branch not found');
    if (dto.customerId && !await tx.customer.findFirst({ where: { id: dto.customerId, tenantId } })) throw new NotFoundException('Customer not found');
    if (!Array.isArray(dto.items) || !dto.items.length || dto.items.length > 100) throw new BadRequestException('Select 1 to 100 items');
    const ids = dto.items.map(line => line.itemId);
    const items = await tx.catalogItem.findMany({ where: { tenantId, active: true, id: { in: ids } } });
    const overrides = await tx.branchPrice.findMany({ where: { tenantId, branchId: dto.branchId, itemId: { in: ids } } });
    const itemMap = new Map(items.map(item => { const override = overrides.find(p => p.itemId === item.id); return [item.id, override ? { ...item, ...override } : item]; }));
    let subtotal = zero();
    const lines: Prisma.SaleLineUncheckedCreateWithoutSaleInput[] = [];
    const grouped = new Map<string, typeof dto.items[number]>();
    for (const input of dto.items) {
      if (!/^[1-9]\d{0,5}$/.test(input.quantity)) throw new BadRequestException('Quantity must be a positive whole number');
      const key = input.itemId + ':' + (input.assignedStaffProfileId ?? '');
      const previous = grouped.get(key);
      if (previous && previous.expectedUnitPriceLkr !== input.expectedUnitPriceLkr) throw new BadRequestException('Conflicting expected prices for an item');
      grouped.set(key, { ...input, quantity: previous ? new Prisma.Decimal(previous.quantity).add(input.quantity).toFixed(0) : input.quantity });
    }
    for (const input of [...grouped.values()].sort((a,b) => (a.itemId + (a.assignedStaffProfileId ?? '')).localeCompare(b.itemId + (b.assignedStaffProfileId ?? '')))) {
      const item = itemMap.get(input.itemId);
      if (!item || !item.active) throw new NotFoundException('Catalog item not found');
      if (!/^[1-9]\d{0,5}$/.test(input.quantity)) throw new BadRequestException('Quantity must be a positive whole number');
      const quantity = new Prisma.Decimal(input.quantity);
      const unitPrice = money(item.priceLkr);
      if (input.expectedUnitPriceLkr !== undefined && !unitPrice.eq(money(input.expectedUnitPriceLkr))) throw new ConflictException('An item price changed. Refresh the catalog and review the cart.');
      if (item.type === CatalogItemType.SERVICE && !input.assignedStaffProfileId) throw new BadRequestException('Assign a staff member to every service');
      if (input.assignedStaffProfileId) {
        if (item.type !== CatalogItemType.SERVICE) throw new BadRequestException('Only services can have assigned staff');
        if (!await tx.staffProfile.findFirst({ where: { tenantId, id: input.assignedStaffProfileId, branchId: dto.branchId, active: true } })) throw new NotFoundException('Assigned staff member not found in this branch');
      }
      const lineTotal = money(unitPrice.mul(quantity));
      subtotal = subtotal.add(lineTotal);
      lines.push({ catalogItemId: item.id, itemName: item.name, itemType: item.type, inventoryDeducted: item.type === 'PRODUCT' && item.trackInventory, quantity, unitPriceLkr: unitPrice, lineTotalLkr: lineTotal, assignedStaffProfileId: input.assignedStaffProfileId, taxRateBps: item.taxRateBps, taxLabel: item.taxLabel });
    }
    money(subtotal);
    if (discount.gt(subtotal)) throw new BadRequestException('Discount cannot exceed subtotal');
    const allocated = allocateDiscount(lines.map(l => ({ key: l.catalogItemId + ':' + (l.assignedStaffProfileId ?? ''), gross: new Prisma.Decimal(l.lineTotalLkr as Prisma.Decimal) })), discount);
    let tax = zero();
    lines.forEach((line, index) => {
      const net = new Prisma.Decimal(line.lineTotalLkr as Prisma.Decimal).sub(allocated[index]);
      const lineTax = net.mul(line.taxRateBps ?? 0).div(10000).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      line.discountLkr = allocated[index]; line.taxLkr = lineTax; line.lineTotalLkr = net.add(lineTax); tax = tax.add(lineTax);
    });
    const total = money(subtotal.sub(discount).add(tax));
    if (total.lte(0)) throw new BadRequestException('Total must be greater than zero');
    if (dto.expectedTotalLkr !== undefined && !total.eq(money(dto.expectedTotalLkr))) throw new ConflictException('Total changed. Review the latest quote before paying.');
    return { branch, subtotal, discount, tax, total, lines };
  }

  async quote(tenantId: string, userId: string, dto: CheckoutDto) {
    return this.transaction(async tx => {
      const priced = await this.priceCart(tx, tenantId, userId, dto);
      return { subtotalLkr: priced.subtotal.toFixed(2), discountLkr: priced.discount.toFixed(2), taxLkr: priced.tax.toFixed(2), totalLkr: priced.total.toFixed(2) };
    });
  }

  async checkout(tenantId: string, userId: string, key: string, dto: CheckoutDto, transactionClient?: Prisma.TransactionClient) {
    this.validateKey(key);
    const fingerprint = hash({ userId, branchId: dto.branchId, customerId: dto.customerId ?? null, items: dto.items.map(line => ({ itemId: line.itemId, quantity: line.quantity, staff: line.assignedStaffProfileId ?? null, price: line.expectedUnitPriceLkr ?? null })), discount: money(dto.discountLkr).toFixed(2), method: dto.paymentMethod, cash: dto.cashReceivedLkr ?? null, reference: dto.bankReference?.trim() ?? null, total: dto.expectedTotalLkr ?? null });
    const replay = (sale: SaleRecord) => {
      if (sale.requestHash !== fingerprint) throw new ConflictException('This checkout key was already used for a different request');
      return this.serializeSale(sale);
    };
    try {
      return await this.transaction(async tx => {
        await this.authorize(tx, tenantId, userId, Permission.CHECKOUT);
        const existing = await tx.sale.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } }, include: includeSale });
        if (existing) { await requireBranch(tx, tenantId, userId, existing.branchId); return replay(existing); }
        const priced = await this.priceCart(tx, tenantId, userId, dto);
        let cashShiftId: string | undefined;
        let cash: Prisma.Decimal | undefined;
        if (dto.paymentMethod === 'CASH') {
          const shift = await tx.cashShift.findFirst({ where: { tenantId, branchId: dto.branchId, status: 'OPEN' } });
          if (!shift) throw new ConflictException('Open a cash shift before accepting cash');
          cashShiftId = shift.id;
          cash = dto.cashReceivedLkr === undefined ? undefined : money(dto.cashReceivedLkr);
          if (!cash || cash.lt(priced.total)) throw new BadRequestException('Enter cash received covering the total');
        } else if (!dto.bankReference?.trim()) throw new BadRequestException('Bank reference is required');
        const saleId = randomUUID();
        for (const line of priced.lines) if (line.inventoryDeducted) {
          await moveStock(tx, tenantId, dto.branchId, line.catalogItemId, new Prisma.Decimal(line.quantity as Prisma.Decimal).neg(), 'SALE', 'Checkout', userId, saleId);
        }
        const sequence = await tx.branch.update({ where: { id: dto.branchId }, data: { receiptCounter: { increment: 1 } } });
        const customer = dto.customerId ? await tx.customer.findFirst({ where: { tenantId, id: dto.customerId } }) : null;
        const confirmed = dto.paymentMethod === 'CASH';
        const sale = await tx.sale.create({
          data: {
            id: saleId, tenantId, branchId: dto.branchId, customerId: dto.customerId, cashShiftId,
            receiptSequence: sequence.receiptCounter, branchName: priced.branch.name, branchAddress: priced.branch.address, customerName: customer ? [customer.firstName, customer.lastName].filter(Boolean).join(" ") : null,
            createdByUserId: userId, requestHash: fingerprint, idempotencyKey: key,
            receiptNumber: priced.branch.code + '-' + String(sequence.receiptCounter).padStart(6, '0'),
            subtotalLkr: priced.subtotal, discountLkr: priced.discount, taxLkr: priced.tax, totalLkr: priced.total,
            cashReceivedLkr: cash, changeLkr: cash?.sub(priced.total), status: confirmed ? 'COMPLETED' : 'OPEN',
            lines: { create: priced.lines },
            payments: { create: { amountLkr: priced.total, method: dto.paymentMethod, status: confirmed ? 'VERIFIED' : 'PENDING', verifiedAt: confirmed ? new Date() : null, resolvedAt: confirmed ? new Date() : null, reference: dto.bankReference?.trim(), idempotencyKey: key } },
          }, include: includeSale,
        });
        await this.audit(tx, tenantId, userId, 'SALE_CREATED', 'Sale', sale.id, { receiptNumber: sale.receiptNumber, totalLkr: priced.total.toFixed(2), discountLkr: priced.discount.toFixed(2), paymentStatus: confirmed ? 'VERIFIED' : 'PENDING', items: priced.lines.map(line => ({ itemId: line.catalogItemId, quantity: String(line.quantity), unitPriceLkr: String(line.unitPriceLkr) })) });
        return this.serializeSale(sale);
      }, false, transactionClient);
    } catch (error) {
      if (this.errorCode(error) === 'P2002') {
        const duplicate = await this.db.sale.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } }, include: includeSale });
        if (duplicate) return replay(duplicate);
        throw new ConflictException('Receipt or payment already exists. Retry the same request.');
      }
      throw error;
    }
  }

  async sales(tenantId: string, query: SalesQueryDto, userId?: string) {
    const branches = userId ? await permittedBranches(this.db, tenantId, userId) : undefined;
    if (userId && query.branchId) await requireBranch(this.db, tenantId, userId, query.branchId);
    const where: Prisma.SaleWhereInput = { tenantId, ...(branches ? { branchId: { in: branches } } : {}), ...(query.branchId ? { branchId: query.branchId } : {}), ...(query.from || query.to ? { createdAt: this.range(query) } : {}) };
    const limit = query.limit ?? 30, offset = query.offset ?? 0;
    const [items, total] = await this.db.$transaction([
      this.db.sale.findMany({ where, include: includeSale, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: offset, take: limit }),
      this.db.sale.count({ where }),
    ], { isolationLevel: 'RepeatableRead' });
    return { items: items.map(sale => this.serializeSale(sale)), total, limit, offset };
  }
  async receipt(tenantId: string, id: string, userId?: string) {
    const sale = await this.db.sale.findFirst({ where: { tenantId, id }, include: includeSale });
    if (!sale) throw new NotFoundException('Sale not found');
    if (userId) await requireBranch(this.db, tenantId, userId, sale.branchId);
    return this.serializeSale(sale);
  }

  async refund(tenantId: string, userId: string, saleId: string, dto: RefundDto, key: string) {
    this.validateKey(key);
    const amount = money(dto.amountLkr);
    if (amount.lte(0) || dto.reason.trim().length < 3) throw new BadRequestException('Enter a positive refund and a reason');
    const fingerprint = hash({ saleId, amount: amount.toFixed(2), reason: dto.reason.trim(), userId });
    return this.transaction(async tx => {
      await this.authorize(tx, tenantId, userId, Permission.REFUNDS);
      const duplicate = await tx.refund.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } } });
      if (duplicate) {
        if (duplicate.requestHash !== fingerprint) throw new ConflictException('Refund key already used for another request');
        return { ...duplicate, amountLkr: duplicate.amountLkr.toFixed(2) };
      }
      const sale = await tx.sale.findFirst({ where: { id: saleId, tenantId }, include: { payments: true, refunds: { where: { status: 'COMPLETED' } } } });
      if (!sale) throw new NotFoundException('Sale not found');
      const paid = sale.payments.filter(payment => payment.status === 'VERIFIED').reduce((sum, payment) => sum.add(payment.amountLkr), zero());
      const refunded = sale.refunds.reduce((sum, refund) => sum.add(refund.amountLkr), zero());
      if (amount.gt(paid.sub(refunded))) throw new ConflictException('Refund exceeds the remaining confirmed payment');
      let cashShiftId: string | undefined;
      if (sale.payments.some(payment => payment.method === 'CASH' && payment.status === 'VERIFIED')) {
        const shift = await tx.cashShift.findFirst({ where: { tenantId, branchId: sale.branchId, status: 'OPEN' } });
        if (!shift) throw new ConflictException('Open a cash shift before paying a cash refund');
        cashShiftId = shift.id;
      }
      const refund = await tx.refund.create({ data: { tenantId, saleId, amountLkr: amount, reason: dto.reason.trim(), createdByUserId: userId, cashShiftId, idempotencyKey: key, requestHash: fingerprint } });
      await tx.sale.update({ where: { id: saleId }, data: { status: refunded.add(amount).eq(paid) ? 'REFUNDED' : 'COMPLETED' } });
      await this.audit(tx, tenantId, userId, 'SALE_REFUNDED', 'Sale', saleId, { refundId: refund.id, amountLkr: amount.toFixed(2), reason: dto.reason.trim() });
      return { ...refund, amountLkr: amount.toFixed(2) };
    }, true);
  }

  async verifyTransfer(tenantId: string, userId: string, paymentId: string, dto: VerifyTransferDto, key = `resolve_${paymentId}_${dto.status ?? "VERIFIED"}`) {
    return this.transaction(async tx => {
      await this.authorize(tx, tenantId, userId, Permission.PAYMENTS_VERIFY);
      this.validateKey(key);
      const fingerprint = hash({ paymentId, dto, userId });
      const previous = await tx.financialCommand.findUnique({ where: { tenantId_key: { tenantId, key } } });
      if (previous) { if (previous.requestHash !== fingerprint) throw new ConflictException('Payment key already used'); return previous.result as { id: string; status: string }; }
      const payment = await tx.payment.findFirst({ where: { tenantId, id: paymentId }, include: { sale: { include: { lines: true } } } });
      if (!payment || payment.method === 'CASH') throw new NotFoundException('External payment not found');
      const status = dto.status ?? 'VERIFIED';
      if (payment.status === status) {
        const result = { id: payment.id, status };
        await tx.financialCommand.create({ data: { tenantId, key, requestHash: fingerprint, result } });
        return result;
      }
      if (payment.status !== 'PENDING') throw new ConflictException('Transfer has already been resolved');
      const changed = await tx.payment.updateMany({ where: { tenantId, id: paymentId, status: 'PENDING' }, data: { status, verifiedAt: status === 'VERIFIED' ? new Date() : null, resolvedAt: new Date() } });
      if (changed.count !== 1) throw new ConflictException('Transfer was already resolved');
      if (status === 'FAILED') {
        for (const line of payment.sale.lines) if (line.inventoryDeducted) await moveStock(tx, tenantId, payment.sale.branchId, line.catalogItemId, line.quantity, 'RELEASE', 'External payment rejected', userId, payment.saleId);
      }
      await tx.sale.update({ where: { id: payment.saleId }, data: { status: status === 'VERIFIED' ? 'COMPLETED' : 'VOIDED' } });
      await this.audit(tx, tenantId, userId, 'TRANSFER_' + status, 'Payment', paymentId, { saleId: payment.saleId, note: dto.note ?? null });
      await tx.financialCommand.create({ data: { tenantId, key, requestHash: fingerprint, result: { id: paymentId, status } } });
      return { id: paymentId, status };
    }, true);
  }

  async report(tenantId: string, query: SalesQueryDto, userId?: string) {
    if (userId && query.branchId) await requireBranch(this.db, tenantId, userId, query.branchId);
    if (userId && !query.branchId) { const member = await this.db.membership.findUnique({ where: { tenantId_userId: { tenantId, userId } } }); if (!member || !['OWNER', 'MANAGER'].includes(member.role)) throw new ForbiddenException('Manager access required for all-branch reports'); }
    const branch = query.branchId ? await this.db.branch.findFirst({ where: { tenantId, id: query.branchId } }) : null;
    if (query.branchId && !branch) throw new NotFoundException('Branch not found');
    const timezone = branch?.timezone ?? 'Asia/Colombo';
    const date = query.date ?? new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const parsedDate = new Date(date + 'T00:00:00.000Z');
    if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) throw new BadRequestException('Invalid report date');
    // PostgreSQL resolves the branch's calendar date, including daylight saving changes.
    const [bounds] = await this.db.$queryRaw<{ start: Date; end: Date }[]>(Prisma.sql`SELECT (${date}::date::timestamp AT TIME ZONE ${timezone}) AS start, ((${date}::date + 1)::timestamp AT TIME ZONE ${timezone}) AS end`);
    return this.reportBounds(tenantId, query, date, timezone, bounds);
  }

  private async reportBounds(tenantId: string, query: SalesQueryDto, date: string, timezone: string, bounds: { start: Date; end: Date }) {
    const range = query.from || query.to ? this.range(query) : { gte: bounds.start, lt: bounds.end };
    const branchFilter = query.branchId ? { branchId: query.branchId } : {};
    return this.transaction(async tx => {
      const asOf = query.asOf ? new Date(query.asOf) : new Date();
      if (!Number.isFinite(asOf.getTime()) || asOf > new Date()) throw new BadRequestException('Invalid report cutoff');
      const effectiveRange = { ...range, lte: asOf };
      const payments = await tx.payment.findMany({ where: { tenantId, status: 'VERIFIED', verifiedAt: effectiveRange, sale: branchFilter }, include: { sale: true } });
      const refunds = await tx.refund.findMany({ where: { tenantId, status: 'COMPLETED', createdAt: effectiveRange, sale: branchFilter } });
      const pending = await tx.payment.count({ where: { tenantId, method: { not: 'CASH' }, createdAt: effectiveRange, sale: branchFilter, OR: [{ resolvedAt: null }, { resolvedAt: { gt: asOf } }] } });
      const settled = [...new Map(payments.map(p => [p.saleId, p.sale])).values()];
      const refundTotal = refunds.reduce((sum, refund) => sum.add(refund.amountLkr), zero());
      const received = payments.reduce((sum, payment) => sum.add(payment.amountLkr), zero());
      return {
        date, timezone, asOf: asOf.toISOString(), from: (range.gte ?? bounds.start).toISOString(), to: (range.lt ?? bounds.end).toISOString(),
        salesCount: settled.length, pendingCount: pending,
        grossLkr: settled.reduce((sum, sale) => sum.add(sale.subtotalLkr), zero()).toFixed(2),
        discountsLkr: settled.reduce((sum, sale) => sum.add(sale.discountLkr), zero()).toFixed(2),
        taxLkr: settled.reduce((sum, sale) => sum.add(sale.taxLkr), zero()).toFixed(2),
        collectedLkr: received.toFixed(2), refundsLkr: refundTotal.toFixed(2), netLkr: received.sub(refundTotal).toFixed(2),
        payments: payments.reduce<Record<string, string>>((result, payment) => { result[payment.method] = new Prisma.Decimal(result[payment.method] ?? '0').add(payment.amountLkr).toFixed(2); return result; }, {}),
      };
    });
  }

  async openShift(tenantId: string, userId: string, dto: OpenShiftDto) {
    const amount = money(dto.openingAmountLkr);
    try {
      return await this.transaction(async tx => {
        await this.authorize(tx, tenantId, userId, Permission.CHECKOUT);
        await requireBranch(tx, tenantId, userId, dto.branchId);
        const current = await tx.cashShift.findFirst({ where: { tenantId, branchId: dto.branchId, status: 'OPEN' } });
        if (current) {
          if (current.openedByUserId === userId && current.openingAmountLkr.eq(amount)) return this.shiftSummary(tx, current);
          throw new ConflictException('A cash shift is already open for this branch');
        }
        const shift = await tx.cashShift.create({ data: { tenantId, branchId: dto.branchId, openedByUserId: userId, openingAmountLkr: amount } });
        await this.audit(tx, tenantId, userId, 'SHIFT_OPENED', 'CashShift', shift.id, { openingAmountLkr: amount.toFixed(2) });
        return this.shiftSummary(tx, shift);
      });
    } catch (error) {
      if (this.errorCode(error) === 'P2002') throw new ConflictException('A cash shift is already open. Refresh the shift.');
      throw error;
    }
  }

  async closeShift(tenantId: string, userId: string, id: string, dto: CloseShiftDto) {
    const amount = money(dto.closingAmountLkr);
    return this.transaction(async tx => {
      const member = await this.authorize(tx, tenantId, userId, Permission.CHECKOUT);
      const shift = await tx.cashShift.findFirst({ where: { tenantId, id } });
      if (!shift) throw new NotFoundException('Cash shift not found');
      await requireBranch(tx, tenantId, userId, shift.branchId);
      if (shift.openedByUserId !== userId && !['OWNER', 'MANAGER'].includes(member.role)) throw new ForbiddenException('Only the shift opener or a manager can close this shift');
      if (shift.status === 'CLOSED') {
        if (shift.closingAmountLkr?.eq(amount)) return shift;
        throw new ConflictException('Shift was already closed with another count');
      }
      const summary = await this.shiftSummary(tx, shift);
      const expected = new Prisma.Decimal(summary.expectedClosingLkr);
      const closed = await tx.cashShift.update({ where: { id }, data: { status: 'CLOSED', closingAmountLkr: amount, closedAt: new Date(), closedByUserId: userId, expectedClosingLkr: expected, differenceLkr: amount.sub(expected) } });
      await this.audit(tx, tenantId, userId, 'SHIFT_CLOSED', 'CashShift', id, { closingAmountLkr: amount.toFixed(2), expectedClosingLkr: expected.toFixed(2), differenceLkr: amount.sub(expected).toFixed(2) });
      return closed;
    });
  }
  async currentShift(tenantId: string, branchId: string, userId?: string) {
    if (userId) await requireBranch(this.db, tenantId, userId, branchId);
    return this.transaction(async tx => {
      const shift = await tx.cashShift.findFirst({ where: { tenantId, branchId, status: 'OPEN' } });
      return shift ? this.shiftSummary(tx, shift) : null;
    });
  }

  private async shiftSummary(tx: Tx, shift: Prisma.CashShiftGetPayload<object>) {
    const sales = await tx.sale.findMany({ where: { tenantId: shift.tenantId, cashShiftId: shift.id }, select: { totalLkr: true } });
    const refunds = await tx.refund.findMany({ where: { tenantId: shift.tenantId, cashShiftId: shift.id, status: 'COMPLETED' }, select: { amountLkr: true } });
    const received = sales.reduce((sum, sale) => sum.add(sale.totalLkr), zero());
    const returned = refunds.reduce((sum, refund) => sum.add(refund.amountLkr), zero());
    return { ...shift, openingAmountLkr: shift.openingAmountLkr.toFixed(2), cashSalesLkr: received.toFixed(2), cashRefundsLkr: returned.toFixed(2), expectedClosingLkr: shift.openingAmountLkr.add(received).sub(returned).toFixed(2) };
  }

  private serializeSale(sale: SaleRecord) {
    const refunded = sale.refunds.filter(refund => refund.status === 'COMPLETED').reduce((sum, refund) => sum.add(refund.amountLkr), zero());
    const paid = sale.payments.filter(payment => payment.status === 'VERIFIED').reduce((sum, payment) => sum.add(payment.amountLkr), zero());
    const receiptText = [
      'SALONOS', sale.receiptNumber, sale.branchName ?? sale.branch.name, new Date(sale.createdAt).toISOString(),
      sale.status === 'OPEN' ? 'PENDING TRANSFER - NOT A CONFIRMED PAYMENT' : sale.status,
      ...sale.lines.map(line => line.itemName + ' x ' + line.quantity.toString() + ' @ LKR ' + line.unitPriceLkr.toFixed(2) + ' = ' + line.lineTotalLkr.toFixed(2)),
      'Subtotal LKR ' + sale.subtotalLkr.toFixed(2), 'Discount LKR ' + sale.discountLkr.toFixed(2),
      'Tax LKR ' + sale.taxLkr.toFixed(2), 'Total LKR ' + sale.totalLkr.toFixed(2), 'Confirmed payment LKR ' + paid.toFixed(2),
      ...(sale.cashReceivedLkr ? ['Cash received LKR ' + sale.cashReceivedLkr.toFixed(2), 'Change LKR ' + sale.changeLkr!.toFixed(2)] : []),
      'Refunded LKR ' + refunded.toFixed(2), ...sale.payments.map(payment => payment.method + ': ' + payment.status + (payment.reference ? ' / ' + payment.reference : '')),
    ].join('\n');
    return { ...sale, subtotalLkr: sale.subtotalLkr.toFixed(2), discountLkr: sale.discountLkr.toFixed(2), taxLkr: sale.taxLkr.toFixed(2), totalLkr: sale.totalLkr.toFixed(2), refundedLkr: refunded.toFixed(2), refundableLkr: paid.sub(refunded).toFixed(2), receiptText };
  }

  private async authorize(tx: Tx, tenantId: string, userId: string, permission: Permission) {
    const member = await tx.membership.findUnique({ where: { tenantId_userId: { tenantId, userId } } });
    if (!member || !ROLE_PERMISSIONS[member.role]?.includes(permission)) throw new ForbiddenException('Insufficient permissions');
    return member;
  }
  private audit(tx: Tx, tenantId: string, userId: string, action: string, entityType: string, entityId: string, metadata: Prisma.InputJsonObject) {
    return tx.auditLog.create({ data: { tenantId, actorUserId: userId, action, entityType, entityId, metadata } });
  }
  private validateKey(key: string) {
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{8,120}$/.test(key)) throw new BadRequestException('A valid idempotency-key header is required');
  }
  private range(query: SalesQueryDto) {
    const start = query.from ? new Date(query.from) : undefined, end = query.to ? new Date(query.to) : undefined;
    if ((start && !Number.isFinite(start.getTime())) || (end && !Number.isFinite(end.getTime())) || (start && end && start >= end)) throw new BadRequestException('Invalid date range');
    return { ...(start ? { gte: start } : {}), ...(end ? { lt: end } : {}) };
  }
  private errorCode(error: unknown) { return (error as { code?: string } | null)?.code; }
  private async transaction<T>(operation: (tx: Tx) => Promise<T>, retryUnique = false, existing?: Tx): Promise<T> {
    if (existing) return operation(existing);
    for (let attempt = 0; attempt < 4; attempt++) {
      try { return await this.db.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000, maxWait: 10000 }); }
      catch (error) { if (this.errorCode(error) !== 'P2034' && !(retryUnique && this.errorCode(error) === 'P2002')) throw error; }
    }
    throw new ConflictException('Another transaction changed this record. Retry the same request.');
  }
}
