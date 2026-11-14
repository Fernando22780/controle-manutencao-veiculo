import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@controle_manutencao_fila_sync';
export const usesSQLite = false;

export async function initDatabase() {}
export async function getValue(key) { return AsyncStorage.getItem(key); }
export async function setValue(key, value) { return AsyncStorage.setItem(key, value); }
export async function removeValue(key) { return AsyncStorage.removeItem(key); }
export async function enqueueSync(entity, entityId, operation, payload) {
  const queue = await getSyncQueue();
  const next = [...queue, { id: `${Date.now()}-${Math.random()}`, entity, entity_id: entityId, operation, payload, created_at: Date.now() }];
  await setValue(QUEUE_KEY, JSON.stringify(next));
  return next[next.length - 1].id;
}
export async function getSyncQueue() { const raw = await getValue(QUEUE_KEY); return raw ? JSON.parse(raw) : []; }
export async function removeSyncItem(id) { const queue = (await getSyncQueue()).filter((item) => item.id !== id); return setValue(QUEUE_KEY, JSON.stringify(queue)); }
