import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { belongsToVehicle } from './maintenanceUtils';
import { enqueueSync, getValue, initDatabase, removeValue, setValue } from './database';
import { firebaseAuth, firebaseEnabled, firestore, getFirebaseConfigStatus } from './firebase';
import { syncPending } from './sync';

const RECORDS_KEY = '@controle_manutencao_registros';
const VEHICLES_KEY = '@controle_manutencao_veiculos';
const SELECTED_VEHICLE_KEY = '@controle_manutencao_veiculo_selecionado';
const STAGING_LOCATION_KEY = '@controle_manutencao_staging_localizacao';
const STAGING_PHOTO_KEY = '@controle_manutencao_staging_foto';
const USER_KEY = '@controle_manutencao_usuario';
const SESSION_KEY = '@controle_manutencao_sessao';
const MAINTENANCE_DRAFT_KEY = '@controle_manutencao_rascunho';

let initialized = false;
async function ready() { if (!initialized) { await initDatabase(); initialized = true; } }
async function readJson(key, fallback) { await ready(); const saved = await getValue(key); return saved ? JSON.parse(saved) : fallback; }
async function writeJson(key, value) { await ready(); await setValue(key, JSON.stringify(value)); return value; }
async function userScopedKey(key) { const user = await getUser(); return user?.id ? `${key}:${user.id}` : key; }
async function changed(entity, item, operation = 'upsert') { await enqueueSync(entity, item.id, operation, item); syncPending().catch(() => {}); }

export async function getRecords() { return readJson(await userScopedKey(RECORDS_KEY), []); }
async function saveRecords(records) { return writeJson(await userScopedKey(RECORDS_KEY), records); }
export async function addRecord(record) { const records = await getRecords(); const next = [record, ...records]; await saveRecords(next); await changed('records', record); return next; }
export async function updateRecord(id, changes) { const records = await getRecords(); const item = records.find((record) => record.id === id); const next = records.map((record) => record.id === id ? { ...record, ...changes } : record); await saveRecords(next); if (item) await changed('records', { ...item, ...changes }); return next; }
export async function removeRecord(id) { const records = await getRecords(); const removed = records.find((record) => record.id === id); const next = records.filter((item) => item.id !== id); await saveRecords(next); if (removed) await changed('records', removed, 'delete'); return next; }

