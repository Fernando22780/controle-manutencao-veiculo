import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'controle-manutencao.db';
let dbPromise;

export const usesSQLite = Platform.OS !== 'web';

async function getDb() {
  if (!usesSQLite) return null;
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT);
        CREATE TABLE IF NOT EXISTS sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
      `);
      const migrated = await db.getFirstAsync('SELECT value FROM kv WHERE key = ?', '@controle_manutencao_migrated_to_sqlite');
      if (!migrated) {
        const legacyKeys = await AsyncStorage.getAllKeys();
        for (const key of legacyKeys) {
          const value = await AsyncStorage.getItem(key);
          if (value !== null) await db.runAsync('INSERT OR IGNORE INTO kv (key, value) VALUES (?, ?)', key, value);
        }
        await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', '@controle_manutencao_migrated_to_sqlite', '1');
      }
      return db;
    });
  }
  return dbPromise;
}

export async function getValue(key) {
  const db = await getDb();
  if (!db) return AsyncStorage.getItem(key);
  const row = await db.getFirstAsync('SELECT value FROM kv WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setValue(key, value) {
  const db = await getDb();
  if (!db) return AsyncStorage.setItem(key, value);
  await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, value);
}

export async function removeValue(key) {
  const db = await getDb();
  if (!db) return AsyncStorage.removeItem(key);
  await db.runAsync('DELETE FROM kv WHERE key = ?', key);
}

export async function enqueueSync(entity, entityId, operation, payload) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.runAsync(
    'INSERT INTO sync_queue (entity, entity_id, operation, payload, created_at) VALUES (?, ?, ?, ?, ?)',
    entity, entityId, operation, JSON.stringify(payload), Date.now(),
  );
  return result.lastInsertRowId;
}

export async function getSyncQueue() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.getAllAsync('SELECT * FROM sync_queue ORDER BY id ASC');
  return rows.map((row) => ({ ...row, payload: JSON.parse(row.payload) }));
}

export async function removeSyncItem(id) {
  const db = await getDb();
  if (db) await db.runAsync('DELETE FROM sync_queue WHERE id = ?', id);
}

export async function initDatabase() {
  await getDb();
}
