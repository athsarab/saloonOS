import type { OfflineQueue } from './queue';
export function getOfflineQueue(): Promise<OfflineQueue> {
  return Promise.reject(new Error('Offline cash checkout is available on the Android app only.'));
}
