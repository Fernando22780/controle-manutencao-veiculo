import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SHADOW } from '../theme';
import { formatMoney, formatMoneyShort } from '../maintenanceUtils';

const BAR_AREA = 92;

// Gráfico simples de gastos, feito só com Views (sem biblioteca extra, funciona no Expo Go).
export default function SpendingChart({ months, services }) {
  const max = Math.max(...months.map((m) => m.total), 1);
  const topService = services[0]?.total || 1;
  const periodTotal = months.reduce((sum, m) => sum + m.total, 0);
  return <View style={styles.card}>
    <View style={styles.head}>
      <View style={{ flex: 1 }}><Text style={styles.title}>Gastos por mês</Text><Text style={styles.sub}>Últimos {months.length} meses</Text></View>
      <View style={styles.totalBox}><Text style={styles.totalValue}>{formatMoney(periodTotal)}</Text><Text style={styles.totalLabel}>no período</Text></View>
    </View>

    <View style={styles.bars}>
      {months.map((m) => {
        const height = m.total > 0 ? Math.max(6, (m.total / max) * BAR_AREA) : 3;
        return <View key={`${m.year}-${m.month}`} style={styles.col} accessibilityLabel={`${m.label}: ${formatMoney(m.total)}`}>
          <Text style={styles.value} numberOfLines={1}>{m.total > 0 ? formatMoneyShort(m.total) : ''}</Text>
          <View style={[styles.bar, { height }, m.total === 0 ? styles.barEmpty : m.current ? styles.barCurrent : styles.barPast]} />
          <Text style={[styles.month, m.current && styles.monthCurrent]}>{m.label}</Text>
        </View>;
      })}
    </View>

    {services.length ? <>
      <View style={styles.divider} />
      <Text style={styles.subtitle}>Onde mais gastou</Text>
      {services.map((service) => <View key={service.label} style={styles.serviceRow}>
        <View style={styles.serviceTop}><Text style={styles.serviceName} numberOfLines={1}>{service.label}</Text><Text style={styles.serviceValue}>{formatMoney(service.total)}</Text></View>
        <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(4, Math.round((service.total / topService) * 100))}%` }]} /></View>
      </View>)}
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 14, ...SHADOW },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  title: { color: COLORS.text, fontSize: 15, fontWeight: '900' },
  sub: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  totalBox: { alignItems: 'flex-end' },
  totalValue: { color: COLORS.green, fontSize: 15, fontWeight: '900' },
  totalLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '700' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: BAR_AREA + 40 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  value: { color: COLORS.muted, fontSize: 10, fontWeight: '800', marginBottom: 4, height: 14 },
  bar: { width: '70%', borderRadius: 7 },
  barCurrent: { backgroundColor: COLORS.green },
  barPast: { backgroundColor: '#9ED8C0' },
  barEmpty: { backgroundColor: COLORS.border },
  month: { color: COLORS.muted, fontSize: 11, fontWeight: '700', marginTop: 6 },
  monthCurrent: { color: COLORS.green, fontWeight: '900' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
  subtitle: { color: COLORS.text, fontSize: 13, fontWeight: '900', marginBottom: 8 },
  serviceRow: { marginBottom: 10 },
  serviceTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 5 },
  serviceName: { flex: 1, color: COLORS.text, fontSize: 12, fontWeight: '800' },
  serviceValue: { color: COLORS.muted, fontSize: 12, fontWeight: '800' },
  track: { height: 7, borderRadius: 4, backgroundColor: COLORS.paleBlue, overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4, backgroundColor: COLORS.green },
});
