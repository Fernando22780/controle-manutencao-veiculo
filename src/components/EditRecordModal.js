import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import PrimaryButton from './PrimaryButton';
import CalendarPicker from './CalendarPicker';
import { Chip, ReminderCard } from './ReminderFields';
import { SERVICE_TYPES, buildReminder, formatKm, formatKmInput, isValidDateBR, parseKm, parseMoney, sanitizeMoneyInput, suggestionFor } from '../maintenanceUtils';

const moneyToText = (value) => (value === null || value === undefined ? '' : String(value.toFixed ? value.toFixed(2) : value).replace('.', ','));

// Edita serviço, data, km, valor e lembrete de um registro que já foi salvo.
export default function EditRecordModal({ visible, record, onClose, onSaved }) {
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [km, setKm] = useState('');
  const [cost, setCost] = useState('');
  const [reminderOn, setReminderOn] = useState(false);
  const [kmInterval, setKmInterval] = useState('');
  const [monthsInterval, setMonthsInterval] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !record) return;
    setDescription(record.description || '');
    setDate(record.date || '');
    setKm(record.km !== null && record.km !== undefined ? formatKm(record.km) : '');
    setCost(moneyToText(record.cost));
    setReminderOn(Boolean(record.reminder));
    setKmInterval(record.reminder?.kmInterval ? String(record.reminder.kmInterval) : '');
    setMonthsInterval(record.reminder?.monthsInterval ? String(record.reminder.monthsInterval) : '');
    setSaving(false);
  }, [visible, record]);

  function applySuggestion(text) {
    const suggestion = suggestionFor(text);
    if (!suggestion) return;
    setKmInterval(suggestion.km ? String(suggestion.km) : '');
    setMonthsInterval(suggestion.months ? String(suggestion.months) : '');
  }
  function pickService(label) { setDescription(label); if (reminderOn && !kmInterval && !monthsInterval) applySuggestion(label); }
  function toggleReminder(value) { setReminderOn(value); if (value && !kmInterval && !monthsInterval) applySuggestion(description); }

  const kmValue = parseKm(km);
  const preview = reminderOn ? buildReminder({ dateStr: date, km: kmValue, kmInterval: parseKm(kmInterval), monthsInterval: parseKm(monthsInterval) }) : null;
  const needsKm = reminderOn && Boolean(parseKm(kmInterval)) && kmValue === null;

  async function save() {
    if (saving) return;
    if (!description.trim()) { Alert.alert('Informe o serviço', 'Digite o nome do serviço realizado.'); return; }
    if (!isValidDateBR(date.trim())) { Alert.alert('Data inválida', 'Escolha uma data no calendário.'); return; }
    const costValue = parseMoney(cost);
    if (cost.trim() && costValue === null) { Alert.alert('Valor inválido', 'Digite o valor pago, por exemplo 280,00.'); return; }
    const kmIntervalValue = reminderOn ? parseKm(kmInterval) : null;
    const monthsIntervalValue = reminderOn ? parseKm(monthsInterval) : null;
    if (reminderOn && !kmIntervalValue && !monthsIntervalValue) { Alert.alert('Escolha o prazo do lembrete', 'Informe em quantos km ou meses lembrar, ou desligue o lembrete.'); return; }
    if (kmIntervalValue && kmValue === null) { Alert.alert('Informe o km atual', 'Para lembrar por quilometragem, preencha o km do serviço.'); return; }
    setSaving(true);
    try {
      await onSaved({
        description: description.trim(),
        date: date.trim(),
        km: kmValue,
        cost: costValue,
        reminder: reminderOn ? buildReminder({ dateStr: date.trim(), km: kmValue, kmInterval: kmIntervalValue, monthsInterval: monthsIntervalValue }) : null,
      });
    } finally { setSaving(false); }
  }

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}><Text style={styles.eyebrow}>REGISTRO</Text><Text style={styles.title}>Editar manutenção</Text></View>
        <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Fechar"><MaterialCommunityIcons name="close" size={21} color={COLORS.text} /></Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Text style={styles.label}>Serviço realizado</Text>
          <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Ex.: troca de óleo" placeholderTextColor={COLORS.muted} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chipRow}>
            {SERVICE_TYPES.map((type) => <Chip key={type.label} label={type.label} active={description.trim().toLowerCase() === type.label.toLowerCase()} onPress={() => pickService(type.label)} />)}
          </ScrollView>

          <Text style={styles.label}>Data do serviço</Text>
          <CalendarPicker value={date} onChange={setDate} />

          <View style={styles.twoCols}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Km (opcional)</Text>
              <TextInput style={styles.input} value={km} onChangeText={(value) => setKm(formatKmInput(value))} keyboardType="number-pad" placeholder="Ex.: 45.200" placeholderTextColor={COLORS.muted} maxLength={9} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Valor pago (opcional)</Text>
              <TextInput style={styles.input} value={cost} onChangeText={(value) => setCost(sanitizeMoneyInput(value))} keyboardType="decimal-pad" placeholder="R$ 0,00" placeholderTextColor={COLORS.muted} />
            </View>
          </View>

          <ReminderCard on={reminderOn} onToggle={toggleReminder} kmInterval={kmInterval} onKmIntervalChange={setKmInterval} monthsInterval={monthsInterval} onMonthsIntervalChange={setMonthsInterval} preview={preview} needsKm={needsKm} />

          <View style={{ height: 18 }} />
          <PrimaryButton title={saving ? 'Salvando…' : 'Salvar alterações'} onPress={save} disabled={saving} />
          <Pressable onPress={onClose} disabled={saving} style={styles.cancel}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  eyebrow: { color: COLORS.green, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '900', marginTop: 2 },
  close: { width: 40, height: 40, borderRadius: 14, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  label: { color: COLORS.muted, fontSize: 11, fontWeight: '800', marginTop: 14, marginBottom: 6 },
  input: { height: 48, borderRadius: 13, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, paddingHorizontal: 13, color: COLORS.text, fontSize: 14 },
  chipRow: { gap: 7, paddingTop: 8, paddingBottom: 2 },
  twoCols: { flexDirection: 'row', gap: 10 },
  cancel: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { color: COLORS.muted, fontSize: 14, fontWeight: '800' },
});
