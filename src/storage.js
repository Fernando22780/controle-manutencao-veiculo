import AsyncStorage from '@react-native-async-storage/async-storage';

const RECORDS_KEY = '@controle_manutencao_registros';
const STAGING_LOCATION_KEY = '@controle_manutencao_staging_localizacao';
const STAGING_PHOTO_KEY = '@controle_manutencao_staging_foto';
const USER_KEY = '@controle_manutencao_usuario';
const SESSION_KEY = '@controle_manutencao_sessao';
const MAINTENANCE_DRAFT_KEY = '@controle_manutencao_rascunho';

export async function getRecords() { const saved = await AsyncStorage.getItem(RECORDS_KEY); return saved ? JSON.parse(saved) : []; }
async function saveRecords(records) { await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(records)); return records; }
export async function addRecord(record) { const records = await getRecords(); return saveRecords([record, ...records]); }
export async function updateRecord(id, changes) { const records = await getRecords(); return saveRecords(records.map((item) => item.id === id ? { ...item, ...changes } : item)); }
export async function removeRecord(id) { const records = await getRecords(); return saveRecords(records.filter((item) => item.id !== id)); }

export async function setStagingLocation(coords) { await AsyncStorage.setItem(STAGING_LOCATION_KEY, JSON.stringify(coords)); }
export async function getStagingLocation() { const saved = await AsyncStorage.getItem(STAGING_LOCATION_KEY); return saved ? JSON.parse(saved) : null; }
export async function clearStagingLocation() { await AsyncStorage.removeItem(STAGING_LOCATION_KEY); }
export async function setStagingPhoto(uri) { await AsyncStorage.setItem(STAGING_PHOTO_KEY, uri); }
export async function getStagingPhoto() { return AsyncStorage.getItem(STAGING_PHOTO_KEY); }
export async function clearStagingPhoto() { await AsyncStorage.removeItem(STAGING_PHOTO_KEY); }
export async function getMaintenanceDraft() { const saved = await AsyncStorage.getItem(MAINTENANCE_DRAFT_KEY); return saved ? JSON.parse(saved) : null; }
export async function saveMaintenanceDraft(draft) { await AsyncStorage.setItem(MAINTENANCE_DRAFT_KEY, JSON.stringify(draft)); }
export async function clearMaintenanceDraft() { await AsyncStorage.removeItem(MAINTENANCE_DRAFT_KEY); }

export async function getUser() { const saved = await AsyncStorage.getItem(USER_KEY); return saved ? JSON.parse(saved) : null; }
export async function createUser({ name, email, password }) { const user = { id: Date.now().toString(), name: name.trim(), email: email.trim().toLowerCase(), password, biometricEnabled: false }; await AsyncStorage.setItem(USER_KEY, JSON.stringify(user)); return user; }
export async function updateUser(changes) { const current = await getUser(); if (!current) return null; const user = { ...current, ...changes, name: (changes.name ?? current.name).trim(), email: (changes.email ?? current.email).trim().toLowerCase() }; await AsyncStorage.setItem(USER_KEY, JSON.stringify(user)); return user; }
export async function setBiometricEnabled(enabled) { return updateUser({ biometricEnabled: Boolean(enabled) }); }
export async function validateUser(email, password) { const user = await getUser(); if (!user) return { ok: false, message: 'Nenhuma conta cadastrada neste aparelho.' }; if (user.email !== email.trim().toLowerCase() || user.password !== password) return { ok: false, message: 'E-mail ou senha incorretos.' }; return { ok: true, user }; }
export async function clearUser() { await AsyncStorage.removeItem(USER_KEY); await clearSession(); }
export async function saveSession(userId, keepLogged) { if (!keepLogged) { await AsyncStorage.removeItem(SESSION_KEY); return; } await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ userId, expiresAt: Date.now() + 30 * 60 * 1000 })); }
export async function getActiveSession() { const saved = await AsyncStorage.getItem(SESSION_KEY); if (!saved) return null; const session = JSON.parse(saved); if (session.expiresAt <= Date.now()) { await clearSession(); return null; } return session; }
export async function clearSession() { await AsyncStorage.removeItem(SESSION_KEY); }
