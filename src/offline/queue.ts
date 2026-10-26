import type { CheckoutRequest } from '../lib/checkout-api';
import type { OfflineOperation, OfflineSnapshot, QueueItem, QueueRow, SyncResult } from './types';
import { assertBudget, offlineQuote, retryDelay } from './policy';
type Param = string | number | null;
export interface SqlConnection {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: Param[]): Promise<{ changes: number }>;
  getFirstAsync<T>(sql: string, params?: Param[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: Param[]): Promise<T[]>;
}
export interface SqlDatabase extends SqlConnection { withExclusiveTransactionAsync(operation: (tx: SqlConnection) => Promise<void>): Promise<void> }
export interface Codec { seal(value: string, context: string): Promise<string>; open(value: string, context: string): Promise<string> }
export class OfflineQueue {
  constructor(private readonly db: SqlDatabase, private readonly codec: Codec) {}
  async initialize() {
    const version = await this.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((version?.user_version ?? 0) > 1) throw new Error('Offline database was created by a newer app. Do not reset it.');
    await this.db.execAsync("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA secure_delete=ON; CREATE TABLE IF NOT EXISTS offline_snapshots(scope TEXT PRIMARY KEY, payload TEXT NOT NULL, clock_offset INTEGER NOT NULL, last_clock INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS offline_operations(id TEXT PRIMARY KEY, scope TEXT NOT NULL, grant_id TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('pending','syncing','synchronized','rejected','conflicted','blocked')), body TEXT NOT NULL, result TEXT, attempts INTEGER NOT NULL DEFAULT 0, next_retry_at INTEGER NOT NULL DEFAULT 0, message TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS offline_due ON offline_operations(scope,state,next_retry_at); PRAGMA user_version=1;");
    await this.db.runAsync("UPDATE offline_operations SET state='pending',message='Interrupted sync recovered; will retry the same operation.' WHERE state='syncing'");
  }
  async saveSnapshot(scope: string, snapshot: OfflineSnapshot, deviceNow = Date.now()) {
    const payload = await this.codec.seal(JSON.stringify(snapshot), scope + ':snapshot');
    const serverNow = Date.parse(snapshot.downloadedAt);
    await this.db.runAsync('INSERT INTO offline_snapshots(scope,payload,clock_offset,last_clock) VALUES(?,?,?,?) ON CONFLICT(scope) DO UPDATE SET payload=excluded.payload,clock_offset=excluded.clock_offset,last_clock=MAX(offline_snapshots.last_clock,excluded.last_clock)', [scope, payload, serverNow - deviceNow, serverNow]);
  }
  async snapshot(scope: string) {
    const row = await this.db.getFirstAsync<{ payload: string }>('SELECT payload FROM offline_snapshots WHERE scope=?', [scope]);
    return row ? JSON.parse(await this.codec.open(row.payload, scope + ':snapshot')) as OfflineSnapshot : null;
  }
  private async decode(row: QueueRow): Promise<QueueItem> {
    const result = row.result ? JSON.parse(await this.codec.open(row.result, row.scope + ':' + row.id + ':result')) as SyncResult : null;
    return { ...row, message: result?.message ?? row.message, operation: JSON.parse(await this.codec.open(row.body, row.scope + ':' + row.id)), result };
  }
  async list(scope: string): Promise<QueueItem[]> {
    const rows = await this.db.getAllAsync<QueueRow>("SELECT * FROM offline_operations WHERE scope=? AND (state<>'synchronized' OR id IN (SELECT id FROM offline_operations WHERE scope=? AND state='synchronized' ORDER BY created_at DESC LIMIT 50)) ORDER BY created_at DESC,id", [scope, scope]);
    return Promise.all(rows.map(row => this.decode(row)));
  }
  async preview(scope: string, request: CheckoutRequest, deviceNow = Date.now()) {
    let result!: { totalLkr: string; changeLkr: string };
    await this.db.withExclusiveTransactionAsync(async tx => {
      const row = await tx.getFirstAsync<{ payload: string; clock_offset: number; last_clock: number }>('SELECT * FROM offline_snapshots WHERE scope=?', [scope]);
      if (!row) throw new Error('Download an authorized catalog online before offline checkout.');
      const snapshot = JSON.parse(await this.codec.open(row.payload, scope + ':snapshot')) as OfflineSnapshot;
      result = offlineQuote(snapshot, request, deviceNow + row.clock_offset, row.last_clock);
      const rows = await tx.getAllAsync<QueueRow>('SELECT * FROM offline_operations WHERE scope=? AND grant_id=?', [scope, snapshot.grantId]);
      const prior = await Promise.all(rows.map(row => this.decode(row)));
      assertBudget(snapshot, prior.map(item => item.operation), request, result.totalLkr);
    });
    return result;
  }
  async record(scope: string, id: string, request: CheckoutRequest, deviceNow = Date.now()) {
    let saved!: OfflineOperation;
    await this.db.withExclusiveTransactionAsync(async tx => {
      const row = await tx.getFirstAsync<{ payload: string; clock_offset: number; last_clock: number }>('SELECT * FROM offline_snapshots WHERE scope=?', [scope]);
      if (!row) throw new Error('Download an authorized catalog online before offline checkout.');
      const snapshot = JSON.parse(await this.codec.open(row.payload, scope + ':snapshot')) as OfflineSnapshot;
      const now = deviceNow + row.clock_offset;
      const quoted = offlineQuote(snapshot, request, now, row.last_clock);
      const priorRows = await tx.getAllAsync<QueueRow>('SELECT * FROM offline_operations WHERE scope=? AND grant_id=?', [scope, snapshot.grantId]);
      const prior = await Promise.all(priorRows.map(row => this.decode(row)));
      assertBudget(snapshot, prior.map(row => row.operation), request, quoted.totalLkr);
      const checkout = { ...request, expectedTotalLkr: quoted.totalLkr };
      const provisionalReceipt = ['SALONOS / PROVISIONAL CASH RECEIPT', 'LOCAL-' + id, new Date(now).toISOString(), 'Not yet synchronized. No final server invoice number has been assigned.',
        ...checkout.items.map(line => {
          const item = snapshot.catalog.find(item => item.id === line.itemId)!;
          return item.name + ' x ' + line.quantity + ' @ LKR ' + item.priceLkr;
        }), 'Cash collected LKR ' + quoted.totalLkr, 'Tendered LKR ' + checkout.cashReceivedLkr, 'Change LKR ' + quoted.changeLkr,
        'Pending server price, authorization, shift and inventory checks.'].join('\n');
      saved = { operationId: id, grantId: snapshot.grantId, deviceId: snapshot.deviceId, recordedAt: new Date(now).toISOString(), checkout, provisionalReceipt };
      const body = await this.codec.seal(JSON.stringify(saved), scope + ':' + id);
      await tx.runAsync("INSERT INTO offline_operations(id,scope,grant_id,state,body,created_at) VALUES(?,?,?,'pending',?,?)", [id, scope, snapshot.grantId, body, now]);
      await tx.runAsync('UPDATE offline_snapshots SET last_clock=? WHERE scope=?', [Math.max(now, row.last_clock), scope]);
    });
    // The commit has completed before success or a provisional receipt is returned.
    return saved;
  }
  async claim(scope: string, now = Date.now()) {
    let item: QueueItem | null = null;
    await this.db.withExclusiveTransactionAsync(async tx => {
      const row = await tx.getFirstAsync<QueueRow>("SELECT * FROM offline_operations WHERE scope=? AND state='pending' AND next_retry_at<=? ORDER BY created_at,id LIMIT 1", [scope, now]);
      if (!row) return;
      await tx.runAsync("UPDATE offline_operations SET state='syncing',attempts=attempts+1 WHERE id=? AND state='pending'", [row.id]);
      item = await this.decode({ ...row, state: 'syncing', attempts: row.attempts + 1 });
    });
    return item as QueueItem | null;
  }
  async settle(scope: string, result: SyncResult) {
    const encrypted = await this.codec.seal(JSON.stringify(result), scope + ':' + result.operationId + ':result');
    await this.db.runAsync('UPDATE offline_operations SET state=?,result=?,message=?,next_retry_at=0 WHERE id=? AND scope=?', [result.state, encrypted, 'Server decision received', result.operationId, scope]);
  }
  async fail(scope: string, id: string, attempts: number, message: string, blocked = false, now = Date.now()) {
    await this.db.runAsync('UPDATE offline_operations SET state=?,message=?,next_retry_at=? WHERE id=? AND scope=?', [blocked ? 'blocked' : 'pending', message, now + retryDelay(attempts), id, scope]);
  }
  async retry(scope: string, id?: string) {
    // Terminal financial outcomes are immutable and cannot be silently requeued.
    await this.db.runAsync("UPDATE offline_operations SET state='pending',next_retry_at=0,message='Manual retry requested' WHERE scope=? AND state IN ('pending','blocked')" + (id ? ' AND id=?' : ''), id ? [scope, id] : [scope]);
  }
}
