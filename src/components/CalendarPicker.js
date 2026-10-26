import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../theme';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

function parseDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value || '');
  if (!match) return null;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return date.getFullYear() === Number(match[3]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[1]) ? date : null;
}
function formatDate(date) { return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`; }

export default function CalendarPicker({ value, onChange }) {
  const [visible, setVisible] = useState(false);
  const [month, setMonth] = useState(() => parseDate(value) || new Date());
  useEffect(() => { if (visible) setMonth(parseDate(value) || new Date()); }, [visible, value]);

  const cells = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstDay = new Date(year, monthIndex, 1).getDay();
    const mondayOffset = (firstDay + 6) % 7;
    const count = new Date(year, monthIndex + 1, 0).getDate();
    return [...Array(mondayOffset).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  }, [month]);

  function shiftMonth(amount) { setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1)); }
  function chooseDay(day) {
    if (!day) return;
    onChange(formatDate(new Date(month.getFullYear(), month.getMonth(), day)));
    setVisible(false);
  }

  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Escolher data no calendário" onPress={() => setVisible(true)} style={styles.field}>
      <MaterialCommunityIcons name="calendar-month-outline" size={21} color={COLORS.blue} />
      <Text style={[styles.value, !value && styles.placeholder]}>{value || 'Selecionar data da manutenção'}</Text>
      <MaterialCommunityIcons name="chevron-down" size={21} color={COLORS.muted} />
    </Pressable>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View><Text style={styles.kicker}>DATA DA MANUTENÇÃO</Text><Text style={styles.title}>Escolha o dia</Text></View>
            <Pressable accessibilityLabel="Fechar calendário" onPress={() => setVisible(false)} style={styles.close}><MaterialCommunityIcons name="close" size={22} color={COLORS.text} /></Pressable>
          </View>
          <View style={styles.monthRow}>
            <Pressable onPress={() => shiftMonth(-1)} style={styles.arrow}><MaterialCommunityIcons name="chevron-left" size={28} color={COLORS.blue} /></Pressable>
            <Text style={styles.monthTitle}>{MONTHS[month.getMonth()]} de {month.getFullYear()}</Text>
            <Pressable onPress={() => shiftMonth(1)} style={styles.arrow}><MaterialCommunityIcons name="chevron-right" size={28} color={COLORS.blue} /></Pressable>
          </View>
          <View style={styles.grid}>
            {WEEKDAYS.map((day, index) => <Text key={`weekday-${index}`} style={styles.weekday}>{day}</Text>)}
            {cells.map((day, index) => {
              const chosen = day && formatDate(new Date(month.getFullYear(), month.getMonth(), day)) === value;
              const today = day && formatDate(new Date(month.getFullYear(), month.getMonth(), day)) === formatDate(new Date());
              return <Pressable key={`day-${index}`} disabled={!day} onPress={() => chooseDay(day)} style={[styles.dayCell, chosen && styles.chosenDay]}>
                {day ? <Text style={[styles.dayText, chosen && styles.chosenText, today && !chosen && styles.todayText]}>{day}</Text> : null}
                {today && !chosen ? <View style={styles.todayDot} /> : null}
              </Pressable>;
            })}
          </View>
          <Pressable onPress={() => { onChange(formatDate(new Date())); setVisible(false); }} style={styles.todayButton}><MaterialCommunityIcons name="calendar-today" size={17} color={COLORS.blue} /><Text style={styles.todayButtonText}>Selecionar hoje</Text></Pressable>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  field: { height: 48, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 5 },
  value: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: '700' }, placeholder: { color: COLORS.muted, fontWeight: '500' },
  overlay: { flex: 1, backgroundColor: 'rgba(8, 18, 28, 0.58)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  card: { width: '100%', maxWidth: 400, borderRadius: 24, backgroundColor: COLORS.card, padding: 20, borderWidth: 1, borderColor: COLORS.border, elevation: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, kicker: { color: COLORS.blue, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: COLORS.text, fontSize: 22, fontWeight: '900', marginTop: 3 }, close: { height: 38, width: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 10 }, arrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 }, monthTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900', textTransform: 'capitalize' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' }, weekday: { width: '14.2857%', textAlign: 'center', color: COLORS.muted, fontSize: 12, fontWeight: '900', paddingVertical: 8 },
  dayCell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 22, marginVertical: 2 }, dayText: { color: COLORS.text, fontSize: 14, fontWeight: '700' }, chosenDay: { backgroundColor: COLORS.blue }, chosenText: { color: '#fff', fontWeight: '900' }, todayText: { color: COLORS.blue, fontWeight: '900' }, todayDot: { position: 'absolute', bottom: 5, height: 4, width: 4, borderRadius: 2, backgroundColor: COLORS.blue },
  todayButton: { minHeight: 44, marginTop: 10, borderRadius: 14, backgroundColor: COLORS.paleBlue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, todayButtonText: { color: COLORS.blue, fontSize: 13, fontWeight: '900' },
});
