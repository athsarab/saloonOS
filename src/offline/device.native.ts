import * as SecureStore from 'expo-secure-store';
import { getRandomValues, randomUUID } from 'expo-crypto';
import type { DeviceCredential } from './types';
export async function deviceCredential(tenantId: string, create = true): Promise<DeviceCredential> {
  const name = 'salonos.offline.device.' + tenantId;
  const prior = await SecureStore.getItemAsync(name);
  if (prior) return JSON.parse(prior) as DeviceCredential;
  if (!create) throw new Error('Registered device credentials are missing. Queue preserved; restore this device or consult a manager.');
  const secret = Array.from(getRandomValues(new Uint8Array(32))).map(value => value.toString(16).padStart(2, '0')).join('');
  const device = { id: randomUUID(), secret };
  await SecureStore.setItemAsync(name, JSON.stringify(device), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return device;
}
export async function lockOffline() { await SecureStore.setItemAsync('salonos.offline.locked', 'true'); }
export async function unlockOffline() { await SecureStore.deleteItemAsync('salonos.offline.locked'); }
export async function offlineLocked() { return (await SecureStore.getItemAsync('salonos.offline.locked')) === 'true'; }
