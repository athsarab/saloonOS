import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PaymentMethod, Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CheckoutService } from '../src/checkout/checkout.service';
import { CheckoutDto, SalesQueryDto } from '../src/checkout/dto';
import { money } from '../src/checkout/money';

const D = (value: string) => new Prisma.Decimal(value);
describe('Checkout financial rules', () => {
  let db: any;
  let service: CheckoutService;
  const dto = (): CheckoutDto => ({ branchId: 'branch-1', items: [{ itemId: 'item-1', quantity: '2', assignedStaffProfileId: 'staff-1', expectedUnitPriceLkr: '100.25' }], discountLkr: '0.50', paymentMethod: PaymentMethod.CASH, cashReceivedLkr: '500.00', expectedTotalLkr: '200.00' });
  beforeEach(() => {
    db = {
      membership: { findUnique: jest.fn().mockResolvedValue({ role: 'OWNER' }) },
      branch: { findFirstOrThrow: jest.fn().mockResolvedValue({ stockPolicy: 'REJECT' }), findFirst: jest.fn().mockResolvedValue({ id: 'branch-1', code: 'MAIN', name: 'Main', timezone: 'Asia/Colombo', stockPolicy: 'REJECT' }), update: jest.fn().mockResolvedValue({ receiptCounter: 1 }), count: jest.fn().mockResolvedValue(1) },
      branchPrice: { findMany: jest.fn().mockResolvedValue([]) },
      stockBalance: { findUnique: jest.fn().mockResolvedValue({ quantity: D('10') }), findUniqueOrThrow: jest.fn().mockResolvedValue({ quantity: D('8') }), updateMany: jest.fn().mockResolvedValue({count: 1}), aggregate: jest.fn().mockResolvedValue({ _sum: {quantity: D('8')} }) },
      inventoryMovement: { create: jest.fn() },
      financialCommand: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'customer-1' }) },
      staffProfile: { findMany: jest.fn().mockResolvedValue([{branchId:"branch-1"}]), findFirst: jest.fn().mockResolvedValue({ id: 'staff-1' }) },
      catalogItem: {
        findMany: jest.fn().mockResolvedValue([{ id: 'item-1', name: 'Haircut', type: 'SERVICE', priceLkr: D('100.25'), trackInventory: false, active: true, taxRateBps: 0, taxLabel: 'No tax' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      sale: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), update: jest.fn(), create: jest.fn(async ({ data }: any) => ({
        ...data, id: 'sale-1', createdAt: new Date(), branch: { name: 'Main' }, customer: null,
        lines: data.lines.create, payments: [{ id: 'payment-1', ...data.payments.create }], refunds: [],
      })) },
      payment: { count: jest.fn().mockResolvedValue(1), findFirst: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }), findMany: jest.fn().mockResolvedValue([]) },
      refund: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), create: jest.fn(async ({ data }: any) => ({ id: 'refund-1', status: 'COMPLETED', ...data })) },
      cashShift: { findFirst: jest.fn().mockResolvedValue({ id: 'shift-1', tenantId: 'tenant-1', branchId: 'branch-1', status: 'OPEN', openedByUserId: 'user-1', openingAmountLkr: D('1000.00') }), create: jest.fn(), update: jest.fn(async ({ data }: any) => ({ id: 'shift-1', ...data })) },
      auditLog: { create: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([{ start: new Date('2026-10-24T18:30:00Z'), end: new Date('2026-10-25T18:30:00Z') }]),
    };
    db.$transaction = jest.fn(async (operation: any) => typeof operation === 'function' ? operation(db) : Promise.all(operation));
    service = new CheckoutService(db);
  });
  const checkout = (input = dto(), key = 'checkout-key-001') => service.checkout('tenant-1', 'user-1', key, input);

  it('uses backend decimal prices, preserves snapshots, records exact cash and change', async () => {
    const result = await checkout();
    expect(result.totalLkr).toBe('200.00');
    expect(result.subtotalLkr).toBe('200.50');
    expect(result.changeLkr?.toFixed(2)).toBe('300.00');
    expect(result.lines[0].unitPriceLkr.toFixed(2)).toBe('100.25');
    expect(result.lines[0].itemName).toBe('Haircut');
    expect(result.receiptText).toContain('Cash received LKR 500.00');
    expect(db.auditLog.create).toHaveBeenCalled();
  });
  it('quotes without creating sales, payments or stock changes', async () => {
    expect(await service.quote('tenant-1', 'user-1', dto())).toEqual({ subtotalLkr: '200.50', discountLkr: '0.50', taxLkr: '0.00', totalLkr: '200.00' });
    expect(db.sale.create).not.toHaveBeenCalled();
    expect(db.catalogItem.updateMany).not.toHaveBeenCalled();
  });
  it('replays the same checkout without recording another payment', async () => {
    const first = await checkout();
    db.sale.findUnique.mockResolvedValue(await db.sale.create.mock.results[0].value);
    const second = await checkout();
    expect(second.id).toBe(first.id);
    expect(db.sale.create).toHaveBeenCalledTimes(1);
  });
  it('rejects changed payload under an existing idempotency key', async () => {
    await checkout();
    db.sale.findUnique.mockResolvedValue(await db.sale.create.mock.results[0].value);
    await expect(checkout({ ...dto(), cashReceivedLkr: '600.00' })).rejects.toThrow('different request');
    expect(db.sale.create).toHaveBeenCalledTimes(1);
  });
  it('rejects missing idempotency keys', async () => {
    await expect(checkout(dto(), '')).rejects.toThrow('idempotency');
  });
  it('rejects incorrect or stale unit prices before writing anything', async () => {
    const input = dto(); input.items[0].expectedUnitPriceLkr = '0.01';
    await expect(checkout(input)).rejects.toThrow('price changed');
    expect(db.sale.create).not.toHaveBeenCalled();
  });
  it('rejects incorrect expected totals', async () => {
    await expect(checkout({ ...dto(), expectedTotalLkr: '0.01' })).rejects.toThrow('Total changed');
  });
  it.each(['NaN', 'Infinity', '-1', '1.001', '1e3', '10000000000.00'])('rejects invalid money %s', async value => {
    expect(() => money(value)).toThrow(BadRequestException);
  });
  it('rejects checkout, discounts and refunds without permission', async () => {
    db.membership.findUnique.mockResolvedValue({ role: 'STYLIST' });
    await expect(checkout()).rejects.toThrow(ForbiddenException);
    db.membership.findUnique.mockResolvedValue({ role: 'CASHIER' });
    await expect(checkout()).rejects.toThrow(ForbiddenException);
    await expect(service.refund('tenant-1', 'user-1', 'sale-1', { amountLkr: '10.00', reason: 'Return' }, 'refund-key-001')).rejects.toThrow(ForbiddenException);
  });
  it('rejects cash without an open shift', async () => {
    db.cashShift.findFirst.mockResolvedValue(null);
    await expect(checkout()).rejects.toThrow('Open a cash shift');
    expect(db.sale.create).not.toHaveBeenCalled();
  });
  it('requires explicit sufficient cash', async () => {
    await expect(checkout({ ...dto(), cashReceivedLkr: undefined })).rejects.toThrow('cash received');
    await expect(checkout({ ...dto(), cashReceivedLkr: '199.99' })).rejects.toThrow('cash received');
  });
  it('requires staff in the selected business and branch for services', async () => {
    const input = dto(); delete input.items[0].assignedStaffProfileId;
    await expect(checkout(input)).rejects.toThrow('Assign a staff');
    db.staffProfile.findFirst.mockResolvedValue(null);
    await expect(checkout()).rejects.toThrow('Assigned staff member');
  });
  it('rejects cross-tenant customers and missing catalog items', async () => {
    db.customer.findFirst.mockResolvedValue(null);
    await expect(checkout({ ...dto(), customerId: 'foreign-customer' })).rejects.toThrow('Customer not found');
    db.catalogItem.findMany.mockResolvedValue([]);
    await expect(checkout()).rejects.toThrow('Catalog item not found');
  });
  it('deducts product inventory conditionally and rejects insufficient stock', async () => {
    db.catalogItem.findMany.mockResolvedValue([{ id: 'item-1', name: 'Shampoo', type: 'PRODUCT', priceLkr: D('100.25'), trackInventory: true, active: true, taxRateBps: 0, taxLabel: 'No tax' }]);
    const input = dto(); delete input.items[0].assignedStaffProfileId;
    await checkout(input);
    expect(db.stockBalance.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ quantity: { gte: expect.any(Prisma.Decimal) } }) }));
    db.stockBalance.updateMany.mockResolvedValue({ count: 0 });
    await expect(checkout(input, 'another-key-001')).rejects.toThrow('Insufficient stock');
  });
  it('records transfers as pending and never calls them confirmed', async () => {
    const input = { ...dto(), paymentMethod: PaymentMethod.BANK_TRANSFER, bankReference: 'BANK001' };
    const result = await checkout(input);
    expect(result.status).toBe('OPEN');
    expect(result.payments[0].status).toBe('PENDING');
    expect(result.refundableLkr).toBe('0.00');
    expect(result.receiptText).toContain('NOT A CONFIRMED PAYMENT');
  });
  it('limits partial refunds to remaining confirmed payments and records them idempotently', async () => {
    db.sale.findFirst.mockResolvedValue({ id: 'sale-1', branchId: 'branch-1', payments: [{ method: 'CASH', status: 'VERIFIED', amountLkr: D('200.00') }], refunds: [{ amountLkr: D('50.00') }] });
    const result = await service.refund('tenant-1', 'user-1', 'sale-1', { amountLkr: '75.00', reason: 'Service adjustment' }, 'refund-key-001');
    expect(result.amountLkr).toBe('75.00');
    db.refund.findUnique.mockResolvedValue({ ...result, amountLkr: D(result.amountLkr) });
    expect((await service.refund('tenant-1', 'user-1', 'sale-1', { amountLkr: '75.00', reason: 'Service adjustment' }, 'refund-key-001')).id).toBe(result.id);
    db.refund.findUnique.mockResolvedValue(null);
    await expect(service.refund('tenant-1', 'user-1', 'sale-1', { amountLkr: '150.01', reason: 'Too much' }, 'refund-key-002')).rejects.toThrow('remaining confirmed');
  });
  it('does not refund an unverified transfer', async () => {
    db.sale.findFirst.mockResolvedValue({ id: 'sale-1', payments: [{ method: 'BANK_TRANSFER', status: 'PENDING', amountLkr: D('200.00') }], refunds: [] });
    await expect(service.refund('tenant-1', 'user-1', 'sale-1', { amountLkr: '1', reason: 'Return' }, 'refund-key-003')).rejects.toThrow('remaining confirmed');
  });
  it('verifies or rejects a transfer once and releases stock only on rejection', async () => {
    const payment = { id: 'payment-1', method: 'BANK_TRANSFER', status: 'PENDING', saleId: 'sale-1', sale: { lines: [{ inventoryDeducted: true, catalogItemId: 'item-1', quantity: D('2') }] } };
    db.payment.findFirst.mockResolvedValue(payment);
    expect((await service.verifyTransfer('tenant-1', 'user-1', 'payment-1', { status: 'FAILED' })).status).toBe('FAILED');
    expect(db.catalogItem.updateMany).toHaveBeenCalledTimes(1);
    db.payment.findFirst.mockResolvedValue({ ...payment, status: 'FAILED' });
    await service.verifyTransfer('tenant-1', 'user-1', 'payment-1', { status: 'FAILED' });
    expect(db.catalogItem.updateMany).toHaveBeenCalledTimes(1);
    await expect(service.verifyTransfer('tenant-1', 'user-1', 'payment-1', { status: 'VERIFIED' })).rejects.toThrow('already been resolved');
  });
  it('closes cash shifts with reconciled sales and refunds in one transaction', async () => {
    db.sale.findMany.mockResolvedValue([{ totalLkr: D('200.50') }]);
    db.refund.findMany.mockResolvedValue([{ amountLkr: D('50.25') }]);
    const result = await service.closeShift('tenant-1', 'user-1', 'shift-1', { closingAmountLkr: '1150.00' });
    expect(result.expectedClosingLkr?.toFixed(2)).toBe('1150.25');
    expect(result.differenceLkr?.toFixed(2)).toBe('-0.25');
    expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'SHIFT_CLOSED' }) }));
  });
  it('does not allow another cashier to close a drawer', async () => {
    db.membership.findUnique.mockResolvedValue({ role: 'CASHIER' });
    await expect(service.closeShift('tenant-1', 'other-user', 'shift-1', { closingAmountLkr: '0' })).rejects.toThrow(ForbiddenException);
  });
  it('retries serialization conflicts with the same transaction request', async () => {
    const original = db.$transaction.getMockImplementation();
    db.$transaction.mockRejectedValueOnce({ code: 'P2034' }).mockImplementation(original);
    await checkout();
    expect(db.sale.create).toHaveBeenCalledTimes(1);
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
  });
  it('builds reports from confirmed collection time and refund time, excluding pending transfers', async () => {
    db.sale.findMany.mockResolvedValue([{ status: 'OPEN', subtotalLkr: D('100'), discountLkr: D('0'), totalLkr: D('100') }]);
    db.payment.findMany.mockResolvedValue([{ method: 'CASH', amountLkr: D('50.50'), saleId: 'sale-1', sale: { subtotalLkr: D('50.50'), discountLkr: D('0'), taxLkr: D('0') } }]);
    db.refund.findMany.mockResolvedValue([{ amountLkr: D('10.25') }]);
    const result = await service.report('tenant-1', { branchId: 'branch-1', date: '2026-10-25', limit: 30, offset: 0 });
    expect(result.netLkr).toBe('40.25');
    expect(result.pendingCount).toBe(1);
    expect(db.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: 'VERIFIED', verifiedAt: expect.any(Object) }) }));
  });
  it('validates transfer checkout without cash and rejects injected client prices', async () => {
    const input = plainToInstance(CheckoutDto, { branchId: '11111111-1111-4111-8111-111111111111', items: [{ itemId: '22222222-2222-4222-8222-222222222222', quantity: '1' }], discountLkr: '0', paymentMethod: 'BANK_TRANSFER', bankReference: 'R1' });
    expect(await validate(input, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
    const invalid = plainToInstance(CheckoutDto, { ...input, totalLkr: '0.01' });
    expect((await validate(invalid, { whitelist: true, forbidNonWhitelisted: true })).length).toBeGreaterThan(0);
    const query = plainToInstance(SalesQueryDto, { offset: '20', limit: '20' });
    expect(await validate(query)).toHaveLength(0);
    expect(query.offset).toBe(20);
  });
  it('merges duplicate item/staff lines before rounding line tax', async () => {
    db.catalogItem.findMany.mockResolvedValue([{ id:'item-1',name:'Tax rounding sample',type:'SERVICE',active:true,priceLkr:D('0.03'),taxRateBps:1800,taxLabel:'Demo tax',trackInventory:false }]);
    const input={...dto(),discountLkr:'0',expectedTotalLkr:'0.07',items:[{itemId:'item-1',quantity:'1',assignedStaffProfileId:'staff-1'},{itemId:'item-1',quantity:'1',assignedStaffProfileId:'staff-1'}]};
    const result=await checkout(input);expect(result.lines).toHaveLength(1);expect(result.taxLkr).toBe('0.01');expect(result.totalLkr).toBe('0.07');
  });

});
