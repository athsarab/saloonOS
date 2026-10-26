import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { AESEncryptionKey, AESKeySize, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import { OfflineQueue, type Codec, type SqlDatabase } from './queue';
let initialized: Promise<OfflineQueue> | null = null;
export function getOfflineQueue(): Promise<OfflineQueue> {
  if (!initialized) initialized = initialize().catch(error => { initialized = null; throw error; });
  return initialized;
}
async function initialize() {
  const db = await SQLite.openDatabaseAsync('salonos-offline-v1.db');
  const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
  let encoded = await SecureStore.getItemAsync('salonos.offline.encryption-key');
  if (!encoded) {
    const table = await db.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name='offline_operations'");
    if (table) {
      const count = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM offline_operations');
      const snapshots = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM offline_snapshots');
      if ((count?.count ?? 0) + (snapshots?.count ?? 0) > 0) throw new Error('The offline encryption key is unavailable. Existing records were preserved. Restore device access; do not reset the database.');
    }
    const key = await AESEncryptionKey.generate(AESKeySize.AES256);
    encoded = await key.encoded('hex');
    await SecureStore.setItemAsync('salonos.offline.encryption-key', encoded, options);
  }
  const key = await AESEncryptionKey.import(encoded, 'hex');
  const encoder = new TextEncoder(), decoder = new TextDecoder();
  const codec: Codec = {
    async seal(value, context) {
      return (await aesEncryptAsync(encoder.encode(value), key, { additionalData: encoder.encode(context) })).combined('base64');
    },
    async open(value, context) {
      return decoder.decode(await aesDecryptAsync(AESSealedData.fromCombined(value), key, { additionalData: encoder.encode(context) }));
    },
  };
  const queue = new OfflineQueue(db as unknown as SqlDatabase, codec);
  await queue.initialize();
  return queue;
}
