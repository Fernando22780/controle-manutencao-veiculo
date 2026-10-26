import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW, getRecordStatus, getRecordStatusText } from '../theme';
import PrimaryButton from '../components/PrimaryButton';
import CenteredMessage from '../components/CenteredMessage';
import CalendarPicker from '../components/CalendarPicker';
import {
  addRecord,
  clearStagingLocation,
  clearStagingPhoto,
  getRecords,
  getStagingLocation,
  getStagingPhoto,
  removeRecord,
  setStagingLocation,
  setStagingPhoto,
  clearMaintenanceDraft,
  getMaintenanceDraft,
  saveMaintenanceDraft,
  getVehicles,
  getSelectedVehicleId,
  setSelectedVehicleId,
} from '../storage';
import {
  SERVICE_TYPES,
  buildReminder,
  filterRecords,
  describeNext,
  formatKm,
  formatKmInput,
  formatMoney,
  getCurrentKm,
  onlyDigits,
  parseKm,
  parseMoney,
  sanitizeMoneyInput,
  suggestionFor,
} from '../maintenanceUtils';

export default function MaintenanceScreen({ navigation }) {
  const [vehicleId, setVehicleId] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [vehiclePickerVisible, setVehiclePickerVisible] = useState(false);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [km, setKm] = useState('');
  const [cost, setCost] = useState('');
  const [reminderOn, setReminderOn] = useState(false);
  const [kmInterval, setKmInterval] = useState('');
  const [monthsInterval, setMonthsInterval] = useState('');
  const [historyVehicle, setHistoryVehicle] = useState('all');
  const [historyQuery, setHistoryQuery] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stagedLocation, setStagedLocation] = useState(null);
  const [stagedPhoto, setStagedPhoto] = useState(null);
  const [modal, setModal] = useState(null);
  const draftReady = useRef(false);
  const historyFilterReady = useRef(false);

  useEffect(() => {
    if (!draftReady.current) return;
    saveMaintenanceDraft({ vehicleId, description, date, km, cost, reminderOn, kmInterval, monthsInterval });
  }, [vehicleId, description, date, km, cost, reminderOn, kmInterval, monthsInterval]);

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    setLoading(true);
    const [savedRecords, location, photo, savedVehicles, selectedId, draft] = await Promise.all([
      getRecords(),
      getStagingLocation(),
      getStagingPhoto(),
      getVehicles(),
      getSelectedVehicleId(),
      getMaintenanceDraft(),
    ]);
    setRecords(savedRecords);
    setStagedLocation(location);
    setStagedPhoto(photo);
    setVehicles(savedVehicles);
    const activeVehicleId = draft?.vehicleId || selectedId || savedVehicles[0]?.id || null;
    setVehicleId(activeVehicleId);
    if (!historyFilterReady.current) {
      historyFilterReady.current = true;
      if (savedVehicles.length > 1 && activeVehicleId) setHistoryVehicle(activeVehicleId);
    }
    setDescription(draft?.description || '');
    setDate(draft?.date || '');
    setKm(draft?.km || '');
    setCost(draft?.cost || '');
    setReminderOn(Boolean(draft?.reminderOn));
    setKmInterval(draft?.kmInterval || '');
    setMonthsInterval(draft?.monthsInterval || '');
    draftReady.current = true;
    setLoading(false);
  }

  const selectedVehicle = vehicles.find((item) => item.id === vehicleId) || null;

  async function selectVehicle(vehicle) {
    setVehicleId(vehicle.id);
    if (historyVehicle !== 'all') setHistoryVehicle(vehicle.id);
    await setSelectedVehicleId(vehicle.id);
    setVehiclePickerVisible(false);
  }

  async function saveLocation(coords) {
    await setStagingLocation(coords);
    setStagedLocation(coords);
    setModal(null);
  }

  async function savePhoto(uri) {
    await setStagingPhoto(uri);
    setStagedPhoto(uri);
    setModal(null);
  }

  function applySuggestion(text) {
    const suggestion = suggestionFor(text);
    if (!suggestion) return;
    setKmInterval(suggestion.km ? String(suggestion.km) : '');
    setMonthsInterval(suggestion.months ? String(suggestion.months) : '');
  }
  function pickService(label) {
    setDescription(label);
    if (reminderOn && !kmInterval && !monthsInterval) applySuggestion(label);
  }
  function toggleReminder(value) {
    setReminderOn(value);
    if (value && !kmInterval && !monthsInterval) applySuggestion(description);
  }
  function confirmAsync(title, message) {
    return new Promise((resolve) => Alert.alert(title, message, [
      { text: 'Revisar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Salvar assim mesmo', onPress: () => resolve(true) },
    ], { cancelable: false }));
  }

  async function handleAddRecord() {
    if (!selectedVehicle) {
      Alert.alert('Escolha um veículo', 'Cadastre um veículo na tela Início ou escolha um veículo da garagem antes de continuar.', [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Ir à garagem', onPress: () => navigation.navigate('Início') },
      ]);
      return;
    }
    if (!description.trim() || !date.trim()) {
      Alert.alert('Atenção', 'Preencha o serviço e a data.');
      return;
    }
    if (!isValidDate(date)) {
      Alert.alert('Data inválida', 'Informe uma data existente no formato DD/MM/AAAA.');
      return;
    }
    const kmValue = parseKm(km);
    const costValue = parseMoney(cost);
    if (cost.trim() && costValue === null) {
      Alert.alert('Valor inválido', 'Digite o valor pago, por exemplo 280,00.');
      return;
    }
    const kmIntervalValue = reminderOn ? parseKm(kmInterval) : null;
    const monthsIntervalValue = reminderOn ? parseKm(monthsInterval) : null;
    if (reminderOn && !kmIntervalValue && !monthsIntervalValue) {
      Alert.alert('Escolha o prazo do lembrete', 'Informe em quantos km ou meses lembrar, ou desligue o lembrete.');
      return;
    }
    if (kmIntervalValue && kmValue === null) {
      Alert.alert('Informe o km atual', 'Para lembrar por quilometragem, preencha o km atual do veículo.');
      return;
    }
    const vehicleRecords = records.filter((item) => item.vehicleId === selectedVehicle.id);
    const knownKm = getCurrentKm(selectedVehicle, vehicleRecords);
    if (kmValue !== null && knownKm !== null && kmValue < knownKm) {
      const proceed = await confirmAsync('Km menor que o último', `O último km registrado deste veículo foi ${formatKm(knownKm)}. Confira se ${formatKm(kmValue)} está certo.`);
      if (!proceed) return;
    }
    if (!stagedLocation || !stagedPhoto) {
      Alert.alert('Anexos obrigatórios', 'Registre a localização da oficina e fotografe o comprovante antes de salvar a manutenção.');
      return;
    }
    const record = {
      id: Date.now().toString(),
      vehicleId: selectedVehicle.id,
      vehicleName: selectedVehicle.name,
      vehicleYear: selectedVehicle.year || '',
      vehiclePlate: selectedVehicle.plate || '',
      vehicle: selectedVehicle.plate ? `${selectedVehicle.name} · ${selectedVehicle.plate}` : selectedVehicle.name,
      description: description.trim(),
      date: date.trim(),
      km: kmValue,
      cost: costValue,
      reminder: reminderOn ? buildReminder({ dateStr: date.trim(), km: kmValue, kmInterval: kmIntervalValue, monthsInterval: monthsIntervalValue }) : null,
      location: stagedLocation,
      photo: stagedPhoto,
    };
    setRecords(await addRecord(record));
    const savedReminder = record.reminder;
    setDescription('');
    setDate('');
    setKm('');
    setCost('');
    setReminderOn(false);
    setKmInterval('');
    setMonthsInterval('');
    await Promise.all([clearStagingLocation(), clearStagingPhoto(), clearMaintenanceDraft()]);
    draftReady.current = true;
    setStagedLocation(null);
    setStagedPhoto(null);
    Alert.alert('Salvo', savedReminder ? `Manutenção adicionada. Próximo aviso: ${describeNext(savedReminder)}.` : 'Manutenção adicionada ao histórico.');
  }

  function handleRemoveRecord(id) {
    Alert.alert('Excluir manutenção', 'Deseja excluir este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => setRecords(await removeRecord(id)) },
    ]);
  }

  const visibleRecords = filterRecords(records, vehicles, { vehicleId: historyVehicle, query: historyQuery });
  const filtering = historyVehicle !== 'all' || historyQuery.trim().length > 0;
  function clearHistoryFilters() { setHistoryVehicle('all'); setHistoryQuery(''); }

  const reminderPreview = reminderOn ? buildReminder({ dateStr: date, km: parseKm(km), kmInterval: parseKm(kmInterval), monthsInterval: parseKm(monthsInterval) }) : null;
  const needsKmForReminder = reminderOn && Boolean(parseKm(kmInterval)) && parseKm(km) === null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <FlatList
        data={visibleRecords}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <>
            <View style={styles.pageHeader}>
              <View style={{ flex: 1 }}><Text style={styles.pageKicker}>GARAGEM</Text><Text style={styles.title}>Manutenções</Text><Text style={styles.subtitle}>Seu histórico, sempre organizado.</Text></View>
              <View style={styles.pageIcon}><MaterialCommunityIcons name="wrench-outline" size={25} color={COLORS.green} /></View>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Nova manutenção</Text>
              <Text style={styles.fieldLabel}>Veículo</Text>
              <Pressable onPress={() => vehicles.length ? setVehiclePickerVisible(true) : navigation.navigate('Início')} style={({ pressed }) => [styles.vehicleSelect, pressed && { opacity: 0.8 }]}>
                <View style={styles.vehicleSelectIcon}><MaterialCommunityIcons name="car-outline" size={22} color={COLORS.green} /></View>
                <View style={styles.vehicleSelectCopy}><Text style={styles.vehicleSelectTitle}>{selectedVehicle?.name || 'Cadastre um veículo na garagem'}</Text><Text style={styles.vehicleSelectSub}>{selectedVehicle ? 'Toque para trocar o veículo' : 'Toque para ir à tela Início'}</Text></View>
                <MaterialCommunityIcons name="chevron-down" size={21} color={COLORS.muted} />
              </Pressable>
              <View style={styles.vehicleMetaRow}>
                <View style={styles.vehicleMetaCell}><Text style={styles.vehicleMetaLabel}>PLACA</Text><Text style={styles.vehicleMetaValue}>{selectedVehicle?.plate || 'Não cadastrada'}</Text></View>
                <View style={styles.vehicleMetaDivider} />
                <View style={styles.vehicleMetaCell}><Text style={styles.vehicleMetaLabel}>ANO</Text><Text style={styles.vehicleMetaValue}>{selectedVehicle?.year || 'Não informado'}</Text></View>
              </View>
              {selectedVehicle ? <Pressable onPress={() => navigation.navigate('Início')} style={styles.editVehicleLink}><MaterialCommunityIcons name="pencil-outline" size={15} color={COLORS.green} /><Text style={styles.editVehicleLinkText}>Editar placa ou ano na garagem</Text></Pressable> : null}
              <Field label="Serviço realizado" placeholder="Ex.: troca de óleo" value={description} onChangeText={setDescription} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chipRow}>
                {SERVICE_TYPES.map((type) => <Chip key={type.label} label={type.label} active={description.trim().toLowerCase() === type.label.toLowerCase()} onPress={() => pickService(type.label)} />)}
              </ScrollView>
              <Text style={styles.fieldLabel}>Data da manutenção</Text>
              <CalendarPicker value={date} onChange={setDate} />

              <View style={styles.twoCols}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Km atual (opcional)</Text>
                  <TextInput style={styles.input} value={km} onChangeText={(value) => setKm(formatKmInput(value))} keyboardType="number-pad" placeholder="Ex.: 45.200" placeholderTextColor={COLORS.muted} maxLength={9} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Valor pago (opcional)</Text>
                  <TextInput style={styles.input} value={cost} onChangeText={(value) => setCost(sanitizeMoneyInput(value))} keyboardType="decimal-pad" placeholder="R$ 0,00" placeholderTextColor={COLORS.muted} />
                </View>
              </View>

              <View style={[styles.reminderCard, reminderOn && styles.reminderCardOn]}>
                <View style={styles.reminderHead}>
                  <View style={styles.reminderIcon}><MaterialCommunityIcons name="bell-ring-outline" size={20} color={COLORS.green} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reminderTitle}>Lembrar próxima manutenção</Text>
                    <Text style={styles.reminderSub}>{reminderOn ? 'Escolha em quanto tempo ou km.' : 'Receba o aviso na tela Início.'}</Text>
                  </View>
                  <Switch value={reminderOn} onValueChange={toggleReminder} trackColor={{ false: COLORS.border, true: COLORS.green }} thumbColor="#fff" />
                </View>
                {reminderOn ? <>
                  <IntervalChips label="Por quilometragem" unit="km" options={[5000, 10000, 15000, 20000]} value={kmInterval} onChange={setKmInterval} />
                  <IntervalChips label="Por tempo" unit="meses" options={[3, 6, 12]} value={monthsInterval} onChange={setMonthsInterval} />
                  {needsKmForReminder ? <Text style={styles.reminderWarn}>Preencha o km atual acima para calcular o aviso por quilometragem.</Text> : null}
                  {reminderPreview && describeNext(reminderPreview) ? <View style={styles.reminderPreview}><MaterialCommunityIcons name="calendar-check-outline" size={16} color={COLORS.green} /><Text style={styles.reminderPreviewText}>Próximo aviso: {describeNext(reminderPreview)}</Text></View> : null}
                </> : null}
              </View>

              <Text style={styles.attachTitle}>Adicionar ao registro (obrigatório)</Text>
              <View style={styles.attachRow}>
                <AttachmentButton
                  icon="map-marker-radius-outline"
                  label={stagedLocation ? 'Local registrado' : 'Registrar local'}
                  active={Boolean(stagedLocation)}
                  onPress={() => setModal('location')}
                />
                <AttachmentButton
                  icon="receipt-text-outline"
                  label={stagedPhoto ? 'Foto registrada' : 'Foto comprovante'}
                  active={Boolean(stagedPhoto)}
                  onPress={() => setModal('camera')}
                />
              </View>

              <PrimaryButton title="Salvar manutenção" onPress={handleAddRecord} />
            </View>

            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Histórico</Text>
              <Text style={styles.historyCount}>{filtering ? `${visibleRecords.length} de ${records.length}` : records.length}</Text>
            </View>
            {records.length ? <>
              {vehicles.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chipRow}>
                <Chip label="Todos" active={historyVehicle === 'all'} onPress={() => setHistoryVehicle('all')} />
                {vehicles.map((vehicle) => <Chip key={vehicle.id} label={vehicle.name} active={historyVehicle === vehicle.id} onPress={() => setHistoryVehicle(vehicle.id)} />)}
              </ScrollView> : null}
              <View style={styles.searchBox}>
                <MaterialCommunityIcons name="magnify" size={20} color={COLORS.muted} />
                <TextInput style={styles.searchInput} value={historyQuery} onChangeText={setHistoryQuery} placeholder="Buscar serviço, placa ou data" placeholderTextColor={COLORS.muted} returnKeyType="search" autoCorrect={false} />
                {historyQuery ? <Pressable onPress={() => setHistoryQuery('')} hitSlop={10} accessibilityLabel="Limpar busca"><MaterialCommunityIcons name="close-circle" size={18} color={COLORS.muted} /></Pressable> : null}
              </View>
            </> : null}
          </>
        )}
        ListEmptyComponent={loading ? <CenteredMessage text="Carregando..." /> : records.length && filtering ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nenhum registro encontrado</Text>
            <Text style={styles.emptyText}>Nada combina com o filtro ou a busca atual.</Text>
            <Pressable onPress={clearHistoryFilters} style={styles.clearFilters}><Text style={styles.clearFiltersText}>Limpar filtros</Text></Pressable>
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nenhum registro ainda</Text>
            <Text style={styles.emptyText}>Preencha o formulário acima para começar.</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('RecordDetail', { record: item })}
            style={({ pressed }) => [styles.recordCard, pressed && { opacity: 0.75 }]}
          >
            {item.photo ? <Image source={{ uri: item.photo }} style={styles.thumb} /> : <View style={styles.thumbEmpty}><Text style={styles.thumbEmptyText}>✓</Text></View>}
            <View style={styles.recordBody}>
              <Text style={styles.recordTitle} numberOfLines={1}>{item.description}</Text>
              <Text style={styles.recordMeta}>{item.vehicleName || item.vehicle || 'Veículo não informado'}{item.vehiclePlate ? ` · ${item.vehiclePlate}` : ''}{item.vehicleYear ? ` · ${item.vehicleYear}` : ''} • {item.date}</Text>
              {item.km !== null && item.km !== undefined || item.cost !== null && item.cost !== undefined ? <Text style={styles.recordExtra}>{[item.km !== null && item.km !== undefined ? `${formatKm(item.km)} km` : null, item.cost !== null && item.cost !== undefined ? formatMoney(item.cost) : null].filter(Boolean).join(' · ')}</Text> : null}
              <Text style={[styles.recordStatus, { color: getRecordStatus(item).color }]}>{getRecordStatusText(item)}</Text>
            </View>
            <Pressable onPress={() => handleRemoveRecord(item.id)} style={styles.deleteButton} accessibilityLabel="Excluir registro">
              <Text style={styles.deleteText}>×</Text>
            </Pressable>
          </Pressable>
        )}
      />

      <CameraModal visible={modal === 'camera'} onClose={() => setModal(null)} onSaved={savePhoto} />
      <LocationModal visible={modal === 'location'} onClose={() => setModal(null)} onSaved={saveLocation} />
      <VehicleSelectModal visible={vehiclePickerVisible} vehicles={vehicles} selectedId={vehicleId} onClose={() => setVehiclePickerVisible(false)} onSelect={selectVehicle} />
    </SafeAreaView>
  );
}

