import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { firebaseAuth, firestore } from './firebase';
import { apiRequest, isApiConfigured } from './api';
import { getSyncQueue, removeSyncItem } from './database';

let running = false;

async function pushToFirebase(item, userId) {
  if (!firestore || !userId) return false;
  const ref = doc(collection(firestore, 'users', userId, item.entity), item.entity_id);
  if (item.operation === 'delete') await deleteDoc(ref);
  else await setDoc(ref, { ...item.payload, updatedAt: item.created_at }, { merge: true });
  return true;
}

async function pushToApi(item) {
  if (!isApiConfigured()) return false;
  await apiRequest(`/sync/${item.entity}/${item.entity_id}`, {
    method: item.operation === 'delete' ? 'DELETE' : 'PUT',
    ...(item.operation === 'delete' ? {} : { body: JSON.stringify(item.payload) }),
  });
  return true;
}

export async function syncPending() {
  if (running) return { synced: 0, pending: (await getSyncQueue()).length };
  running = true;
  let synced = 0;
  try {
    const queue = await getSyncQueue();
    const userId = firebaseAuth?.currentUser?.uid;
    for (const item of queue) {
      try {
        const sent = await pushToFirebase(item, userId) || await pushToApi(item);
        if (sent) { await removeSyncItem(item.id); synced += 1; }
      } catch (error) {
        console.warn('[sync] item deferred:', error?.message || error);
      }
    }
    return { synced, pending: Math.max(0, queue.length - synced) };
  } finally {
    running = false;
  }
}
