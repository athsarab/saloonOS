import { AppState, Platform } from 'react-native';
import { create } from 'zustand';
import * as Network from 'expo-network';
import { randomUUID } from 'expo-crypto';
import { env } from '../config/env';
import { useAuthStore } from '../lib/auth';
import { apiRequest } from '../lib/api';
import type { CheckoutRequest } from '../lib/checkout-api';
import { getOfflineQueue } from './storage';
import { deviceCredential, lockOffline, offlineLocked, unlockOffline } from './device';
import { OfflineBlockedError, synchronizeNext } from './processor';
import { sessionScope, type OfflineSnapshot, type QueueItem, type SyncResult } from './types';

export const offlineSupported = Platform.OS === 'android';
type OfflineRuntime = { apiOnline: boolean; checking: boolean; networkAvailable: boolean; snapshot: OfflineSnapshot | null; items: QueueItem[]; error: string; syncing: boolean; locked: boolean };
export const useOffline = create<OfflineRuntime>(() => ({ apiOnline: false, checking: true, networkAvailable: false, snapshot: null, items: [], error: '', syncing: false, locked: true }));
const scope = () => sessionScope(useAuthStore.getState().accessToken);
let syncing = false, started = false, probing = false;
function secureTransport() {
  if (!__DEV__ && !env.apiUrl.startsWith('https://')) throw new Error('Offline authorization and synchronization require HTTPS in production. Local records were preserved.');
}
export async function loadOffline() {
  if (!offlineSupported) { useOffline.setState({ checking: false }); return; }
  const current = scope();
  if (!current) { useOffline.setState({ snapshot: null, items: [], locked: true }); return; }
  try {
    const queue = await getOfflineQueue();
    const [snapshot, items, priorLock] = await Promise.all([queue.snapshot(current), queue.list(current), offlineLocked()]);
    const financialIssue = snapshot && items.some(item => item.grant_id === snapshot.grantId && ['rejected', 'conflicted'].includes(item.state));
    if (financialIssue) await lockOffline();
    const locked = priorLock || !!financialIssue;
    if (scope() === current) useOffline.setState({ snapshot, items, locked, error: '' });
  } catch (error) {
    useOffline.setState({ error: error instanceof Error ? error.message : 'Offline storage is unavailable. No local data was deleted.' });
  }
}
export async function probeApi() {
  if (probing) return useOffline.getState().apiOnline;
  probing = true;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 4000);
  try {
    const network = await Network.getNetworkStateAsync();
    useOffline.setState({ checking: true, networkAvailable: network.isConnected !== false });
    if (network.isConnected === false) throw new Error('No network');
    const response = await fetch(env.apiUrl + '/v1/health', { signal: controller.signal, headers: { Accept: 'application/json' } });
    const health = await response.json() as { status?: string; database?: string };
    const online = response.ok && health.status === 'ok' && health.database === 'connected';
    useOffline.setState({ apiOnline: online, checking: false });
    return online;
  } catch { useOffline.setState({ apiOnline: false, checking: false }); return false; }
  finally { clearTimeout(timer); probing = false; }
}
export async function syncPending() {
  if (!offlineSupported || syncing || !useOffline.getState().apiOnline) return;
  const current = scope();
  if (!current) return;
  syncing = true; useOffline.setState({ syncing: true });
  let failure = '';
  try {
    secureTransport();
    const queue = await getOfflineQueue();
    for (let count = 0; count < 10 && scope() === current; count++) {
      const more = await synchronizeNext(queue, current, async operation => {
        let device;
        try { device = await deviceCredential(current.split(':')[0], false); }
        catch (error) { throw new OfflineBlockedError(error instanceof Error ? error.message : 'Registered device credentials are unavailable. Queue preserved.'); }
        if (device.id !== operation.deviceId) throw new OfflineBlockedError('Operation belongs to another registered device. Restore its credentials; do not create a replacement sale.');
        const { provisionalReceipt: _localReceipt, ...request } = operation;
        const result = await apiRequest<SyncResult>('/v1/offline/sync-cash', { method: 'POST', headers: { 'x-offline-device-secret': device.secret }, body: JSON.stringify(request) }, false);
        if (result.state === 'rejected' || result.state === 'conflicted') await lockOffline();
        return result;
      });
      if (!more) break;
    }
  } catch (error) { failure = error instanceof Error ? error.message : 'Could not synchronize. Queue preserved.'; }
  finally { syncing = false; useOffline.setState({ syncing: false }); await loadOffline(); if (failure) useOffline.setState({ error: failure }); }
}
export async function registerOfflineDevice(name: string) {
  secureTransport();
  if (!offlineSupported) throw new Error('Offline cash checkout is Android-only.');
  const current = scope();
  if (!current) throw new Error('Sign in first.');
  // Verify encrypted storage works before registering a device.
  await getOfflineQueue();
  const device = await deviceCredential(current.split(':')[0]);
  await apiRequest('/v1/offline/devices', { method: 'POST', headers: { 'x-offline-device-secret': device.secret }, body: JSON.stringify({ id: device.id, name }) });
  return device.id;
}
export async function prepareOffline(branchId: string) {
  secureTransport();
  if (!offlineSupported) throw new Error('Offline cash checkout is Android-only.');
  if (!await probeApi()) throw new Error('The API must be reachable to download an offline authorization.');
  const current = scope();
  if (!current) throw new Error('Sign in first.');
  const queue = await getOfflineQueue(), device = await deviceCredential(current.split(':')[0], false);
  const snapshot = await apiRequest<OfflineSnapshot>('/v1/offline/prepare', { method: 'POST', headers: { 'x-offline-device-secret': device.secret }, body: JSON.stringify({ deviceId: device.id, branchId }) });
  if (current !== snapshot.tenantId + ':' + snapshot.userId || scope() !== current) throw new Error('Account changed; offline download was not activated.');
  await queue.saveSnapshot(current, snapshot);
  await unlockOffline();
  await loadOffline();
}
export async function recordOfflineCash(payload: CheckoutRequest) {
  secureTransport();
  if (!offlineSupported) throw new Error('Offline cash checkout is Android-only.');
  if (await offlineLocked()) throw new Error('Offline checkout is locked after sign-out. Prepare it online again.');
  const current = scope();
  if (!current) throw new Error('Sign in before taking offline cash.');
  const operation = await (await getOfflineQueue()).record(current, randomUUID(), payload);
  await loadOffline();
  // Returning success never depends on connectivity; the local commit already completed.
  void syncPending();
  return operation;
}
export async function previewOfflineCash(payload: CheckoutRequest) {
  if (!offlineSupported || await offlineLocked()) throw new Error('Offline checkout is locked. Reconnect and consult a manager.');
  const current = scope();
  if (!current) throw new Error('Sign in first.');
  return (await getOfflineQueue()).preview(current, payload);
}
export async function retryOffline(id?: string) {
  const current = scope();
  if (!current) throw new Error('Sign in to retry your queued sales.');
  await (await getOfflineQueue()).retry(current, id);
  await loadOffline();
  if (await probeApi()) await syncPending();
}
export function startOfflineRuntime() {
  if (started) return () => {};
  started = true;
  const tick = () => {
    if (AppState.currentState !== 'active') return;
    void probeApi().then(online => { if (online) void syncPending(); });
  };
  void loadOffline(); tick();
  const network = Network.addNetworkStateListener(tick);
  const state = AppState.addEventListener('change', next => { if (next === 'active') { void loadOffline(); tick(); } });
  const auth = useAuthStore.subscribe((next, previous) => {
    if (next.accessToken !== previous.accessToken) { useOffline.setState({ snapshot: null, items: [] }); void loadOffline(); tick(); }
  });
  const timer = setInterval(tick, 15000);
  return () => { started = false; clearInterval(timer); network.remove(); state.remove(); auth(); };
}