async function saveVehicles(vehicles) { return writeJson(await userScopedKey(VEHICLES_KEY), vehicles); }
export async function getVehicles() { return readJson(await userScopedKey(VEHICLES_KEY), []); }
export async function addVehicle({ name, plate, year = '' }) {
  const vehicles = await getVehicles(); const normalizedPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalizedPlate && vehicles.some((vehicle) => vehicle.plate?.toUpperCase().replace(/[^A-Z0-9]/g, '') === normalizedPlate)) return null;
  const vehicle = { id: Date.now().toString(), name: name.trim(), plate: plate.trim().toUpperCase(), year: year.trim(), createdAt: new Date().toISOString() };
  await saveVehicles([vehicle, ...vehicles]); const selectedId = await getValue(await userScopedKey(SELECTED_VEHICLE_KEY));
  if (!selectedId) await setValue(await userScopedKey(SELECTED_VEHICLE_KEY), vehicle.id); await changed('vehicles', vehicle); return vehicle;
}
export async function updateVehicle(id, { name, plate, year = '' }) {
  const vehicles = await getVehicles(); const normalizedPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalizedPlate && vehicles.some((vehicle) => vehicle.id !== id && vehicle.plate?.toUpperCase().replace(/[^A-Z0-9]/g, '') === normalizedPlate)) return null;
  const existing = vehicles.find((vehicle) => vehicle.id === id); if (!existing) return null;
  const updated = { ...existing, name: name.trim(), plate: plate.trim().toUpperCase(), year: year.trim(), legacy: false, updatedAt: new Date().toISOString() };
  await saveVehicles(vehicles.map((vehicle) => vehicle.id === id ? updated : vehicle)); const records = await getRecords();
  const migrated = records.map((record) => !record.vehicleId && record.vehicle?.trim() === existing.name ? { ...record, vehicleId: id, vehicleName: updated.name, vehiclePlate: updated.plate, vehicleYear: updated.year } : record);
  if (JSON.stringify(migrated) !== JSON.stringify(records)) await saveRecords(migrated); await changed('vehicles', updated); return updated;
}
export async function getSelectedVehicleId() { const vehicles = await getVehicles(); const savedId = await getValue(await userScopedKey(SELECTED_VEHICLE_KEY)); if (savedId && vehicles.some((vehicle) => vehicle.id === savedId)) return savedId; const firstId = vehicles[0]?.id || null; if (firstId) await setValue(await userScopedKey(SELECTED_VEHICLE_KEY), firstId); else await removeValue(await userScopedKey(SELECTED_VEHICLE_KEY)); return firstId; }
export async function setSelectedVehicleId(id) { const key = await userScopedKey(SELECTED_VEHICLE_KEY); if (!id) return removeValue(key); return setValue(key, id); }
export async function setVehicleKm(id, km) { const vehicles = await getVehicles(); if (!vehicles.some((vehicle) => vehicle.id === id)) return null; const updated = vehicles.map((vehicle) => vehicle.id === id ? { ...vehicle, currentKm: km, currentKmDate: new Date().toISOString() } : vehicle); await saveVehicles(updated); const item = updated.find((vehicle) => vehicle.id === id); await changed('vehicles', item); return item; }
export async function removeVehicle(id, { withRecords = false } = {}) { const vehicles = await getVehicles(); const target = vehicles.find((vehicle) => vehicle.id === id); if (!target) return { ok: false, reason: 'not-found' }; const records = await getRecords(); const linked = records.filter((record) => belongsToVehicle(record, target)); if (linked.length && !withRecords) return { ok: false, reason: 'linked-records', count: linked.length }; if (linked.length) await saveRecords(records.filter((record) => !belongsToVehicle(record, target))); await saveVehicles(vehicles.filter((vehicle) => vehicle.id !== id)); if (await getValue(await userScopedKey(SELECTED_VEHICLE_KEY)) === id) { const replacement = vehicles.find((vehicle) => vehicle.id !== id); if (replacement) await setValue(await userScopedKey(SELECTED_VEHICLE_KEY), replacement.id); else await removeValue(await userScopedKey(SELECTED_VEHICLE_KEY)); } await changed('vehicles', target, 'delete'); return { ok: true, removedRecords: linked.length }; }

export async function setStagingLocation(coords) { return setValue(STAGING_LOCATION_KEY, JSON.stringify(coords)); }
export async function getStagingLocation() { return readJson(STAGING_LOCATION_KEY, null); }
export async function clearStagingLocation() { return removeValue(STAGING_LOCATION_KEY); }
export async function setStagingPhoto(uri) { return setValue(STAGING_PHOTO_KEY, uri); }
export async function getStagingPhoto() { return getValue(STAGING_PHOTO_KEY); }
export async function clearStagingPhoto() { return removeValue(STAGING_PHOTO_KEY); }
export async function getMaintenanceDraft() { return readJson(MAINTENANCE_DRAFT_KEY, null); }
export async function saveMaintenanceDraft(draft) { return setValue(MAINTENANCE_DRAFT_KEY, JSON.stringify(draft)); }
export async function clearMaintenanceDraft() { return removeValue(MAINTENANCE_DRAFT_KEY); }

