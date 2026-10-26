import type { DeviceCredential } from './types';
export async function deviceCredential(_tenantId: string, _create = true): Promise<DeviceCredential> { throw new Error('Offline device credentials are Android-only.'); }
export async function lockOffline() {}
export async function unlockOffline() {}
export async function offlineLocked() { return true; }
