import React, { useState } from 'react';
import { Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW, getRecordStatus, getRecordStatusText } from '../theme';
import { updateRecord } from '../storage';
import PrimaryButton from '../components/PrimaryButton';
import { describeNext, formatKm, formatMoney } from '../maintenanceUtils';

export default function RecordDetailScreen({ route }) {
  const [record, setRecord] = useState(route.params.record);
  const [modal, setModal] = useState(null);
  const status = getRecordStatus(record);
  const vehicleName = record.vehicleName || record.vehicle || 'Veículo não informado';
  const vehiclePlate = record.vehiclePlate || '';
  const vehicleYear = record.vehicleYear || '';
  const hasKm = record.km !== null && record.km !== undefined;
  const hasCost = record.cost !== null && record.cost !== undefined;

  async function saveChanges(changes) {
    const updated = { ...record, ...changes };
    await updateRecord(record.id, changes);
    setRecord(updated);
    setModal(null);
  }
  async function openInMaps() {
    if (!record.location) return;
    const { latitude, longitude } = record.location;
    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
  }

  return <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroTop}><View style={styles.heroIcon}><MaterialCommunityIcons name="car-wrench" size={24} color={COLORS.mint} /></View><View style={[styles.statusPill, { backgroundColor: status.background }]}><View style={[styles.statusDot, { backgroundColor: status.color }]} /><Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text></View></View>
        <Text style={styles.eyebrow}>REGISTO DE MANUTENÇÃO</Text>
        <Text style={styles.title}>{record.description}</Text>
        <View style={styles.heroMeta}><MaterialCommunityIcons name="calendar-month-outline" size={16} color={COLORS.mint} /><Text style={styles.heroDate}>{record.date}</Text></View>
      </View>

      <View style={styles.vehicleCard}>
        <View style={styles.vehicleIcon}><MaterialCommunityIcons name="car-sports" size={26} color={COLORS.ink} /></View>
        <View style={styles.vehicleCopy}><Text style={styles.cardEyebrow}>VEÍCULO</Text><Text style={styles.vehicleName}>{vehicleName}</Text><Text style={styles.vehiclePlate}>{vehiclePlate || 'Placa não cadastrada'} · {vehicleYear ? `Ano ${vehicleYear}` : 'Ano não informado'}</Text></View>
        <MaterialCommunityIcons name="check-decagram-outline" size={21} color={COLORS.green} />
      </View>

      {hasKm || hasCost || record.reminder ? <View style={styles.infoCard}>
        {hasKm || hasCost ? <View style={styles.infoRow}>
          {hasKm ? <View style={styles.infoItem}><MaterialCommunityIcons name="speedometer" size={20} color={COLORS.green} /><Text style={styles.infoLabel}>QUILOMETRAGEM</Text><Text style={styles.infoValue}>{formatKm(record.km)} km</Text></View> : null}
          {hasKm && hasCost ? <View style={styles.infoDivider} /> : null}
          {hasCost ? <View style={styles.infoItem}><MaterialCommunityIcons name="cash" size={20} color={COLORS.green} /><Text style={styles.infoLabel}>VALOR PAGO</Text><Text style={styles.infoValue}>{formatMoney(record.cost)}</Text></View> : null}
        </View> : null}
        {record.reminder ? <View style={[styles.infoReminder, hasKm || hasCost ? { marginTop: 12 } : null]}><MaterialCommunityIcons name="bell-ring-outline" size={18} color={COLORS.green} /><View style={{ flex: 1 }}><Text style={styles.infoReminderTitle}>Próxima manutenção</Text><Text style={styles.infoReminderText}>{describeNext(record.reminder)}</Text></View></View> : null}
      </View> : null}

      <View style={styles.sectionHeader}><View style={styles.sectionIcon}><MaterialCommunityIcons name="receipt-text-outline" size={19} color={COLORS.green} /></View><View style={{ flex: 1 }}><Text style={styles.sectionTitle}>Comprovativo</Text><Text style={styles.sectionSubtitle}>Documento associado a este serviço</Text></View></View>
      <View style={styles.card}>
        {record.photo ? <Image source={{ uri: record.photo }} style={styles.photo} /> : <Placeholder icon="image-off-outline" text="Ainda não foi anexado um comprovativo." />}
        <PrimaryButton title={record.photo ? 'Atualizar comprovativo' : 'Adicionar comprovativo'} variant="secondary" onPress={() => setModal('photo')} />
      </View>

      <View style={styles.sectionHeader}><View style={styles.sectionIcon}><MaterialCommunityIcons name="map-marker-radius-outline" size={19} color={COLORS.green} /></View><View style={{ flex: 1 }}><Text style={styles.sectionTitle}>Local da oficina</Text><Text style={styles.sectionSubtitle}>Ponto onde o serviço foi realizado</Text></View></View>
      <View style={styles.card}>
        {record.location ? <>
          <View style={styles.locationRow}><View style={styles.locationCheck}><MaterialCommunityIcons name="check" size={18} color={COLORS.green} /></View><View style={{ flex: 1 }}><Text style={styles.locationTitle}>Local registado</Text><Text style={styles.locationDescription}>A localização GPS foi guardada neste registo.</Text></View></View>
          <View style={styles.coordinateBox}><Text style={styles.coordinateLabel}>COORDENADAS</Text><Text style={styles.coordinates}>{record.location.latitude.toFixed(6)}  ·  {record.location.longitude.toFixed(6)}</Text></View>
          <Pressable onPress={openInMaps} style={styles.mapButton}><MaterialCommunityIcons name="map-outline" size={20} color={COLORS.green} /><Text style={styles.mapButtonText}>Abrir no Google Maps</Text><MaterialCommunityIcons name="open-in-new" size={16} color={COLORS.green} /></Pressable>
        </> : <Placeholder icon="map-marker-off-outline" text="Ainda não foi guardada uma localização." />}
        <PrimaryButton title={record.location ? 'Atualizar localização' : 'Adicionar localização'} variant="secondary" onPress={() => setModal('location')} />
      </View>
      <View style={styles.completionNote}><MaterialCommunityIcons name={status.label === 'Completo' ? 'check-circle-outline' : 'progress-clock'} size={19} color={status.color} /><Text style={[styles.completionText, { color: status.color }]}>{getRecordStatusText(record)}</Text></View>
    </ScrollView>
    <PhotoModal visible={modal === 'photo'} onClose={() => setModal(null)} onSaved={(uri) => saveChanges({ photo: uri })} />
    <LocationModal visible={modal === 'location'} onClose={() => setModal(null)} onSaved={(coords) => saveChanges({ location: coords })} />
  </SafeAreaView>;
}

