import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'dotenv';
import { DatabaseService } from '../src/database/database.service';
import { CheckoutService } from '../src/checkout/checkout.service';
import { CheckoutDto } from '../src/checkout/dto';

const run = process.env.CHECKOUT_DATABASE_TESTS === '1' ? describe : describe.skip;
run('Checkout PostgreSQL transactions (isolated test business)', () => {
  jest.setTimeout(120000);
  let db: DatabaseService;
  let service: CheckoutService;
  const tenantId = randomUUID(), ownerId = randomUUID(), cashierId = randomUUID();
  const branchId = randomUUID(), productId = randomUUID(), staffId = randomUUID(), serviceId = randomUUID();
  const key = () => 'test-' + randomUUID();
  const cash = (quantity = '1'): CheckoutDto => ({ branchId, items: [{ itemId: productId, quantity, expectedUnitPriceLkr: '19.99' }], discountLkr: '0', paymentMethod: 'CASH', cashReceivedLkr: '100.00' });
  const pay = (input = cash(), request = key()) => service.checkout(tenantId, ownerId, request, input);
  async function clearTransactions() {
    await db.refund.deleteMany({ where: { tenantId } });
    await db.sale.deleteMany({ where: { tenantId } });
    await db.cashShift.deleteMany({ where: { tenantId } });
    await db.auditLog.deleteMany({ where: { tenantId } });
  }
  beforeAll(async () => {
    const config = parse(readFileSync(join(__dirname, '..', '.env')));
    const url = process.env.POS_TEST_DATABASE_URL || config.DATABASE_URL;
    if (!url) throw new Error('A development database URL is required for PostgreSQL checkout tests');
    db = new DatabaseService({ datasources: { db: { url } } });
    await db.$connect();
    service = new CheckoutService(db);
    await db.user.createMany({ data: [
      { id: ownerId, email: 'pos-owner-' + ownerId + '@example.invalid', displayName: 'POS integration owner' },
      { id: cashierId, email: 'pos-cashier-' + cashierId + '@example.invalid', displayName: 'POS integration cashier' },
    ] });
    await db.tenant.create({ data: { id: tenantId, name: 'POS integration only', slug: 'pos-test-' + tenantId } });
    await db.branch.create({ data: { id: branchId, tenantId, name: 'Test branch', code: 'TEST', timezone: 'Asia/Colombo' } });
    await db.membership.createMany({ data: [{ tenantId, userId: ownerId, role: 'OWNER' }, { tenantId, userId: cashierId, role: 'CASHIER' }] });
    await db.staffProfile.create({ data: { id: staffId, tenantId, branchId, userId: ownerId } });
    await db.catalogItem.createMany({ data: [
      { id: productId, tenantId, name: 'Test shampoo', type: 'PRODUCT', category: 'Care', priceLkr: '19.99', trackInventory: true, stockQuantity: '3' },
      { id: serviceId, tenantId, name: 'Test haircut', type: 'SERVICE', category: 'Hair', priceLkr: '100.25' },
    ] });
  });
  beforeEach(async () => {
    await clearTransactions();
    await db.catalogItem.update({ where: { id: productId }, data: { stockQuantity: '3', priceLkr: '19.99', name: 'Test shampoo' } });
    await service.openShift(tenantId, ownerId, { branchId, openingAmountLkr: '200.00' });
  });
  afterAll(async () => {
    if (!db) return;
    try {
      await clearTransactions();
      await db.tenant.deleteMany({ where: { id: tenantId, slug: 'pos-test-' + tenantId } });
      await db.user.deleteMany({ where: { id: { in: [ownerId, cashierId] } } });
    } finally { await db.$disconnect(); }
  });

  it('records a cash service/product sale with exact totals and assigned staff', async () => {
    const result = await pay({ ...cash(), customerId: undefined, discountLkr: '0.49', items: [{ itemId: productId, quantity: '2', expectedUnitPriceLkr: '19.99' }, { itemId: serviceId, quantity: '1', assignedStaffProfileId: staffId, expectedUnitPriceLkr: '100.25' }], cashReceivedLkr: '200.00' });
    expect(result.totalLkr).toBe('139.74');
    expect(result.changeLkr?.toFixed(2)).toBe('60.26');
    expect((await db.catalogItem.findUniqueOrThrow({ where: { id: productId } })).stockQuantity.toString()).toBe('1');
    expect(result.payments[0].status).toBe('VERIFIED');
    expect(result.receiptNumber).toMatch(/^SAL-[A-F0-9]{32}$/);
  });

  it('concurrent identical requests create one sale, one payment, one stock deduction', async () => {
    const request = key();
    const results = await Promise.all([pay(cash(), request), pay(cash(), request)]);
    expect(results[0].id).toBe(results[1].id);
    expect(await db.sale.count({ where: { tenantId } })).toBe(1);
    expect(await db.payment.count({ where: { tenantId } })).toBe(1);
    expect(await db.auditLog.count({ where: { tenantId, action: 'SALE_CREATED' } })).toBe(1);
    expect((await db.catalogItem.findUniqueOrThrow({ where: { id: productId } })).stockQuantity.toString()).toBe('2');
  });

  it('rejects changed payloads for a completed request and preserves historical prices', async () => {
    const request = key(), original = await pay(cash(), request);
    await db.catalogItem.update({ where: { id: productId }, data: { name: 'Renamed shampoo', priceLkr: '999.00' } });
    expect((await pay(cash(), request)).id).toBe(original.id);
    const receipt = await service.receipt(tenantId, original.id);
    expect(receipt.lines[0].itemName).toBe('Test shampoo');
    expect(receipt.lines[0].unitPriceLkr.toFixed(2)).toBe('19.99');
    await expect(pay({ ...cash(), cashReceivedLkr: '200.00' }, request)).rejects.toThrow('different request');
    await expect(pay(cash())).rejects.toThrow('price changed');
  });

  it('does not oversell when competing transactions buy the last item', async () => {
    await db.catalogItem.update({ where: { id: productId }, data: { stockQuantity: '1' } });
    const results = await Promise.allSettled([pay(), pay()]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await db.sale.count({ where: { tenantId } })).toBe(1);
    expect((await db.catalogItem.findUniqueOrThrow({ where: { id: productId } })).stockQuantity.toString()).toBe('0');
  });

  it('rolls back stock and sales when a later audit write fails', async () => {
    const faulty = new CheckoutService(new Proxy(db, {
      get(target, property) {
        if (property === '$transaction') return (operation: any, options: any) => db.$transaction(tx => operation(new Proxy(tx, {
          get(client, field) { return field === 'auditLog' ? { create: async () => { throw new Error('Injected audit failure'); } } : Reflect.get(client, field); },
        })), options);
        return Reflect.get(target, property);
      },
    }));
    const request = key();
    await expect(faulty.checkout(tenantId, ownerId, request, cash())).rejects.toThrow('Injected audit failure');
    expect(await db.sale.count({ where: { tenantId } })).toBe(0);
    expect(await db.payment.count({ where: { tenantId } })).toBe(0);
    expect((await db.catalogItem.findUniqueOrThrow({ where: { id: productId } })).stockQuantity.toString()).toBe('3');
    await pay(cash(), request);
    expect(await db.sale.count({ where: { tenantId } })).toBe(1);
  });

  it('supports idempotent partial refunds and prevents concurrent over-refunds', async () => {
    const sale = await pay();
    const request = key();
    const first = await service.refund(tenantId, ownerId, sale.id, { amountLkr: '5.00', reason: 'Adjustment' }, request);
    expect((await service.refund(tenantId, ownerId, sale.id, { amountLkr: '5.00', reason: 'Adjustment' }, request)).id).toBe(first.id);
    const results = await Promise.allSettled([
      service.refund(tenantId, ownerId, sale.id, { amountLkr: '10.00', reason: 'Return one' }, key()),
      service.refund(tenantId, ownerId, sale.id, { amountLkr: '10.00', reason: 'Return two' }, key()),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect((await service.receipt(tenantId, sale.id)).refundableLkr).toBe('4.99');
    expect(await db.refund.count({ where: { tenantId } })).toBe(2);
  });

  it('blocks cashier discounts, refunds, and bank verification', async () => {
    await expect(service.checkout(tenantId, cashierId, key(), { ...cash(), discountLkr: '1' })).rejects.toThrow('permissions');
    const sale = await pay();
    await expect(service.refund(tenantId, cashierId, sale.id, { amountLkr: '1', reason: 'Return' }, key())).rejects.toThrow('permissions');
    await expect(service.verifyTransfer(tenantId, cashierId, sale.payments[0].id, { status: 'VERIFIED' })).rejects.toThrow('permissions');
  });

  it('does not confirm, report, or refund an unverified transfer', async () => {
    const sale = await pay({ ...cash(), paymentMethod: 'BANK_TRANSFER', bankReference: key() });
    expect(sale.status).toBe('OPEN');
    expect(sale.refundableLkr).toBe('0.00');
    const report = await service.report(tenantId, { branchId, limit: 30, offset: 0 });
    expect(report.collectedLkr).toBe('0.00');
    expect(report.pendingCount).toBe(1);
    await expect(service.refund(tenantId, ownerId, sale.id, { amountLkr: '1', reason: 'Not paid' }, key())).rejects.toThrow('confirmed payment');
    await service.verifyTransfer(tenantId, ownerId, sale.payments[0].id, { status: 'VERIFIED' });
    expect((await service.report(tenantId, { branchId, limit: 30, offset: 0 })).collectedLkr).toBe('19.99');
  });

  it('rejects duplicate bank references without another deduction', async () => {
    const reference = key(), input = { ...cash(), paymentMethod: 'BANK_TRANSFER' as const, bankReference: reference };
    await pay(input);
    await expect(pay({ ...input, bankReference: ' ' + reference.toUpperCase() + ' ' })).rejects.toThrow();
    expect(await db.payment.count({ where: { tenantId } })).toBe(1);
    expect((await db.catalogItem.findUniqueOrThrow({ where: { id: productId } })).stockQuantity.toString()).toBe('2');
  });

  it('releases reserved stock exactly once when a transfer is rejected', async () => {
    const sale = await pay({ ...cash(), paymentMethod: 'BANK_TRANSFER', bankReference: key() });
    await service.verifyTransfer(tenantId, ownerId, sale.payments[0].id, { status: 'FAILED' });
    await service.verifyTransfer(tenantId, ownerId, sale.payments[0].id, { status: 'FAILED' });
    expect((await db.catalogItem.findUniqueOrThrow({ where: { id: productId } })).stockQuantity.toString()).toBe('3');
    expect((await service.receipt(tenantId, sale.id)).status).toBe('VOIDED');
  });

  it('reconciles cash shifts and blocks cash after closing', async () => {
    const sale = await pay();
    await service.refund(tenantId, ownerId, sale.id, { amountLkr: '5.00', reason: 'Adjustment' }, key());
    const shift = await service.currentShift(tenantId, branchId);
    expect(shift!.expectedClosingLkr).toBe('214.99');
    const closed = await service.closeShift(tenantId, ownerId, shift!.id, { closingAmountLkr: '214.00' });
    expect(closed.expectedClosingLkr!.toFixed(2)).toBe('214.99');
    expect(closed.differenceLkr!.toFixed(2)).toBe('-0.99');
    await expect(pay()).rejects.toThrow('Open a cash shift');
    expect(await db.cashShift.count({ where: { tenantId, status: 'OPEN' } })).toBe(0);
  });

  it('keeps another business out of receipts, items, and customers', async () => {
    const sale = await pay();
    await expect(service.receipt(randomUUID(), sale.id)).rejects.toThrow('Sale not found');
    await expect(pay({ ...cash(), customerId: randomUUID() })).rejects.toThrow('Customer not found');
    const input = cash(); input.items[0].itemId = randomUUID();
    await expect(pay(input)).rejects.toThrow('Catalog item not found');
  });
});
