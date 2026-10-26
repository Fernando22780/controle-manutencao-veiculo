import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW, getCompletionCount, getGreeting, getPendingCount, getRecordStatus, getRecordStatusText } from '../theme';
import PrimaryButton from '../components/PrimaryButton';
import { addVehicle, getRecords, getSelectedVehicleId, getVehicles, setSelectedVehicleId, setVehicleKm, updateVehicle } from '../storage';
import { formatKm, formatKmInput, formatMoney, getCurrentKm, getUpcoming, parseKm, sumCost, sumCostMonth } from '../maintenanceUtils';
import { shareVehicleReport } from '../report';

export default function HomeScreen({ navigation, user }) {
  const [records, setRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedId] = useState(null);
  const [vehicleModal, setVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [kmModal, setKmModal] = useState(false);
  const [kmInput, setKmInput] = useState('');
  const [reporting, setReporting] = useState(false);

  const load = useCallback(async () => {
    const [savedRecords, savedVehicles, selectedId] = await Promise.all([getRecords(), getVehicles(), getSelectedVehicleId()]);
    setRecords(savedRecords);
    setVehicles(savedVehicles);
    setSelectedId(selectedId);
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { let active = true; Promise.all([getRecords(), getVehicles(), getSelectedVehicleId()]).then(([savedRecords, savedVehicles, selectedId]) => { if (!active) return; setRecords(savedRecords); setVehicles(savedVehicles); setSelectedId(selectedId); setLoading(false); }); return () => { active = false; }; }, []));

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || vehicles[0] || null;
  const vehicleRecords = useMemo(() => selectedVehicle ? records.filter((record) => record.vehicleId === selectedVehicle.id || (!record.vehicleId && record.vehicle === selectedVehicle.name)) : records, [records, selectedVehicle]);
  const completed = getCompletionCount(vehicleRecords);
  const pending = getPendingCount(vehicleRecords);
  const allRecordsComplete = vehicleRecords.length > 0 && pending === 0;
  const hasPendingRecords = vehicleRecords.length > 0 && pending > 0;
  const firstName = user?.name?.trim().split(' ')[0] || '';
  const recentRecords = vehicleRecords.slice(0, 3);
  const currentKm = useMemo(() => selectedVehicle ? getCurrentKm(selectedVehicle, vehicleRecords) : null, [selectedVehicle, vehicleRecords]);
  const upcoming = useMemo(() => getUpcoming(vehicleRecords, currentKm), [vehicleRecords, currentKm]);
  const hasCost = vehicleRecords.some((record) => record.cost !== null && record.cost !== undefined);
  const totalCost = sumCost(vehicleRecords);
  const monthCost = sumCostMonth(vehicleRecords);

  async function chooseVehicle(vehicle) { setSelectedId(vehicle.id); await setSelectedVehicleId(vehicle.id); }
  function openVehicleForm(vehicle = null) { setEditingVehicle(vehicle); setVehicleModal(true); }
  function closeVehicleForm() { setVehicleModal(false); setEditingVehicle(null); }
  async function handleSaveVehicle(values) {
    const saved = editingVehicle ? await updateVehicle(editingVehicle.id, values) : await addVehicle(values);
    if (!saved) { Alert.alert('Placa já cadastrada', 'Já existe outro veículo na garagem com essa placa.'); return false; }
    setVehicleModal(false);
    setEditingVehicle(null);
    setSelectedId(saved.id);
    await setSelectedVehicleId(saved.id);
    await load();
    return true;
  }
  function openKmModal() { setKmInput(currentKm !== null ? formatKm(currentKm) : ''); setKmModal(true); }
  async function saveKm() {
    const value = parseKm(kmInput);
    if (value === null) { Alert.alert('Informe o km', 'Digite o km que o painel do carro está marcando.'); return; }
    if (currentKm !== null && value < currentKm) { Alert.alert('Km menor que o último', `O último km registrado foi ${formatKm(currentKm)}. O km atual não pode ser menor.`); return; }
    await setVehicleKm(selectedVehicle.id, value);
    setKmModal(false);
    await load();
  }
  async function handleReport() {
    if (!selectedVehicle || reporting) return;
    if (!vehicleRecords.length) { Alert.alert('Sem registros', 'Registre ao menos uma manutenção para gerar o relatório.'); return; }
    setReporting(true);
    try { await shareVehicleReport({ vehicle: selectedVehicle, records: vehicleRecords, currentKm }); }
    catch (error) { console.warn('Falha ao gerar o relatório:', error); Alert.alert('Não foi possível gerar o PDF', 'Tente novamente em instantes.'); }
    finally { setReporting(false); }
  }
  function openRecord(record) { navigation.navigate('RecordDetail', { record }); }
  function startMaintenance() { navigation.navigate('Manutenções'); }

  return <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.topline}>
        <View style={styles.avatarWrap}>{user?.profilePhoto ? <Image source={{ uri: user.profilePhoto }} style={styles.avatar} /> : <View style={styles.avatarFallback}><MaterialCommunityIcons name="account-outline" size={24} color={COLORS.blue} /></View>}</View>
        <View style={styles.greetingBlock}><Text style={styles.kicker}>CONTROLE VEICULAR</Text><Text style={styles.greeting}>{getGreeting()}{firstName ? `, ${firstName}` : ''}</Text><Text style={styles.subtitle}>Cuidar do seu carro é ir mais longe.</Text></View>
      </View>

      <View style={styles.garageHeading}><View style={styles.garageHeadingCopy}><Text style={styles.sectionTitle}>Minha garagem</Text><Text style={styles.sectionHint}>{vehicles.length ? `${vehicles.length} ${vehicles.length === 1 ? 'veículo cadastrado' : 'veículos cadastrados'}` : 'Cadastre seu primeiro veículo'}</Text></View><View style={styles.garageActions}>{selectedVehicle ? <Pressable onPress={() => openVehicleForm(selectedVehicle)} style={({ pressed }) => [styles.editVehicleButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Editar modelo, placa e ano"><MaterialCommunityIcons name="pencil-outline" size={16} color={COLORS.green} /><Text style={styles.editVehicleText}>Editar</Text></Pressable> : null}<Pressable onPress={() => openVehicleForm()} style={({ pressed }) => [styles.addVehicleButton, pressed && styles.pressed]}><MaterialCommunityIcons name="plus" size={18} color={COLORS.green} /><Text style={styles.addVehicleText}>Adicionar</Text></Pressable></View></View>

      {selectedVehicle ? <>
        <View style={styles.vehicleHero}>
          <View style={styles.vehicleCopy}>
            <Text style={styles.vehicleEyebrow}>VEÍCULO SELECIONADO</Text>
            <Text style={styles.vehicleName} numberOfLines={2}>{selectedVehicle.name}</Text>
            <Pressable onPress={() => openVehicleForm(selectedVehicle)} style={styles.platePill} accessibilityRole="button" accessibilityLabel="Editar veículo e cadastrar placa"><MaterialCommunityIcons name="card-account-details-outline" size={15} color={COLORS.text} /><Text style={styles.plateText}>{selectedVehicle.plate || 'Placa não cadastrada'}{selectedVehicle.year ? ` · ${selectedVehicle.year}` : ''}</Text><MaterialCommunityIcons name="pencil-outline" size={13} color={COLORS.green} /></Pressable>
          </View>
          <Image source={require('../../assets/garage-car-universal.png')} style={styles.carArtwork} resizeMode="contain" accessibilityLabel="Ilustração de um carro" />
          <View style={[styles.vehicleStatus, { backgroundColor: allRecordsComplete ? '#E9F5EE' : hasPendingRecords ? COLORS.paleAmber : '#EEF1EF' }]}><MaterialCommunityIcons name={allRecordsComplete ? 'shield-check' : hasPendingRecords ? 'alert-circle-outline' : 'information-outline'} size={15} color={allRecordsComplete ? COLORS.green : hasPendingRecords ? COLORS.amber : COLORS.muted} /><Text style={[styles.vehicleStatusText, { color: allRecordsComplete ? COLORS.green : hasPendingRecords ? COLORS.amber : COLORS.muted }]}>{allRecordsComplete ? 'Tudo em dia' : hasPendingRecords ? 'Há pendências' : 'Pronto para começar'}</Text></View>
          <View style={styles.heroStats}><HeroStat value={vehicleRecords.length} label="registros" icon="receipt-text-outline" /><View style={styles.heroDivider} /><HeroStat value={completed} label="completos" icon="check-circle-outline" /><View style={styles.heroDivider} /><HeroStat value={pending} label="pendentes" icon="clock-outline" /></View>
        </View>
        {vehicles.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vehicleChoices}>{vehicles.map((vehicle) => <Pressable key={vehicle.id} onPress={() => chooseVehicle(vehicle)} style={[styles.vehicleChip, vehicle.id === selectedVehicle.id && styles.vehicleChipSelected]}><MaterialCommunityIcons name="car-outline" size={16} color={vehicle.id === selectedVehicle.id ? '#fff' : COLORS.green} /><Text numberOfLines={1} style={[styles.vehicleChipText, vehicle.id === selectedVehicle.id && styles.vehicleChipTextSelected]}>{vehicle.name} · {vehicle.plate || 'sem placa'}</Text></Pressable>)}</ScrollView> : null}
      </> : <Pressable onPress={() => openVehicleForm()} style={({ pressed }) => [styles.emptyGarage, pressed && styles.pressed]}><View style={styles.emptyGarageIcon}><MaterialCommunityIcons name="garage-variant" size={32} color={COLORS.green} /></View><Text style={styles.emptyGarageTitle}>{loading ? 'A carregar a garagem…' : 'A sua garagem começa aqui'}</Text><Text style={styles.emptyGarageText}>Cadastre o veículo uma vez. Depois, escolha-o sempre que registar uma manutenção.</Text><View style={styles.emptyGarageLink}><Text style={styles.emptyGarageLinkText}>Cadastrar veículo</Text><MaterialCommunityIcons name="arrow-right" size={17} color={COLORS.green} /></View></Pressable>}

      {selectedVehicle ? <>
        <View style={styles.summaryCard}>
          <SummaryItem icon="cash-multiple" label="Gasto no mês" value={hasCost ? formatMoney(monthCost) : '—'} />
          <View style={styles.summaryDivider} />
          <SummaryItem icon="wallet-outline" label="Gasto total" value={hasCost ? formatMoney(totalCost) : '—'} />
          <View style={styles.summaryDivider} />
          <Pressable onPress={openKmModal} style={({ pressed }) => [styles.summaryItem, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Atualizar km atual">
            <MaterialCommunityIcons name="speedometer" size={19} color={COLORS.green} />
            <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>{currentKm !== null ? `${formatKm(currentKm)} km` : '—'}</Text>
            <Text style={styles.summaryLabel}>Atualizar km ✎</Text>
          </Pressable>
        </View>
        {!hasCost ? <Text style={styles.summaryHint}>Informe o valor ao registrar um serviço para acompanhar seus gastos.</Text> : null}

        <View style={styles.sectionRow}><View style={{ flex: 1 }}><Text style={styles.sectionTitle}>Próximas manutenções</Text><Text style={styles.sectionHint}>{upcoming.length ? 'Calculado a partir dos seus registros' : 'Nenhum lembrete ativo'}</Text></View><MaterialCommunityIcons name="bell-ring-outline" size={23} color={COLORS.green} /></View>
        {upcoming.length ? upcoming.map((item) => <UpcomingCard key={item.record.id} item={item} onPress={() => openRecord(item.record)} />) : <View style={styles.emptyActivity}><MaterialCommunityIcons name="bell-outline" size={28} color={COLORS.green} /><Text style={styles.emptyActivityTitle}>Sem lembretes por enquanto</Text><Text style={styles.emptyActivityText}>Ao registrar um serviço, ative “Lembrar próxima manutenção” para acompanhar o prazo aqui.</Text></View>}
      </> : null}

      <View style={styles.sectionRow}><View><Text style={styles.sectionTitle}>Atividades recentes</Text><Text style={styles.sectionHint}>{selectedVehicle ? selectedVehicle.name : 'Selecione um veículo para ver o histórico'}</Text></View><MaterialCommunityIcons name="history" size={23} color={COLORS.green} /></View>
      {recentRecords.length ? recentRecords.map((record, index) => {
        const status = getRecordStatus(record);
        const recordVehicle = record.vehicleName || record.vehicle || selectedVehicle?.name || 'Veículo';
        const plate = record.vehiclePlate || selectedVehicle?.plate;
        const year = record.vehicleYear || selectedVehicle?.year;
        return <Pressable key={record.id} onPress={() => openRecord(record)} style={({ pressed }) => [styles.activityCard, pressed && styles.pressed]}>
          {record.photo ? <Image source={{ uri: record.photo }} style={styles.activityPhoto} /> : <View style={styles.activityIcon}><MaterialCommunityIcons name="car-wrench" size={22} color={COLORS.green} /></View>}
          <View style={styles.activityBody}><Text style={styles.activityTitle} numberOfLines={1}>{record.description}</Text><Text style={styles.activityMeta} numberOfLines={1}>{recordVehicle}{plate ? ` · ${plate}` : ''}{year ? ` · ${year}` : ''} · {record.date}</Text><View style={styles.statusLine}><View style={[styles.statusDot, { backgroundColor: status.color }]} /><Text style={[styles.statusText, { color: status.color }]}>{getRecordStatusText(record)}</Text></View></View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.muted} />
        </Pressable>;
      }) : <View style={styles.emptyActivity}><MaterialCommunityIcons name="clipboard-text-clock-outline" size={28} color={COLORS.green} /><Text style={styles.emptyActivityTitle}>Sem atividades recentes</Text><Text style={styles.emptyActivityText}>{selectedVehicle ? 'Os serviços deste veículo vão aparecer aqui.' : 'Cadastre um veículo para começar o histórico.'}</Text>{selectedVehicle ? <Pressable onPress={startMaintenance} style={styles.startLink}><Text style={styles.startLinkText}>Registar primeira manutenção</Text><MaterialCommunityIcons name="arrow-right" size={16} color={COLORS.green} /></Pressable> : null}</View>}
      {selectedVehicle && vehicleRecords.length ? <View style={{ marginTop: 6 }}><PrimaryButton title={reporting ? 'Gerando PDF…' : 'Gerar relatório em PDF'} variant="secondary" onPress={handleReport} disabled={reporting} /></View> : null}
      <View style={styles.tipCard}><MaterialCommunityIcons name="lightbulb-on-outline" size={21} color={COLORS.green} /><Text style={styles.tipText}>Os seus veículos ficam cadastrados uma única vez. Cada manutenção é associada ao carro selecionado.</Text></View>
    </ScrollView>
    <Modal visible={kmModal} transparent animationType="fade" onRequestClose={() => setKmModal(false)}>
      <View style={styles.modalOverlay}><KeyboardAvoidingView style={styles.modalKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><View style={styles.modalScroll}><View style={styles.modalCard}>
        <View style={styles.modalTop}><View style={styles.modalIcon}><MaterialCommunityIcons name="speedometer" size={24} color={COLORS.green} /></View><Pressable onPress={() => setKmModal(false)} style={styles.modalClose}><MaterialCommunityIcons name="close" size={21} color={COLORS.muted} /></Pressable></View>
        <Text style={styles.modalEyebrow}>QUILOMETRAGEM</Text><Text style={styles.modalTitle}>Atualizar km atual</Text>
        <Text style={styles.modalDescription}>Digite o que o painel do carro marca hoje. Isso deixa os avisos por quilometragem sempre certos.</Text>
        <TextInput value={kmInput} onChangeText={(value) => setKmInput(formatKmInput(value))} placeholder="Ex.: 46.100" placeholderTextColor={COLORS.muted} style={styles.modalInput} keyboardType="number-pad" maxLength={9} autoFocus />
        <View style={{ height: 14 }} />
        <PrimaryButton title="Salvar km" onPress={saveKm} />
        <Pressable onPress={() => setKmModal(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
      </View></View></KeyboardAvoidingView></View>
    </Modal>
    <VehicleFormModal visible={vehicleModal} vehicle={editingVehicle} onClose={closeVehicleForm} onSave={handleSaveVehicle} />
  </SafeAreaView>;
}

const STATUS_STYLE = {
  overdue: { color: COLORS.red, background: '#FDECEC', icon: 'alert-circle-outline', label: 'Atrasada' },
  soon: { color: COLORS.amber, background: COLORS.paleAmber, icon: 'clock-alert-outline', label: 'Perto de vencer' },
  ok: { color: COLORS.green, background: '#E9F5EE', icon: 'check-circle-outline', label: 'Em dia' },
};
function SummaryItem({ icon, label, value }) { return <View style={styles.summaryItem}><MaterialCommunityIcons name={icon} size={19} color={COLORS.green} /><Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>; }
function UpcomingCard({ item, onPress }) {
  const look = STATUS_STYLE[item.status];
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.upcomingCard, { backgroundColor: look.background }, pressed && styles.pressed]} accessibilityRole="button">
    <View style={styles.upcomingTop}>
      <MaterialCommunityIcons name={look.icon} size={21} color={look.color} />
      <View style={{ flex: 1 }}><Text style={styles.upcomingTitle} numberOfLines={1}>{item.title}</Text><Text style={[styles.upcomingText, { color: look.color }]}>{item.text}</Text></View>
      <Text style={[styles.upcomingBadge, { color: look.color }]}>{look.label}</Text>
    </View>
    <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(Math.max(0.04, item.progress) * 100)}%`, backgroundColor: look.color }]} /></View>
  </Pressable>;
}

function HeroStat({ value, label, icon }) { return <View style={styles.heroStat}><MaterialCommunityIcons name={icon} size={17} color={COLORS.mint} /><Text style={styles.heroStatValue}>{value}</Text><Text style={styles.heroStatLabel}>{label}</Text></View>; }

function VehicleFormModal({ visible, vehicle, onClose, onSave }) {
  const [name, setName] = useState('');
  const [plate, setPlate] = useState('');
  const [year, setYear] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setName(vehicle?.name || '');
    setPlate(vehicle?.plate || '');
    setYear(vehicle?.year || '');
    setSaving(false);
  }, [visible, vehicle?.id]);
  function resetAndClose() { setName(''); setPlate(''); setYear(''); setSaving(false); onClose(); }
  function formatPlate(value) { const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7); return clean.length > 3 ? `${clean.slice(0, 3)}-${clean.slice(3)}` : clean; }
  async function submit() {
    const cleanPlate = plate.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (!name.trim()) { Alert.alert('Falta o modelo', 'Informe o modelo do veículo, por exemplo: Honda Civic.'); return; }
    if (cleanPlate && !/^[A-Z]{3}(?:[0-9]{4}|[0-9][A-Z][0-9]{2})$/.test(cleanPlate)) { Alert.alert('Placa inválida', 'Digite uma placa brasileira válida, por exemplo ABC-1234 ou ABC-1D23.'); return; }
    setSaving(true);
    try {
      const success = await onSave({ name: name.trim(), plate: formatPlate(cleanPlate), year: year.trim() });
      if (success) { setName(''); setPlate(''); setYear(''); }
    } catch {
      Alert.alert('Não foi possível salvar o veículo', 'Confira os dados e tente novamente.');
    } finally { setSaving(false); }
  }
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={resetAndClose}>
    <View style={styles.modalOverlay}><KeyboardAvoidingView style={styles.modalKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalScroll}><View style={styles.modalCard}>
      <View style={styles.modalTop}><View style={styles.modalIcon}><MaterialCommunityIcons name={vehicle ? 'pencil-outline' : 'car-wrench'} size={24} color={COLORS.green} /></View><Pressable onPress={resetAndClose} disabled={saving} style={styles.modalClose}><MaterialCommunityIcons name="close" size={21} color={COLORS.muted} /></Pressable></View>
      <Text style={styles.modalEyebrow}>{vehicle ? 'ATUALIZAR DADOS' : 'SUA GARAGEM'}</Text><Text style={styles.modalTitle}>{vehicle ? 'Editar veículo' : 'Adicionar veículo'}</Text><Text style={styles.modalDescription}>{vehicle ? 'Atualize modelo, placa ou ano. O histórico deste veículo será mantido.' : 'Cadastre os dados uma vez. Depois, é só selecionar este carro ao lançar uma manutenção.'}</Text>
      <Text style={styles.modalLabel}>MODELO DO VEÍCULO</Text><TextInput value={name} onChangeText={setName} placeholder="Ex.: Honda Civic" placeholderTextColor={COLORS.muted} style={styles.modalInput} autoCapitalize="words" returnKeyType="next" />
      <Text style={styles.modalLabel}>PLACA (OPCIONAL)</Text><TextInput value={plate} onChangeText={(value) => setPlate(value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8))} placeholder="ABC-1D23 (opcional)" placeholderTextColor={COLORS.muted} style={styles.modalInput} autoCapitalize="characters" maxLength={8} />
      <Text style={styles.modalLabel}>ANO (OPCIONAL)</Text><TextInput value={year} onChangeText={(value) => setYear(value.replace(/\D/g, '').slice(0, 4))} placeholder="Ex.: 2022" placeholderTextColor={COLORS.muted} style={styles.modalInput} keyboardType="number-pad" maxLength={4} />
      <View style={styles.modalHint}><MaterialCommunityIcons name="information-outline" size={16} color={COLORS.green} /><Text style={styles.modalHintText}>Placa e ano são opcionais e ficam salvos com o veículo. Não precisa digitá-los em cada manutenção.</Text></View>
      <PrimaryButton title={saving ? (vehicle ? 'Atualizando…' : 'Salvando…') : vehicle ? 'Salvar alterações' : 'Guardar na garagem'} onPress={submit} disabled={saving} />
      <Pressable onPress={resetAndClose} disabled={saving} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
    </View></ScrollView></KeyboardAvoidingView></View>
  </Modal>;
}

const styles = StyleSheet.create({
  summaryCard: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 6, marginTop: 4, ...SHADOW },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  summaryValue: { color: COLORS.text, fontSize: 15, fontWeight: '900', maxWidth: '100%' },
  summaryLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800' },
  summaryDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  summaryHint: { color: COLORS.muted, fontSize: 11, textAlign: 'center', marginTop: 8 },
  upcomingCard: { borderRadius: 16, padding: 12, marginBottom: 9 },
  upcomingTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  upcomingTitle: { color: COLORS.text, fontSize: 14, fontWeight: '900' },
  upcomingText: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  upcomingBadge: { fontSize: 10, fontWeight: '900' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(20,39,32,0.10)', marginTop: 10, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  screen: { flex: 1, backgroundColor: COLORS.bg }, content: { paddingHorizontal: 20, paddingTop: 17, paddingBottom: 34 },
  topline: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 19 }, greetingBlock: { flex: 1, minWidth: 0 }, kicker: { color: COLORS.green, fontSize: 10, fontWeight: '900', letterSpacing: 1.8 }, greeting: { color: COLORS.text, fontSize: 26, fontWeight: '900', marginTop: 4 }, subtitle: { color: COLORS.muted, fontSize: 13, marginTop: 4 }, avatarWrap: { width: 49, height: 49, borderRadius: 25, borderWidth: 2, borderColor: '#D4EBDD', overflow: 'hidden', marginRight: 12 }, avatar: { width: '100%', height: '100%' }, avatarFallback: { flex: 1, backgroundColor: COLORS.paleBlue, alignItems: 'center', justifyContent: 'center' },
  garageHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, garageHeadingCopy: { flex: 1, minWidth: 0, paddingRight: 6 }, garageActions: { flexDirection: 'row', alignItems: 'center', gap: 6 }, sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '900' }, sectionHint: { color: COLORS.muted, fontSize: 11, marginTop: 3 }, editVehicleButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 9 }, editVehicleText: { color: COLORS.green, fontSize: 11, fontWeight: '900' }, addVehicleButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.paleBlue, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 9 }, addVehicleText: { color: COLORS.green, fontSize: 11, fontWeight: '900' }, pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  vehicleHero: { minHeight: 264, borderRadius: 24, padding: 18, backgroundColor: COLORS.navyDeep, overflow: 'hidden', ...SHADOW }, vehicleCopy: { width: '52%', zIndex: 2 }, vehicleEyebrow: { color: COLORS.mint, fontSize: 9, fontWeight: '900', letterSpacing: 1.25 }, vehicleName: { color: '#fff', fontSize: 23, lineHeight: 27, fontWeight: '900', marginTop: 8 }, platePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8F7F1', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, marginTop: 10 }, plateText: { color: COLORS.text, fontSize: 11, fontWeight: '900', letterSpacing: 1.05 }, carArtwork: { position: 'absolute', zIndex: 1, right: 7, top: 36, width: '55%', height: 92 }, vehicleStatus: { position: 'absolute', top: 141, left: 18, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E9F5EE', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, zIndex: 2 }, vehicleStatusText: { color: COLORS.green, fontSize: 10, fontWeight: '900' }, heroStats: { position: 'absolute', left: 18, right: 18, bottom: 13, height: 70, borderTopWidth: 1, borderTopColor: '#335349', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }, heroStat: { flex: 1, alignItems: 'center', gap: 2 }, heroStatValue: { color: '#fff', fontSize: 17, fontWeight: '900' }, heroStatLabel: { color: '#C4D1CB', fontSize: 9, fontWeight: '700' }, heroDivider: { width: 1, height: 36, backgroundColor: '#335349' },
  vehicleChoices: { gap: 8, paddingVertical: 11 }, vehicleChip: { maxWidth: 220, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 }, vehicleChipSelected: { backgroundColor: COLORS.green, borderColor: COLORS.green }, vehicleChipText: { color: COLORS.text, fontSize: 10, fontWeight: '800', flexShrink: 1 }, vehicleChipTextSelected: { color: '#fff' },
  emptyGarage: { minHeight: 210, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 24, padding: 22, ...SHADOW }, emptyGarageIcon: { height: 58, width: 58, borderRadius: 20, backgroundColor: COLORS.paleBlue, alignItems: 'center', justifyContent: 'center' }, emptyGarageTitle: { color: COLORS.text, fontSize: 18, fontWeight: '900', marginTop: 12 }, emptyGarageText: { color: COLORS.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 }, emptyGarageLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }, emptyGarageLinkText: { color: COLORS.green, fontSize: 12, fontWeight: '900' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25, marginBottom: 10 }, activityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 11, marginBottom: 9, ...SHADOW }, activityPhoto: { width: 56, height: 56, borderRadius: 14, backgroundColor: COLORS.navyDeep }, activityIcon: { width: 56, height: 56, borderRadius: 14, backgroundColor: COLORS.paleBlue, alignItems: 'center', justifyContent: 'center' }, activityBody: { flex: 1, marginLeft: 11 }, activityTitle: { color: COLORS.text, fontSize: 14, fontWeight: '900' }, activityMeta: { color: COLORS.muted, fontSize: 10, marginTop: 4 }, statusLine: { flexDirection: 'row', alignItems: 'center', marginTop: 6 }, statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 }, statusText: { fontSize: 9, fontWeight: '800' },
  emptyActivity: { alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 18, padding: 22, borderWidth: 1, borderColor: COLORS.border }, emptyActivityTitle: { color: COLORS.text, fontSize: 14, fontWeight: '900', marginTop: 8 }, emptyActivityText: { color: COLORS.muted, fontSize: 11, marginTop: 4, textAlign: 'center' }, startLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 11 }, startLinkText: { color: COLORS.green, fontSize: 11, fontWeight: '900' }, tipCard: { flexDirection: 'row', gap: 9, alignItems: 'center', backgroundColor: COLORS.paleBlue, borderRadius: 16, padding: 13, marginTop: 14 }, tipText: { color: COLORS.text, fontSize: 10, flex: 1, lineHeight: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(7,31,27,0.55)', paddingHorizontal: 20 }, modalKeyboard: { flex: 1, width: '100%' }, modalScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 12 }, modalCard: { width: '100%', maxWidth: 440, backgroundColor: COLORS.bg, borderRadius: 25, padding: 20, borderWidth: 1, borderColor: COLORS.border, ...SHADOW }, modalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, modalIcon: { width: 47, height: 47, borderRadius: 16, backgroundColor: COLORS.paleBlue, alignItems: 'center', justifyContent: 'center' }, modalClose: { width: 35, height: 35, borderRadius: 18, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center' }, modalEyebrow: { color: COLORS.green, fontSize: 9, fontWeight: '900', letterSpacing: 1.6, marginTop: 14 }, modalTitle: { color: COLORS.text, fontSize: 24, fontWeight: '900', marginTop: 3 }, modalDescription: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 5, marginBottom: 10 }, modalLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 9, marginBottom: 5 }, modalInput: { height: 47, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13, backgroundColor: COLORS.card, paddingHorizontal: 12, color: COLORS.text, fontSize: 13 }, modalHint: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: COLORS.paleBlue, borderRadius: 12, padding: 10, marginTop: 12, marginBottom: 14 }, modalHintText: { color: COLORS.text, fontSize: 10, lineHeight: 15, flex: 1 }, cancelButton: { alignItems: 'center', paddingVertical: 8 }, cancelText: { color: COLORS.muted, fontSize: 12, fontWeight: '800' },
});