function Placeholder({ icon, text }) { return <View style={styles.placeholder}><MaterialCommunityIcons name={icon} size={26} color={COLORS.muted} /><Text style={styles.placeholderText}>{text}</Text></View>; }
function PhotoModal({ visible, onClose, onSaved }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [ref, setRef] = useState(null);
  const [facing, setFacing] = useState('back');
  async function take() { if (!ref) return; const result = await ref.takePictureAsync({ quality: 0.8 }); if (result?.uri) onSaved(result.uri); }
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><SafeAreaView style={styles.modal}><ModalHeader title="Atualizar comprovativo" onClose={onClose} />{!permission ? <Text style={styles.modalHint}>A verificar a câmara…</Text> : !permission.granted ? <View style={styles.permission}><Text style={styles.modalHint}>Permita o acesso à câmara para fotografar o comprovativo.</Text><PrimaryButton title="Permitir câmara" onPress={requestPermission} /></View> : <><CameraView ref={setRef} style={styles.camera} facing={facing} mode="picture" /><View style={styles.modalActions}><PrimaryButton title="Inverter" variant="secondary" onPress={() => setFacing(facing === 'back' ? 'front' : 'back')} /><PrimaryButton title="Fotografar" onPress={take} /></View></>}</SafeAreaView></Modal>;
}
function LocationModal({ visible, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  async function capture() {
    setLoading(true);
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') { Alert.alert('Permissão negada', 'Permita a localização para alterar o local.'); setLoading(false); return; }
    try { const result = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))]); onSaved(result.coords); }
    catch { Alert.alert('GPS indisponível', 'Não foi possível obter o GPS. Verifique se a localização está ligada e tente novamente.'); setLoading(false); }
  }
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><SafeAreaView style={styles.modal}><ModalHeader title="Local da oficina" onClose={onClose} /><View style={styles.locationModalBody}><View style={styles.locationModalIcon}><MaterialCommunityIcons name="map-marker-radius-outline" size={38} color={COLORS.green} /></View><Text style={styles.locationModalTitle}>Registar localização</Text><Text style={styles.modalHint}>Vamos guardar o ponto GPS atual associado a esta manutenção.</Text><PrimaryButton title={loading ? 'A obter localização…' : 'Usar localização atual'} onPress={capture} disabled={loading} /></View></SafeAreaView></Modal>;
}
function ModalHeader({ title, onClose }) { return <View style={styles.modalHeader}><Text style={styles.modalTitle}>{title}</Text><Pressable onPress={onClose} style={styles.close}><MaterialCommunityIcons name="close" size={21} color={COLORS.text} /></Pressable></View>; }

