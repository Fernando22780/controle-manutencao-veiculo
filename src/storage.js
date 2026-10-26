import AsyncStorage from '@react-native-async-storage/async-storage';

const RECORDS_KEY = '@controle_manutencao_registros';
const VEHICLES_KEY = '@controle_manutencao_veiculos';
const SELECTED_VEHICLE_KEY = '@controle_manutencao_veiculo_selecionado';
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

async function saveVehicles(vehicles) { await AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles)); return vehicles; }
export async function getVehicles() {
  const saved = await AsyncStorage.getItem(VEHICLES_KEY);
  if (saved) return JSON.parse(saved);
  // Migra os nomes de veículo guardados na P1 para a nova garagem sem perder histórico.
  const legacyRecords = await getRecords();
  const legacyNames = [...new Set(legacyRecords.map((record) => record.vehicle?.trim()).filter(Boolean))];
  const migrated = legacyNames.map((name, index) => ({ id: `legacy-${index + 1}`, name, plate: '', year: '', legacy: true }));
  await saveVehicles(migrated);
  return migrated;
}
export async function addVehicle({ name, plate, year = '' }) {
  const vehicles = await getVehicles();
  const normalizedPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalizedPlate && vehicles.some((vehicle) => vehicle.plate?.toUpperCase().replace(/[^A-Z0-9]/g, '') === normalizedPlate)) return null;
  const vehicle = { id: Date.now().toString(), name: name.trim(), plate: plate.trim().toUpperCase(), year: year.trim(), createdAt: new Date().toISOString() };
  await saveVehicles([vehicle, ...vehicles]);
  const selectedId = await AsyncStorage.getItem(SELECTED_VEHICLE_KEY);
  if (!selectedId) await AsyncStorage.setItem(SELECTED_VEHICLE_KEY, vehicle.id);
  return vehicle;
}
export async function updateVehicle(id, { name, plate, year = '' }) {
  const vehicles = await getVehicles();
  const normalizedPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalizedPlate && vehicles.some((vehicle) => vehicle.id !== id && vehicle.plate?.toUpperCase().replace(/[^A-Z0-9]/g, '') === normalizedPlate)) return null;
  const existing = vehicles.find((vehicle) => vehicle.id === id);
  if (!existing) return null;
  const updated = { ...existing, name: name.trim(), plate: plate.trim().toUpperCase(), year: year.trim(), legacy: false, updatedAt: new Date().toISOString() };
  await saveVehicles(vehicles.map((vehicle) => vehicle.id === id ? updated : vehicle));
  const records = await getRecords();
  let linkedLegacyRecords = false;
  const migratedRecords = records.map((record) => {
    if (!record.vehicleId && record.vehicle?.trim() === existing.name) {
      linkedLegacyRecords = true;
      return { ...record, vehicleId: id, vehicleName: updated.name, vehiclePlate: updated.plate, vehicleYear: updated.year };
    }
    return record;
  });
  if (linkedLegacyRecords) await saveRecords(migratedRecords);
  return updated;
}
export async function getSelectedVehicleId() {
  const vehicles = await getVehicles();
  const savedId = await AsyncStorage.getItem(SELECTED_VEHICLE_KEY);
  if (savedId && vehicles.some((vehicle) => vehicle.id === savedId)) return savedId;
  const firstId = vehicles[0]?.id || null;
  if (firstId) await AsyncStorage.setItem(SELECTED_VEHICLE_KEY, firstId);
  else await AsyncStorage.removeItem(SELECTED_VEHICLE_KEY);
  return firstId;
}
export async function setSelectedVehicleId(id) {
  if (!id) { await AsyncStorage.removeItem(SELECTED_VEHICLE_KEY); return; }
  await AsyncStorage.setItem(SELECTED_VEHICLE_KEY, id);
}
// Atualiza o km atual do veículo (usado nos avisos por quilometragem).
export async function setVehicleKm(id, km) {
  const vehicles = await getVehicles();
  if (!vehicles.some((vehicle) => vehicle.id === id)) return null;
  const updated = vehicles.map((vehicle) => vehicle.id === id ? { ...vehicle, currentKm: km, currentKmDate: new Date().toISOString() } : vehicle);
  await saveVehicles(updated);
  return updated.find((vehicle) => vehicle.id === id);
}
export async function removeVehicle(id) {
  const records = await getRecords();
  if (records.some((record) => record.vehicleId === id)) return { ok: false, reason: 'linked-records' };
  const vehicles = await getVehicles();
  await saveVehicles(vehicles.filter((vehicle) => vehicle.id !== id));
  const selectedId = await AsyncStorage.getItem(SELECTED_VEHICLE_KEY);
  if (selectedId === id) {
    const replacement = vehicles.find((vehicle) => vehicle.id !== id);
    if (replacement) await AsyncStorage.setItem(SELECTED_VEHICLE_KEY, replacement.id);
    else await AsyncStorage.removeItem(SELECTED_VEHICLE_KEY);
  }
  return { ok: true };
}

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
export async function updatePassword(currentPassword, newPassword) {
  const user = await getUser();
  if (!user || user.password !== currentPassword) return { ok: false, message: 'A senha antiga não confere.' };
  const updated = { ...user, password: newPassword };
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
  return { ok: true, user: updated };
}
export async function setBiometricEnabled(enabled) { return updateUser({ biometricEnabled: Boolean(enabled) }); }
export async function validateUser(email, password) { const user = await getUser(); if (!user) return { ok: false, message: 'Nenhuma conta cadastrada neste aparelho.' }; if (user.email !== email.trim().toLowerCase() || user.password !== password) return { ok: false, message: 'E-mail ou senha incorretos.' }; return { ok: true, user }; }
export async function clearUser() { await AsyncStorage.removeItem(USER_KEY); await clearSession(); }
export async function saveSession(userId, keepLogged) { if (!keepLogged) { await AsyncStorage.removeItem(SESSION_KEY); return; } await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ userId, expiresAt: Date.now() + 30 * 60 * 1000 })); }
export async function getActiveSession() { const saved = await AsyncStorage.getItem(SESSION_KEY); if (!saved) return null; const session = JSON.parse(saved); if (session.expiresAt <= Date.now()) { await clearSession(); return null; } return session; }
export async function clearSession() { await AsyncStorage.removeItem(SESSION_KEY); }