async function saveLocalUser(user) { await setValue(USER_KEY, JSON.stringify(user)); return user; }
export async function getUser() { return readJson(USER_KEY, null); }
function friendlyAuthMessage(error, fallback = 'Não foi possível concluir o acesso.') { const messages = { 'auth/invalid-credential': 'E-mail ou senha incorretos.', 'auth/wrong-password': 'E-mail ou senha incorretos.', 'auth/user-not-found': 'E-mail ou senha incorretos.', 'auth/invalid-email': 'Digite um e-mail válido.', 'auth/user-disabled': 'Esta conta está desativada.', 'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.', 'auth/email-already-in-use': 'Este e-mail já está cadastrado. Tente entrar ou use outro e-mail.', 'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.' }; return messages[error?.code] || fallback; }
export async function createUser({ name, email, password }) { const cleanEmail = email.trim().toLowerCase(); let user = { id: Date.now().toString(), name: name.trim(), email: cleanEmail, password, biometricEnabled: false }; if (!firebaseEnabled || !firebaseAuth) { const status = getFirebaseConfigStatus(); throw new Error(`Firebase não inicializado. Campos ausentes: ${status.missing.join(', ') || 'Auth no Expo'}.`); } try { const credential = await createUserWithEmailAndPassword(firebaseAuth, cleanEmail, password); user = { ...user, id: credential.user.uid }; Promise.all([updateProfile(credential.user, { displayName: name.trim() }), setDoc(doc(firestore, 'users', user.id), { name: user.name, email: user.email, updatedAt: Date.now() }, { merge: true })]).catch((error) => console.warn('[firebase] perfil será sincronizado depois:', error?.message || error)); } catch (error) { if (error?.code === 'auth/network-request-failed') return saveLocalUser(user); throw new Error(friendlyAuthMessage(error, 'Não foi possível criar a conta.')); } return saveLocalUser(user); }
export async function updateUser(changes) { const current = await getUser(); if (!current) return null; const user = { ...current, ...changes, name: (changes.name ?? current.name).trim(), email: (changes.email ?? current.email).trim().toLowerCase() }; await saveLocalUser(user); if (firebaseAuth?.currentUser) await setDoc(doc(firestore, 'users', user.id), { name: user.name, email: user.email, updatedAt: Date.now() }, { merge: true }); return user; }
export async function updatePassword(currentPassword, newPassword) { const user = await getUser(); if (!user || user.password !== currentPassword) return { ok: false, message: 'A senha antiga não confere.' }; const updated = { ...user, password: newPassword }; await saveLocalUser(updated); return { ok: true, user: updated }; }
export async function setBiometricEnabled(enabled) { return updateUser({ biometricEnabled: Boolean(enabled) }); }
export async function validateUser(email, password) { const cleanEmail = email.trim().toLowerCase(); const local = await getUser(); if (!firebaseEnabled || !firebaseAuth) return { ok: false, message: 'Firebase não inicializado. Confira o arquivo .env e reinicie o Expo com npx expo start -c.' }; try { const credential = await signInWithEmailAndPassword(firebaseAuth, cleanEmail, password); const profile = await getDoc(doc(firestore, 'users', credential.user.uid)); const remote = { ...(profile.exists() ? profile.data() : {}), id: credential.user.uid, email: cleanEmail, password, biometricEnabled: local?.biometricEnabled || false }; await saveLocalUser(remote); return { ok: true, user: remote }; } catch (error) { if (error?.code === 'auth/user-not-found') { await clearUser(); return { ok: false, message: 'Esta conta não existe mais no Firebase. Você pode cadastrá-la novamente.' }; } if (!local || error?.code !== 'auth/network-request-failed') return { ok: false, message: friendlyAuthMessage(error, 'E-mail ou senha incorretos.') }; } if (!local) return { ok: false, message: 'Nenhuma conta cadastrada neste aparelho.' }; if (local.email !== cleanEmail || local.password !== password) return { ok: false, message: 'E-mail ou senha incorretos.' }; return { ok: true, user: local }; }
export async function clearUser() { await removeValue(USER_KEY); await clearSession(); }
export async function saveSession(userId, keepLogged) { if (!keepLogged) return removeValue(SESSION_KEY); return setValue(SESSION_KEY, JSON.stringify({ userId, expiresAt: Date.now() + 30 * 60 * 1000 })); }
export async function getActiveSession() { const session = await readJson(SESSION_KEY, null); if (!session) return null; if (session.expiresAt <= Date.now()) { await clearSession(); return null; } return session; }
export async function clearSession() { return removeValue(SESSION_KEY); }