const styles = StyleSheet.create({
  infoCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, padding: 14, marginTop: 14, ...SHADOW },
  infoRow: { flexDirection: 'row', alignItems: 'stretch' },
  infoItem: { flex: 1, alignItems: 'center', gap: 4 },
  infoLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  infoValue: { color: COLORS.text, fontSize: 17, fontWeight: '900' },
  infoDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 2 },
  infoReminder: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.paleBlue, borderRadius: 12, padding: 11 },
  infoReminderTitle: { color: COLORS.muted, fontSize: 10, fontWeight: '900' },
  infoReminderText: { color: COLORS.green, fontSize: 13, fontWeight: '900', marginTop: 2 },
  screen: { flex: 1, backgroundColor: COLORS.bg }, content: { padding: 20, paddingBottom: 35 },
  hero: { backgroundColor: COLORS.navyDeep, borderRadius: 24, padding: 20, marginTop: 6, ...SHADOW }, heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, heroIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#1B4336', alignItems: 'center', justifyContent: 'center' }, statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }, statusDot: { width: 6, height: 6, borderRadius: 3 }, statusLabel: { fontSize: 10, fontWeight: '900' }, eyebrow: { color: COLORS.mint, fontSize: 9, fontWeight: '900', letterSpacing: 1.6, marginTop: 19 }, title: { color: '#fff', fontSize: 25, lineHeight: 30, fontWeight: '900', marginTop: 5 }, heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }, heroDate: { color: '#E4EEE8', fontSize: 12, fontWeight: '700' },
  vehicleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 13, marginTop: 13, ...SHADOW }, vehicleIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#DDF5E8', alignItems: 'center', justifyContent: 'center' }, vehicleCopy: { flex: 1, marginLeft: 11 }, cardEyebrow: { color: COLORS.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, vehicleName: { color: COLORS.text, fontSize: 14, fontWeight: '900', marginTop: 2 }, vehiclePlate: { color: COLORS.green, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 10 }, sectionIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: COLORS.paleBlue, alignItems: 'center', justifyContent: 'center' }, sectionTitle: { color: COLORS.text, fontSize: 15, fontWeight: '900' }, sectionSubtitle: { color: COLORS.muted, fontSize: 10, marginTop: 2 }, card: { backgroundColor: COLORS.card, borderRadius: 19, borderWidth: 1, borderColor: COLORS.border, padding: 13, ...SHADOW }, photo: { width: '100%', height: 265, borderRadius: 14, backgroundColor: COLORS.navyDeep, marginBottom: 12 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, locationCheck: { width: 38, height: 38, borderRadius: 13, backgroundColor: COLORS.paleBlue, alignItems: 'center', justifyContent: 'center' }, locationTitle: { color: COLORS.text, fontSize: 13, fontWeight: '900' }, locationDescription: { color: COLORS.muted, fontSize: 10, marginTop: 3 }, coordinateBox: { backgroundColor: COLORS.bg, borderRadius: 13, padding: 11, marginTop: 12 }, coordinateLabel: { color: COLORS.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, coordinates: { color: COLORS.text, fontSize: 12, fontWeight: '800', marginTop: 4 }, mapButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.paleBlue, borderRadius: 13, padding: 12, marginTop: 9, marginBottom: 12 }, mapButtonText: { flex: 1, color: COLORS.green, fontSize: 11, fontWeight: '900' }, placeholder: { minHeight: 88, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg, borderRadius: 14, padding: 15, marginBottom: 12 }, placeholderText: { color: COLORS.muted, fontSize: 11, textAlign: 'center', lineHeight: 17, marginTop: 5 }, completionNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14 }, completionText: { fontSize: 11, fontWeight: '800' },
  modal: { flex: 1, backgroundColor: COLORS.bg, padding: 20 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }, modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: '900' }, close: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border }, modalHint: { color: COLORS.muted, fontSize: 13, textAlign: 'center', lineHeight: 20, marginVertical: 10 }, camera: { flex: 1, borderRadius: RADIUS.card, overflow: 'hidden', backgroundColor: '#10202A' }, modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 }, permission: { flex: 1, justifyContent: 'center' }, locationModalBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }, locationModalIcon: { width: 76, height: 76, borderRadius: 25, backgroundColor: COLORS.paleBlue, alignItems: 'center', justifyContent: 'center' }, locationModalTitle: { color: COLORS.text, fontSize: 21, fontWeight: '900', marginTop: 15 },
});
