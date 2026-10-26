import { DatabaseSync } from 'node:sqlite';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OfflineQueue, type Codec, type SqlDatabase } from '../../../src/offline/queue';
import { synchronizeNext } from '../../../src/offline/processor';
import { retryDelay } from '../../../src/offline/policy';
import type { OfflineSnapshot } from '../../../src/offline/types';
import type { CheckoutRequest } from '../../../src/lib/checkout-api';

describe('Durable encrypted offline cash queue (real SQLite file)', () => {
  let directory: string, path: string, sqlite: DatabaseSync, queue: OfflineQueue;
  const scope = 'tenant:user';
  const now = Date.parse('2026-10-27T08:00:00Z');
  const key = randomBytes(32);
  const codec: Codec = {
    async seal(value, context) {
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(context));
      const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString('base64');
    },
    async open(value, context) {
      const buffer = Buffer.from(value, 'base64');
      const decipher = createDecipheriv('aes-256-gcm', key, buffer.subarray(0, 12));
      decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(buffer.subarray(-16));
      return Buffer.concat([decipher.update(buffer.subarray(12, -16)), decipher.final()]).toString('utf8');
    },
  };
  const snapshot = (): OfflineSnapshot => ({
    grantId: 'grant', tenantId: 'tenant', userId: 'user', deviceId: 'device', shiftId: 'shift',
    branch: { id: 'branch', name: 'Studio', timezone: 'Asia/Colombo' },
    issuedAt: new Date(now).toISOString(), downloadedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 8 * 3600000).toISOString(), catalogExpiresAt: new Date(now + 4 * 3600000).toISOString(),
    usedCount: 0, usedAmountLkr: '0.00', acknowledgedOperationIds: [],
    limits: { sessionHours: 8, catalogHours: 4, maxSales: 50, maxSaleLkr: '100000.00', maxTotalLkr: '250000.00', uploadDays: 7 },
    catalog: [{ id: 'product', name: 'PRIVATE ITEM LABEL', category: 'Care', type: 'PRODUCT', priceLkr: '19.99', trackInventory: true, stockQuantity: '10' }],
    staff: [],
  });
  const input = (): CheckoutRequest => ({ branchId: 'branch', discountLkr: '0', paymentMethod: 'CASH', cashReceivedLkr: '50.00', items: [{ itemId: 'product', quantity: '1', expectedUnitPriceLkr: '19.99' }] });
  function open() {
    sqlite = new DatabaseSync(path);
    const adapter: SqlDatabase = {
      async execAsync(sql) { sqlite.exec(sql); },
      async runAsync(sql, params = []) { return { changes: Number(sqlite.prepare(sql).run(...params).changes) }; },
      async getFirstAsync<T>(sql: string, params: (string | number | null)[] = []) { return (sqlite.prepare(sql).get(...params) ?? null) as T | null; },
      async getAllAsync<T>(sql: string, params: (string | number | null)[] = []) { return sqlite.prepare(sql).all(...params) as T[]; },
      async withExclusiveTransactionAsync(operation) {
        sqlite.exec('BEGIN IMMEDIATE');
        try { await operation(adapter); sqlite.exec('COMMIT'); } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
      },
    };
    queue = new OfflineQueue(adapter, codec);
  }
  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'salonos-offline-')); path = join(directory, 'queue.db');
    open(); await queue.initialize(); await queue.saveSnapshot(scope, snapshot(), now);
  });
  afterEach(() => {
    sqlite.close();
    for (const suffix of ['', '-wal', '-shm']) if (existsSync(path + suffix)) unlinkSync(path + suffix);
    rmdirSync(directory);
  });
  it('records without internet and survives process/database restart before reconnecting', async () => {
    const id = randomUUID(), operation = await queue.record(scope, id, input(), now + 1000);
    expect(operation.provisionalReceipt).toContain('LOCAL-' + id);
    expect(operation.provisionalReceipt).not.toContain('SAL-');
    sqlite.close(); open(); await queue.initialize();
    const restored = await queue.list(scope);
    expect(restored).toHaveLength(1); expect(restored[0].state).toBe('pending');
    expect(restored[0].operation.checkout.expectedTotalLkr).toBe('19.99');
    const send = jest.fn(async () => ({ operationId: id, state: 'synchronized' as const, message: 'Confirmed', receiptNumber: 'SAL-SERVER-ONLY' }));
    await synchronizeNext(queue, scope, send, now + 2000);
    expect((await queue.list(scope))[0].result?.receiptNumber).toBe('SAL-SERVER-ONLY');
  });
  it('validates a local preview without recording cash or consuming queue capacity', async () => {
    expect(await queue.preview(scope, input(), now + 1000)).toEqual({ totalLkr: '19.99', changeLkr: '30.01' });
    expect(await queue.list(scope)).toHaveLength(0);
    await expect(queue.preview(scope, input(), now + 5 * 3600000)).rejects.toThrow('Catalog');
  });
  it('retries a lost response with the exact original ID and payload, producing one server sale', async () => {
    const id = randomUUID(); await queue.record(scope, id, input(), now + 1000);
    const server = new Map(), bodies: string[] = [];
    let loseResponse = true;
    const send = jest.fn(async (operation: any) => {
      bodies.push(JSON.stringify(operation));
      if (!server.has(operation.operationId)) server.set(operation.operationId, { operationId: id, state: 'synchronized' as const, message: 'Confirmed', receiptNumber: 'SAL-ONE' });
      if (loseResponse) { loseResponse = false; throw new Error('Response lost'); }
      return server.get(operation.operationId);
    });
    await synchronizeNext(queue, scope, send, now + 2000);
    expect((await queue.list(scope))[0].state).toBe('pending');
    sqlite.close(); open(); await queue.initialize();
    await queue.retry(scope, id); await synchronizeNext(queue, scope, send, now + 3000);
    expect(server.size).toBe(1); expect(bodies[0]).toBe(bodies[1]);
    expect((await queue.list(scope))[0].state).toBe('synchronized');
  });
  it('recovers a crash while an operation was marked syncing', async () => {
    await queue.record(scope, randomUUID(), input(), now + 1000);
    await queue.claim(scope, now + 2000);
    sqlite.close(); open(); await queue.initialize();
    expect((await queue.list(scope))[0].state).toBe('pending');
  });
  it('preserves the operation through server errors, applies backoff and honors due times', async () => {
    await queue.record(scope, randomUUID(), input(), now + 1000);
    const send = jest.fn(async () => { throw Object.assign(new Error('Unavailable'), { status: 503 }); });
    await synchronizeNext(queue, scope, send, now + 2000);
    const item = (await queue.list(scope))[0];
    expect(item.state).toBe('pending'); expect(item.attempts).toBe(1); expect(item.next_retry_at).toBeGreaterThan(now + 2000);
    expect(await synchronizeNext(queue, scope, send, now + 2001)).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
    expect(retryDelay(1, 0)).toBe(4000); expect(retryDelay(100, 0)).toBe(300000);
  });
  it('blocks on expired authentication without losing the queued cash', async () => {
    await queue.record(scope, randomUUID(), input(), now + 1000);
    await synchronizeNext(queue, scope, async () => { throw Object.assign(new Error('Sign in'), { status: 401 }); }, now + 2000);
    expect((await queue.list(scope))[0].state).toBe('blocked');
    await queue.retry(scope);
    expect((await queue.list(scope))[0].state).toBe('pending');
  });
  it('keeps financial conflicts and rejections immutable under manual retry', async () => {
    const first = randomUUID(), second = randomUUID();
    await queue.record(scope, first, input(), now + 1000); await queue.record(scope, second, input(), now + 2000);
    await synchronizeNext(queue, scope, async operation => ({ operationId: operation.operationId, state: 'conflicted', message: 'Price changed' }), now + 3000);
    await synchronizeNext(queue, scope, async operation => ({ operationId: operation.operationId, state: 'rejected', message: 'Device revoked' }), now + 4000);
    await queue.retry(scope);
    expect((await queue.list(scope)).map(item => item.state).sort()).toEqual(['conflicted', 'rejected']);
  });
  it('refuses stale catalogs, expired sessions and clock rollback without saving success', async () => {
    await expect(queue.record(scope, randomUUID(), input(), now + 5 * 3600000)).rejects.toThrow('Catalog');
    await expect(queue.record(scope, randomUUID(), input(), now + 9 * 3600000)).rejects.toThrow('session expired');
    await queue.record(scope, randomUUID(), input(), now + 120000);
    await expect(queue.record(scope, randomUUID(), input(), now + 1000)).rejects.toThrow('clock');
    expect(await queue.list(scope)).toHaveLength(1);
  });
  it('enforces offline cash-only, staff/price, stock and sale/session limits', async () => {
    await expect(queue.record(scope, randomUUID(), { ...input(), paymentMethod: 'BANK_TRANSFER' }, now + 1000)).rejects.toThrow('cash');
    await expect(queue.record(scope, randomUUID(), { ...input(), discountLkr: '1' }, now + 1000)).rejects.toThrow('cash');
    const expensive = input(); expensive.items[0].quantity = '11'; expensive.cashReceivedLkr = '500';
    await expect(queue.record(scope, randomUUID(), expensive, now + 1000)).rejects.toThrow('stock');
    const oversized = input(); oversized.items[0].quantity = '6000'; oversized.cashReceivedLkr = '200000';
    await expect(queue.record(scope, randomUUID(), oversized, now + 1000)).rejects.toThrow('transaction limit');
    const serviceOnly = snapshot(); serviceOnly.catalog[0].type = 'SERVICE';
    await queue.saveSnapshot(scope, serviceOnly, now);
    await expect(queue.record(scope, randomUUID(), input(), now + 1000)).rejects.toThrow('Assign');
    const limited = snapshot(); limited.limits.maxSales = 1;
    await queue.saveSnapshot(scope, limited, now);
    await queue.record(scope, randomUUID(), input(), now + 1000);
    await expect(queue.record(scope, randomUUID(), input(), now + 2000)).rejects.toThrow('limit');
  });
  it('does not double-count acknowledged sales when the snapshot is refreshed', async () => {
    const id = randomUUID(); await queue.record(scope, id, input(), now + 1000);
    const refreshed = snapshot(); refreshed.usedCount = 1; refreshed.usedAmountLkr = '19.99'; refreshed.acknowledgedOperationIds = [id]; refreshed.limits.maxSales = 2;
    await queue.saveSnapshot(scope, refreshed, now);
    await queue.record(scope, randomUUID(), input(), now + 2000);
    expect(await queue.list(scope)).toHaveLength(2);
  });
  it('does not expose financial payloads or item names in SQLite pages and prevents row swapping', async () => {
    const id = randomUUID(); await queue.record(scope, id, input(), now + 1000);
    const raw = sqlite.prepare('SELECT body FROM offline_operations WHERE id=?').get(id) as { body: string };
    expect(raw.body).not.toContain('PRIVATE ITEM'); expect(raw.body).not.toContain('19.99');
    expect(readFileSync(path).toString()).not.toContain('PRIVATE ITEM LABEL');
    await expect(codec.open(raw.body, 'other-scope:' + id)).rejects.toThrow();
    expect(await queue.list('other-scope')).toHaveLength(0);
  });
  it('rolls back a local storage failure and never shows a successful receipt', async () => {
    sqlite.exec("CREATE TRIGGER deny_cash BEFORE INSERT ON offline_operations BEGIN SELECT RAISE(ABORT,'Disk write failed'); END;");
    await expect(queue.record(scope, randomUUID(), input(), now + 1000)).rejects.toThrow('Disk write failed');
    expect(await queue.list(scope)).toHaveLength(0);
  });
});