function Field({ label, ...props }) {
  return <View><Text style={styles.fieldLabel}>{label}</Text><TextInput style={styles.input} placeholderTextColor={COLORS.muted} {...props} /></View>;
}

function Chip({ label, active, onPress }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.75 }]} accessibilityRole="button"><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function IntervalChips({ label, unit, options, value, onChange }) {
  const [customMode, setCustomMode] = useState(false);
  const numeric = value ? Number(value) : null;
  const isCustom = Boolean(value) && !options.includes(numeric);
  const showCustom = customMode || isCustom;
  return <View style={styles.intervalBlock}>
    <Text style={styles.intervalLabel}>{label}</Text>
    <View style={styles.intervalRow}>
      {options.map((option) => <Chip key={option} label={unit === 'km' ? `${formatKm(option)} km` : `${option} meses`} active={!showCustom && numeric === option} onPress={() => { setCustomMode(false); onChange(String(option)); }} />)}
      <Chip label="Outro" active={showCustom} onPress={() => { setCustomMode(true); if (options.includes(numeric)) onChange(''); }} />
      <Chip label="Nenhum" active={!showCustom && !value} onPress={() => { setCustomMode(false); onChange(''); }} />
    </View>
    {showCustom ? <TextInput style={[styles.input, { marginTop: 8 }]} value={value} onChangeText={(text) => onChange(onlyDigits(text).slice(0, 6))} keyboardType="number-pad" placeholder={unit === 'km' ? 'Quantos km? Ex.: 8000' : 'Quantos meses? Ex.: 4'} placeholderTextColor={COLORS.muted} /> : null}
  </View>;
}

