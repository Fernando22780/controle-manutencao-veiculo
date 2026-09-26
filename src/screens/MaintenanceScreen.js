import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { COLORS, RADIUS, SHADOW, getRecordStatus, getRecordStatusText } from '../theme';
import PrimaryButton from '../components/PrimaryButton';
import CenteredMessage from '../components/CenteredMessage';
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
} from '../storage';

export default function MaintenanceScreen({ navigation }) {
  const [vehicle, setVehicle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stagedLocation, setStagedLocation] = useState(null);
  const [stagedPhoto, setStagedPhoto] = useState(null);
  const [modal, setModal] = useState(null);
  const draftReady = useRef(false);

  useEffect(() => {
    getMaintenanceDraft().then((draft) => {
      if (draft) {
        setVehicle(draft.vehicle || '');
        setDescription(draft.description || '');
        setDate(draft.date || '');
      }
      draftReady.current = true;
    });
  }, []);

  useEffect(() => {
    if (!draftReady.current) return;
    saveMaintenanceDraft({ vehicle, description, date });
  }, [vehicle, description, date]);

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    setLoading(true);
    const [savedRecords, location, photo] = await Promise.all([
      getRecords(),
      getStagingLocation(),
      getStagingPhoto(),
    ]);
    setRecords(savedRecords);
    setStagedLocation(location);
    setStagedPhoto(photo);
    setLoading(false);
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

  async function handleAddRecord() {
    if (!description.trim() || !date.trim()) {
      Alert.alert('Atenção', 'Preencha o serviço e a data.');
      return;
    }
    if (!isValidDate(date)) {
      Alert.alert('Data inválida', 'Informe uma data existente no formato DD/MM/AAAA.');
      return;
    }
    if (!stagedLocation || !stagedPhoto) {
      Alert.alert('Anexos obrigatórios', 'Registre a localização da oficina e fotografe o comprovante antes de salvar a manutenção.');
      return;
    }
    const record = {
      id: Date.now().toString(),
      vehicle: vehicle.trim(),
      description: description.trim(),
      date: date.trim(),
      location: stagedLocation,
      photo: stagedPhoto,
    };
    setRecords(await addRecord(record));
    setVehicle('');
    setDescription('');
    setDate('');
    await Promise.all([clearStagingLocation(), clearStagingPhoto(), clearMaintenanceDraft()]);
    draftReady.current = true;
    setStagedLocation(null);
    setStagedPhoto(null);
    Alert.alert('Salvo', 'Manutenção adicionada ao histórico.');
  }

  function handleRemoveRecord(id) {
    Alert.alert('Excluir manutenção', 'Deseja excluir este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => setRecords(await removeRecord(id)) },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <>
            <Text style={styles.title}>Manutenções</Text>
            <Text style={styles.subtitle}>Cadastre tudo em uma única tela.</Text>

            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Nova manutenção</Text>
              <Field label="Veículo (opcional)" placeholder="Ex.: Fiat Argo - ABC1D23" value={vehicle} onChangeText={setVehicle} />
              <Field label="Serviço realizado" placeholder="Ex.: troca de óleo" value={description} onChangeText={setDescription} />
              <Field label="Data" placeholder="DD/MM/AAAA" value={date} onChangeText={(value) => setDate(formatDate(value))} keyboardType="numeric" maxLength={10} />

              <Text style={styles.attachTitle}>Adicionar ao registro (obrigatório)</Text>
              <View style={styles.attachRow}>
                <AttachmentButton
                  icon="⌖"
                  label={stagedLocation ? 'Local registrado' : 'Registrar local'}
                  active={Boolean(stagedLocation)}
                  onPress={() => setModal('location')}
                />
                <AttachmentButton
                  icon="▣"
                  label={stagedPhoto ? 'Foto registrada' : 'Foto comprovante'}
                  active={Boolean(stagedPhoto)}
                  onPress={() => setModal('camera')}
                />
              </View>

              <PrimaryButton title="Salvar manutenção" onPress={handleAddRecord} />
            </View>

            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Histórico</Text>
              <Text style={styles.historyCount}>{records.length}</Text>
            </View>
          </>
        )}
        ListEmptyComponent={loading ? <CenteredMessage text="Carregando..." /> : (
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
              <Text style={styles.recordMeta}>{item.vehicle || 'Veículo não informado'} • {item.date}</Text>
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
    </SafeAreaView>
  );
}

function Field({ label, ...props }) {
  return <View><Text style={styles.fieldLabel}>{label}</Text><TextInput style={styles.input} placeholderTextColor={COLORS.muted} {...props} /></View>;
}

function formatDate(value) {
  const numbers = value.replace(/\D/g, '').slice(0, 8);
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4)}`;
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
      <Text style={[styles.attachmentIcon, active && { color: COLORS.green }]}>{icon}</Text>
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
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingBottom: 35 },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '900', marginTop: 10 },
  subtitle: { color: COLORS.muted, fontSize: 14, marginTop: 5, marginBottom: 18 },
  formCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.card, padding: 18, borderWidth: 1, borderColor: COLORS.border, ...SHADOW },
  formTitle: { color: COLORS.text, fontSize: 20, fontWeight: '900', marginBottom: 12 },
  fieldLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '800', marginTop: 9, marginBottom: 6 },
  input: { height: 48, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 13, color: COLORS.text, fontSize: 14 },
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
