import type { OfflineQueue } from './queue';
import type { OfflineOperation, SyncResult } from './types';
export class OfflineBlockedError extends Error {}
export async function synchronizeNext(queue: OfflineQueue, scope: string, send: (operation: OfflineOperation) => Promise<SyncResult>, now = Date.now()) {
  const item = await queue.claim(scope, now);
  if (!item) return false;
  try {
    const result = await send(item.operation);
    if (result.operationId !== item.id || !['synchronized', 'rejected', 'conflicted'].includes(result.state)) throw new Error('Invalid server response');
    await queue.settle(scope, result);
    return true;
  } catch (error) {
    const status = (error as { status?: number } | null)?.status;
    if (status === 401 || error instanceof OfflineBlockedError) {
      await queue.fail(scope, item.id, item.attempts, error instanceof OfflineBlockedError ? error.message : 'Sign in to the same account online, then retry synchronization.', true, now);
    } else if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
      await queue.settle(scope, { operationId: item.id, state: status === 409 ? 'conflicted' : 'rejected', message: error instanceof Error ? error.message : 'Server rejected this operation; manager review required.' });
      return true;
    } else {
      await queue.fail(scope, item.id, item.attempts, 'Server or network error. The original cash operation is safe in the queue; retry is scheduled.', false, now);
    }
    return false;
  }
}