function VehicleSelectModal({ visible, vehicles, selectedId, onClose, onSelect }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.vehicleModalOverlay}>
        <View style={styles.vehicleModalCard}>
          <View style={styles.vehicleModalHeader}>
            <View><Text style={styles.vehicleModalKicker}>MINHA GARAGEM</Text><Text style={styles.vehicleModalTitle}>Escolha o veículo</Text></View>
            <Pressable onPress={onClose} style={styles.vehicleModalClose}><MaterialCommunityIcons name="close" size={21} color={COLORS.muted} /></Pressable>
          </View>
          {vehicles.map((vehicle) => <Pressable key={vehicle.id} onPress={() => onSelect(vehicle)} style={[styles.vehicleOption, vehicle.id === selectedId && styles.vehicleOptionSelected]}>
            <View style={[styles.vehicleOptionIcon, vehicle.id === selectedId && styles.vehicleOptionIconSelected]}><MaterialCommunityIcons name="car-sports" size={23} color={vehicle.id === selectedId ? '#fff' : COLORS.green} /></View>
            <View style={{ flex: 1 }}><Text style={styles.vehicleOptionName}>{vehicle.name}</Text><Text style={styles.vehicleOptionPlate}>{vehicle.plate || 'Placa por atualizar'}{vehicle.year ? ` · ${vehicle.year}` : ''}</Text></View>
            <MaterialCommunityIcons name={vehicle.id === selectedId ? 'check-circle' : 'circle-outline'} size={21} color={vehicle.id === selectedId ? COLORS.green : COLORS.muted} />
          </Pressable>)}
        </View>
      </View>
    </Modal>
  );
}

function isValidDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 1900 || year > new Date().getFullYear()) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function AttachmentButton({ icon, label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.attachment, active && styles.attachmentActive, pressed && { opacity: 0.7 }]}>
      <MaterialCommunityIcons name={icon} size={24} color={active ? COLORS.green : COLORS.blue} />
      <Text style={[styles.attachmentLabel, active && { color: COLORS.green }]}>{label}</Text>
    </Pressable>
  );
}

function CameraModal({ visible, onClose, onSaved }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [cameraRef, setCameraRef] = useState(null);

  async function takePicture() {
    if (!cameraRef) return;
    const result = await cameraRef.takePictureAsync({ quality: 0.8 });
    if (result?.uri) onSaved(result.uri);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalScreen}>
        <ModalHeader title="Foto do comprovante" onClose={onClose} />
        {!permission ? <CenteredMessage text="Verificando câmera..." /> : !permission.granted ? (
          <View style={styles.permission}><Text style={styles.permissionText}>Permita a câmera para fotografar o comprovante.</Text><PrimaryButton title="Permitir câmera" onPress={requestPermission} /></View>
        ) : (
          <>
            <CameraView ref={setCameraRef} style={styles.camera} facing={facing} mode="picture" />
            <View style={styles.modalActions}><PrimaryButton title="Inverter" variant="secondary" onPress={() => setFacing(facing === 'back' ? 'front' : 'back')} /><PrimaryButton title="Fotografar" onPress={takePicture} /></View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function LocationModal({ visible, onClose, onSaved }) {
  const [message, setMessage] = useState('Use o GPS para registrar o local da oficina.');
  const [loading, setLoading] = useState(false);
  const [pendingLocation, setPendingLocation] = useState(null);
  const [pendingAddress, setPendingAddress] = useState('');

  function closeModal() {
    setPendingLocation(null);
    setPendingAddress('');
    setLoading(false);
    setMessage('Use o GPS para registrar o local da oficina.');
    onClose();
  }

  function confirmLocation() {
    if (!pendingLocation) return;
    onSaved(pendingLocation);
    setPendingLocation(null);
    setPendingAddress('');
  }

  async function captureLocation() {
    setLoading(true);
    setMessage('Obtendo localização...');
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      setMessage('Permissão de localização negada.');
      setLoading(false);
      return;
    }
    try {
      const result = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
      ]);
      setPendingLocation(result.coords);
      try {
        const places = await Location.reverseGeocodeAsync(result.coords);
        const place = places?.[0];
        const address = [place?.street, place?.name !== place?.street ? place?.name : null, place?.district, place?.city, place?.region].filter(Boolean).join(', ');
        setPendingAddress(address || 'Endereço não identificado pelo aparelho');
      } catch {
        setPendingAddress('Endereço não identificado pelo aparelho');
      }
      setMessage('Localização encontrada. Confira o endereço antes de confirmar.');
      setLoading(false);
    } catch {
      setMessage('O GPS demorou para responder. Verifique se a localização do celular está ativada e tente novamente.');
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={closeModal}>
      <SafeAreaView style={styles.modalScreen}>
        <ModalHeader title="Registrar local" onClose={closeModal} />
        <View style={styles.locationModalBody}>
          <View style={styles.locationIcon}><Text style={styles.locationIconText}>⌖</Text></View>
          <Text style={styles.locationTitle}>Local da oficina</Text>
          <Text style={styles.locationMessage}>{message}</Text>
          {pendingLocation ? <View style={styles.locationPreview}><Text style={styles.previewTitle}>Local encontrado</Text><Text style={styles.previewHint}>Confira visualmente o endereço antes de confirmar:</Text><View style={styles.addressCard}><Text style={styles.addressPin}>⌖</Text><Text style={styles.previewAddress}>{pendingAddress || 'Identificando endereço...'}</Text></View><Pressable style={styles.previewMapButton} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${pendingLocation.latitude},${pendingLocation.longitude}`)}><Text style={styles.previewMapText}>Ver este ponto no Google Maps ↗</Text></Pressable><PrimaryButton title="Confirmar este local" onPress={confirmLocation} /><PrimaryButton title="Obter novamente" variant="secondary" onPress={() => { setPendingLocation(null); setPendingAddress(''); captureLocation(); }} /></View> : <PrimaryButton title={loading ? 'Obtendo (até 10s)...' : 'Usar localização atual'} onPress={captureLocation} disabled={loading} />}
          <Text style={styles.locationHint}>{pendingLocation ? 'O local só será salvo depois que você confirmar.' : 'Depois de encontrar o GPS, você poderá conferir o ponto antes de salvar.'}</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function ModalHeader({ title, onClose }) {
  return <View style={styles.modalHeader}><Text style={styles.modalTitle}>{title}</Text><Pressable onPress={onClose} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable></View>;
}

const styles = StyleSheet.create({
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13, paddingHorizontal: 12, marginTop: 10, marginBottom: 12 },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 13, paddingVertical: 0 },
  clearFilters: { marginTop: 12, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, backgroundColor: COLORS.paleBlue },
  clearFiltersText: { color: COLORS.green, fontSize: 12, fontWeight: '900' },
  twoCols: { flexDirection: 'row', gap: 10 },
  chipRow: { gap: 7, paddingTop: 8, paddingBottom: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg },
  chipActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  chipText: { color: COLORS.text, fontSize: 11, fontWeight: '800' },
  chipTextActive: { color: '#fff' },
  reminderCard: { marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, padding: 12 },
  reminderCardOn: { backgroundColor: COLORS.paleBlue, borderColor: '#B9E1D0' },
  reminderHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reminderIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center' },
  reminderTitle: { color: COLORS.text, fontSize: 13, fontWeight: '900' },
  reminderSub: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  intervalBlock: { marginTop: 12 },
  intervalLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '800', marginBottom: 6 },
  intervalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reminderWarn: { color: COLORS.amber, fontSize: 11, fontWeight: '800', marginTop: 10, lineHeight: 16 },
  reminderPreview: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: COLORS.card, borderRadius: 11, padding: 10, marginTop: 12 },
  reminderPreviewText: { color: COLORS.green, fontSize: 12, fontWeight: '900', flex: 1 },
  recordExtra: { color: COLORS.text, fontSize: 11, fontWeight: '800', marginTop: 4 },
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingBottom: 35 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 16 },
  pageKicker: { color: COLORS.amber, fontSize: 9, fontWeight: '900', letterSpacing: 1.6 },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '900', marginTop: 3 },
  subtitle: { color: COLORS.muted, fontSize: 13, marginTop: 4 },
  pageIcon: { width: 50, height: 50, borderRadius: 17, backgroundColor: COLORS.paleBlue, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  formCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.card, padding: 18, borderWidth: 1, borderColor: COLORS.border, ...SHADOW },
  formTitle: { color: COLORS.text, fontSize: 20, fontWeight: '900', marginBottom: 12 },
  fieldLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '800', marginTop: 9, marginBottom: 6 },
  input: { height: 48, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 13, color: COLORS.text, fontSize: 14 },
  vehicleSelect: { minHeight: 62, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8 },
  vehicleSelectIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paleBlue },
  vehicleSelectCopy: { flex: 1, marginHorizontal: 10 }, vehicleSelectTitle: { color: COLORS.text, fontSize: 13, fontWeight: '900' }, vehicleSelectSub: { color: COLORS.muted, fontSize: 10, marginTop: 3 },
  vehicleMetaRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13, paddingVertical: 10, paddingHorizontal: 12, marginTop: 8 },
  vehicleMetaCell: { flex: 1 }, vehicleMetaLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }, vehicleMetaValue: { color: COLORS.text, fontSize: 12, fontWeight: '900', marginTop: 3 }, vehicleMetaDivider: { width: 1, height: 30, backgroundColor: COLORS.border, marginHorizontal: 13 },
  editVehicleLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5, paddingVertical: 8 }, editVehicleLinkText: { color: COLORS.green, fontSize: 11, fontWeight: '900' },
  vehicleModalOverlay: { flex: 1, backgroundColor: 'rgba(7,31,27,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  vehicleModalCard: { width: '100%', maxWidth: 440, borderRadius: 22, backgroundColor: COLORS.bg, padding: 18, borderWidth: 1, borderColor: COLORS.border },
  vehicleModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, vehicleModalKicker: { color: COLORS.green, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }, vehicleModalTitle: { color: COLORS.text, fontSize: 21, fontWeight: '900', marginTop: 3 }, vehicleModalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center' },
  vehicleOption: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, marginTop: 8 }, vehicleOptionSelected: { borderColor: COLORS.green, backgroundColor: COLORS.paleBlue }, vehicleOptionIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.paleBlue, alignItems: 'center', justifyContent: 'center' }, vehicleOptionIconSelected: { backgroundColor: COLORS.green }, vehicleOptionName: { color: COLORS.text, fontSize: 13, fontWeight: '900' }, vehicleOptionPlate: { color: COLORS.muted, fontSize: 10, marginTop: 3 },
  attachTitle: { color: COLORS.text, fontSize: 13, fontWeight: '900', marginTop: 18, marginBottom: 8 },
  attachRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  attachment: { flex: 1, minHeight: 58, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, borderRadius: 12, paddingHorizontal: 11 },
  attachmentActive: { backgroundColor: '#E8F6F0', borderColor: '#B9E1D0' },
  attachmentIcon: { color: COLORS.blue, fontSize: 21, marginRight: 8 },
  attachmentLabel: { color: COLORS.text, fontSize: 11, fontWeight: '900', flex: 1 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 10 },
  historyTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900' },
  historyCount: { color: COLORS.muted, fontSize: 13, fontWeight: '800' },
  empty: { backgroundColor: COLORS.card, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, padding: 20, alignItems: 'center' },
  emptyTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900' },
  emptyText: { color: COLORS.muted, fontSize: 13, marginTop: 5 },
  recordCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, padding: 11, marginBottom: 9 },
  thumb: { width: 54, height: 54, borderRadius: 11, marginRight: 10 },
  thumbEmpty: { width: 54, height: 54, borderRadius: 11, marginRight: 10, backgroundColor: COLORS.paleBlue, alignItems: 'center', justifyContent: 'center' },
  thumbEmptyText: { color: COLORS.blue, fontSize: 22, fontWeight: '900' },
  recordBody: { flex: 1 },
  recordTitle: { color: COLORS.text, fontSize: 15, fontWeight: '900' },
  recordMeta: { color: COLORS.muted, fontSize: 11, marginTop: 4 },
  recordStatus: { fontSize: 11, fontWeight: '800', marginTop: 5 },
  deleteButton: { padding: 8 },
  deleteText: { color: COLORS.red, fontSize: 23 },
  modalScreen: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { color: COLORS.text, fontSize: 21, fontWeight: '900' },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  closeText: { color: COLORS.text, fontSize: 25, lineHeight: 27 },
  camera: { flex: 1, borderRadius: RADIUS.card, overflow: 'hidden', backgroundColor: '#10202A' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  permission: { flex: 1, justifyContent: 'center' },
  permissionText: { color: COLORS.muted, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  locationModalBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  locationIcon: { width: 82, height: 82, borderRadius: 41, backgroundColor: COLORS.paleBlue, alignItems: 'center', justifyContent: 'center' },
  locationIconText: { color: COLORS.blue, fontSize: 42 },
  locationTitle: { color: COLORS.text, fontSize: 22, fontWeight: '900', marginTop: 18 },
  locationMessage: { color: COLORS.muted, textAlign: 'center', lineHeight: 21, marginVertical: 10 },
  locationPreview: { width: '100%', backgroundColor: COLORS.card, borderWidth: 1, borderColor: '#B9E1D0', borderRadius: 15, padding: 15, marginTop: 5 },
  previewTitle: { color: COLORS.green, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  previewHint: { color: COLORS.muted, fontSize: 12, textAlign: 'center', marginTop: 5, marginBottom: 10 },
  addressCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.paleBlue, borderRadius: 12, padding: 11, marginBottom: 9 },
  addressPin: { color: COLORS.blue, fontSize: 25, marginRight: 9 },
  previewAddress: { color: COLORS.text, fontSize: 13, fontWeight: '800', lineHeight: 19, flex: 1 },
  previewMapButton: { alignItems: 'center', paddingVertical: 8, marginBottom: 5 },
  previewMapText: { color: COLORS.blue, fontSize: 12, fontWeight: '900', textDecorationLine: 'underline' },
  locationHint: { color: COLORS.muted, fontSize: 12, textAlign: 'center' },
});
