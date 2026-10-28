import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { describeNext, formatKm, onlyDigits } from '../maintenanceUtils';

export function Chip({ label, active, onPress }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.75 }]} accessibilityRole="button"><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

export function IntervalChips({ label, unit, options, value, onChange }) {
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
    {showCustom ? <TextInput style={styles.input} value={value} onChangeText={(text) => onChange(onlyDigits(text).slice(0, 6))} keyboardType="number-pad" placeholder={unit === 'km' ? 'Quantos km? Ex.: 8000' : 'Quantos meses? Ex.: 4'} placeholderTextColor={COLORS.muted} /> : null}
  </View>;
}

// Cartão "Lembrar próxima manutenção" (liga/desliga + prazos + prévia do próximo aviso).
export function ReminderCard({ on, onToggle, kmInterval, onKmIntervalChange, monthsInterval, onMonthsIntervalChange, preview, needsKm }) {
  return <View style={[styles.card, on && styles.cardOn]}>
    <View style={styles.head}>
      <View style={styles.icon}><MaterialCommunityIcons name="bell-ring-outline" size={20} color={COLORS.green} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Lembrar próxima manutenção</Text>
        <Text style={styles.sub}>{on ? 'Escolha em quanto tempo ou km.' : 'Receba o aviso na tela Início.'}</Text>
      </View>
      <Switch value={on} onValueChange={onToggle} trackColor={{ false: COLORS.border, true: COLORS.green }} thumbColor="#fff" />
    </View>
    {on ? <>
      <IntervalChips label="Por quilometragem" unit="km" options={[5000, 10000, 15000, 20000]} value={kmInterval} onChange={onKmIntervalChange} />
      <IntervalChips label="Por tempo" unit="meses" options={[3, 6, 12]} value={monthsInterval} onChange={onMonthsIntervalChange} />
      {needsKm ? <Text style={styles.warn}>Preencha o km atual acima para calcular o aviso por quilometragem.</Text> : null}
      {preview && describeNext(preview) ? <View style={styles.preview}><MaterialCommunityIcons name="calendar-check-outline" size={16} color={COLORS.green} /><Text style={styles.previewText}>Próximo aviso: {describeNext(preview)}</Text></View> : null}
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg },
  chipActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  chipText: { color: COLORS.text, fontSize: 11, fontWeight: '800' },
  chipTextActive: { color: '#fff' },
  intervalBlock: { marginTop: 12 },
  intervalLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '800', marginBottom: 6 },
  intervalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  input: { marginTop: 8, height: 48, borderRadius: 13, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, paddingHorizontal: 13, color: COLORS.text, fontSize: 14 },
  card: { marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, padding: 12 },
  cardOn: { backgroundColor: COLORS.paleBlue, borderColor: '#B9E1D0' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center' },
  title: { color: COLORS.text, fontSize: 13, fontWeight: '900' },
  sub: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  warn: { color: COLORS.amber, fontSize: 11, fontWeight: '800', marginTop: 10, lineHeight: 16 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: COLORS.card, borderRadius: 11, padding: 10, marginTop: 12 },
  previewText: { color: COLORS.green, fontSize: 12, fontWeight: '900', flex: 1 },
});
