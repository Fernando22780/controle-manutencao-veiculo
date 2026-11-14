import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../theme';
import PrimaryButton from '../components/PrimaryButton';
import { apiRequest, isApiConfigured } from '../api';

function numberValue(value) {
  const normalized = String(value || '').replace(/\./g, '').replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function TravelCostScreen() {
  const [distance, setDistance] = useState('');
  const [consumption, setConsumption] = useState('');
  const [fuelPrice, setFuelPrice] = useState('');
  const [tripMode, setTripMode] = useState('oneWay');
  const [result, setResult] = useState(null);

  const totalDistance = useMemo(() => numberValue(distance) * (tripMode === 'roundTrip' ? 2 : 1), [distance, tripMode]);

  async function calculate() {
    const consumptionValue = numberValue(consumption);
    const fuelPriceValue = numberValue(fuelPrice);
    if (totalDistance <= 0 || consumptionValue <= 0 || fuelPriceValue <= 0) {
      Alert.alert('Preencha os dados', 'Informe a distância, o consumo do veículo e o preço da gasolina.');
      return;
    }
    const localResult = { distance: totalDistance, liters: totalDistance / consumptionValue, cost: (totalDistance / consumptionValue) * fuelPriceValue };
    if (isApiConfigured()) {
      try {
        const remote = await Promise.race([
          apiRequest('/travel-cost', { method: 'POST', body: JSON.stringify({ distanceKm: numberValue(distance), consumptionKmPerLiter: consumptionValue, fuelPrice: fuelPriceValue, roundTrip: tripMode === 'roundTrip' }) }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('API indisponível')), 1500)),
        ]);
        setResult({ distance: remote.totalDistanceKm, liters: remote.fuelLiters, cost: remote.fuelCost });
        return;
      } catch {}
    }
    setResult(localResult);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}><View style={styles.icon}><MaterialCommunityIcons name="gas-station-outline" size={26} color={COLORS.green} /></View><View style={styles.headerCopy}><Text style={styles.eyebrow}>PLANEJAMENTO</Text><Text style={styles.title}>Custo da viagem</Text><Text style={styles.subtitle}>Descubra quanto de gasolina você pode gastar antes de sair.</Text></View></View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Tipo de percurso</Text>
            <View style={styles.modeRow}>
              <Pressable onPress={() => setTripMode('oneWay')} style={[styles.mode, tripMode === 'oneWay' && styles.modeSelected]}><MaterialCommunityIcons name="arrow-right" size={19} color={tripMode === 'oneWay' ? '#fff' : COLORS.green} /><Text style={[styles.modeText, tripMode === 'oneWay' && styles.modeTextSelected]}>Apenas ida</Text></Pressable>
              <Pressable onPress={() => setTripMode('roundTrip')} style={[styles.mode, tripMode === 'roundTrip' && styles.modeSelected]}><MaterialCommunityIcons name="swap-horizontal" size={19} color={tripMode === 'roundTrip' ? '#fff' : COLORS.green} /><Text style={[styles.modeText, tripMode === 'roundTrip' && styles.modeTextSelected]}>Ida e volta</Text></Pressable>
            </View>
            <Field label="Distância até o destino" suffix="km" value={distance} onChangeText={setDistance} placeholder="Ex.: 300" />
            <Field label="Consumo médio do veículo" suffix="km/L" value={consumption} onChangeText={setConsumption} placeholder="Ex.: 12" />
            <Field label="Preço da gasolina" suffix="R$/L" value={fuelPrice} onChangeText={setFuelPrice} placeholder="Ex.: 6,00" />
            <Text style={styles.totalHint}>Distância considerada: {totalDistance > 0 ? `${totalDistance.toLocaleString('pt-BR')} km` : '—'}</Text>
            <PrimaryButton title="Calcular custo" onPress={calculate} />
          </View>
          {result ? <View style={styles.resultCard}><Text style={styles.resultEyebrow}>ESTIMATIVA DA VIAGEM</Text><Text style={styles.resultTitle}>{money(result.cost)}</Text><Text style={styles.resultSubtitle}>aproximadamente</Text><View style={styles.resultGrid}><ResultItem icon="map-marker-distance" value={`${result.distance.toLocaleString('pt-BR')} km`} label="distância total" /><ResultItem icon="gas-station-outline" value={`${result.liters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`} label="gasolina necessária" /></View><Text style={styles.disclaimer}>Estimativa baseada no consumo informado. O gasto real pode variar conforme trânsito, velocidade e carga.</Text></View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, suffix, ...props }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><View style={styles.inputWrap}><TextInput {...props} style={styles.input} placeholderTextColor={COLORS.muted} keyboardType="decimal-pad" /><Text style={styles.suffix}>{suffix}</Text></View></View>;
}

function ResultItem({ icon, value, label }) {
  return <View style={styles.resultItem}><MaterialCommunityIcons name={icon} size={21} color={COLORS.green} /><Text style={styles.resultValue}>{value}</Text><Text style={styles.resultLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, screen: { flex: 1, backgroundColor: COLORS.bg }, content: { padding: 18, paddingBottom: 35 }, header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 }, icon: { width: 52, height: 52, borderRadius: 16, backgroundColor: COLORS.paleBlue, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, headerCopy: { flex: 1 }, eyebrow: { color: COLORS.green, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: COLORS.text, fontSize: 25, fontWeight: '900', marginTop: 2 }, subtitle: { color: COLORS.muted, fontSize: 12, lineHeight: 17, marginTop: 3 }, card: { backgroundColor: COLORS.card, borderRadius: RADIUS.card, padding: 17 }, sectionTitle: { color: COLORS.text, fontSize: 13, fontWeight: '900', marginBottom: 9 }, modeRow: { flexDirection: 'row', gap: 8, marginBottom: 17 }, mode: { flex: 1, minHeight: 45, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 8 }, modeSelected: { backgroundColor: COLORS.green, borderColor: COLORS.green }, modeText: { color: COLORS.green, fontSize: 12, fontWeight: '800' }, modeTextSelected: { color: '#fff' }, field: { marginBottom: 13 }, label: { color: COLORS.text, fontSize: 12, fontWeight: '800', marginBottom: 6 }, inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: COLORS.bg, height: 50 }, input: { flex: 1, height: 48, paddingHorizontal: 13, color: COLORS.text, fontSize: 15 }, suffix: { color: COLORS.muted, fontSize: 12, fontWeight: '800', paddingRight: 13 }, totalHint: { color: COLORS.muted, fontSize: 11, marginTop: -2, marginBottom: 14 }, resultCard: { backgroundColor: COLORS.paleBlue, borderRadius: RADIUS.card, padding: 18, marginTop: 16 }, resultEyebrow: { color: COLORS.green, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, resultTitle: { color: COLORS.text, fontSize: 31, fontWeight: '900', marginTop: 5 }, resultSubtitle: { color: COLORS.muted, fontSize: 11 }, resultGrid: { flexDirection: 'row', gap: 10, marginTop: 17 }, resultItem: { flex: 1, backgroundColor: COLORS.card, borderRadius: 13, padding: 12 }, resultValue: { color: COLORS.text, fontSize: 17, fontWeight: '900', marginTop: 8 }, resultLabel: { color: COLORS.muted, fontSize: 10, marginTop: 2 }, disclaimer: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 15 } });
