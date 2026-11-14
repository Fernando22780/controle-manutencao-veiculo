
export function parseDateBR(value) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value || '');
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const valid = d.getFullYear() === Number(m[3]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[1]);
  return valid ? d : null;
}
export function normalizeReminderTime(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
export function isValidDateBR(value) {
  const d = parseDateBR(value);
  return Boolean(d) && d.getFullYear() >= 1900 && d.getFullYear() <= new Date().getFullYear();
}
export function formatDateBR(date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}
export function addMonths(date, months) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return target;
}
export function addDays(date, days) {
  const target = new Date(date);
  target.setDate(target.getDate() + days);
  return target;
}
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
export function daysBetween(from, to) { return Math.round((startOfDay(to) - startOfDay(from)) / 86400000); }

export function onlyDigits(value) { return String(value ?? '').replace(/\D/g, ''); }
export function parseKm(value) {
  const digits = onlyDigits(value);
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}
export function formatKm(n) {
  if (n === null || n === undefined || n === '') return '';
  return String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
export function formatKmInput(value) {
  const digits = onlyDigits(value).slice(0, 7);
  return digits ? formatKm(parseInt(digits, 10)) : '';
}

export function parseMoney(value) {
  const raw = String(value ?? '');
  if (raw.includes('-')) return null;
  let t = raw.replace(/[^\d.,]/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (!(/^\d+\.\d{1,2}$/.test(t))) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}
export function formatMoney(value) {
  const v = Number(value) || 0;
  const [int, dec] = v.toFixed(2).split('.');
  return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}
export function sanitizeMoneyInput(value) {
  let t = String(value ?? '').replace(/[^\d,]/g, '');
  const first = t.indexOf(',');
  if (first !== -1) t = t.slice(0, first + 1) + t.slice(first + 1).replace(/,/g, '').slice(0, 2);
  return t.slice(0, 11);
}

export const SERVICE_TYPES = [
  { label: 'Troca de óleo', km: 10000, months: 6 },
  { label: 'Revisão', km: 10000, months: 12 },
  { label: 'Pneus', km: 40000, months: null },
  { label: 'Freios', km: 30000, months: null },
  { label: 'Alinhamento', km: 10000, months: 6 },
  { label: 'Bateria', km: null, months: 36 },
];
export function normalizeService(text) {
  return String(text ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}
export function suggestionFor(description) {
  const t = normalizeService(description);
  if (!t) return null;
  if (t.includes('oleo')) return SERVICE_TYPES[0];
  if (t.includes('revisao')) return SERVICE_TYPES[1];
  if (t.includes('pneu')) return SERVICE_TYPES[2];
  if (t.includes('freio') || t.includes('pastilha')) return SERVICE_TYPES[3];
  if (t.includes('alinhamento') || t.includes('balanceamento')) return SERVICE_TYPES[4];
  if (t.includes('bateria')) return SERVICE_TYPES[5];
  return null;
}

export function buildReminder({ dateStr, km, kmInterval, daysInterval, monthsInterval, time = '09:00' }) {
  const kmI = kmInterval > 0 ? kmInterval : null;
  const daysI = daysInterval > 0 ? daysInterval : null;
  const monthsI = monthsInterval > 0 ? monthsInterval : null;
  if (!kmI && !daysI && !monthsI) return null;
  const base = parseDateBR(dateStr);
  return {
    kmInterval: kmI,
    daysInterval: daysI,
    monthsInterval: monthsI,
    time: normalizeReminderTime(time) || '09:00',
    nextKm: kmI && km !== null && km !== undefined ? km + kmI : null,
    nextDate: base && (daysI || monthsI) ? formatDateBR(addDays(addMonths(base, monthsI || 0), daysI || 0)) : null,
  };
}
export function describeNext(reminder) {
  if (!reminder) return '';
  const parts = [];
  if (reminder.nextKm) parts.push(`aos ${formatKm(reminder.nextKm)} km`);
  if (reminder.nextDate) parts.push(`em ${reminder.nextDate} às ${reminder.time || '09:00'}`);
  return parts.join(' ou ');
}

export function getCurrentKm(vehicle, records) {
  const values = [];
  if (vehicle?.currentKm !== null && vehicle?.currentKm !== undefined) values.push(Number(vehicle.currentKm));
  (records || []).forEach((r) => { if (r.km !== null && r.km !== undefined) values.push(Number(r.km)); });
  const valid = values.filter((n) => Number.isFinite(n));
  return valid.length ? Math.max(...valid) : null;
}

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const plural = (n, one, many) => (n === 1 ? one : many);

export function getUpcoming(records, currentKm, today = new Date()) {
  const latest = new Map();
  (records || []).forEach((r) => {
    const key = normalizeService(r.description);
    if (!key) return;
    const d = parseDateBR(r.date);
    const t = d ? d.getTime() : 0;
    const prev = latest.get(key);
    if (!prev || t > prev.t || (t === prev.t && Number(r.id) > Number(prev.record.id))) latest.set(key, { record: r, t, date: d });
  });

  const items = [];
  latest.forEach(({ record, date }) => {
    const rem = record.reminder;
    if (!rem) return;
    const parts = [];
    let overdue = false;
    let soon = false;
    let progress = 0;

    if (rem.nextDate) {
      const due = parseDateBR(rem.nextDate);
      if (due) {
        const left = daysBetween(today, due);
        const total = date ? daysBetween(date, due) : 0;
        if (total > 0) progress = Math.max(progress, (total - left) / total);
        if (left < 0) { overdue = true; parts.push(`venceu há ${-left} ${plural(-left, 'dia', 'dias')}`); }
        else if (left === 0) { soon = true; parts.push('vence hoje'); }
        else { if (left <= 30) soon = true; parts.push(`em ${left} ${plural(left, 'dia', 'dias')}`); }
      }
    }
    if (rem.nextKm) {
      if (currentKm !== null && currentKm !== undefined) {
        const left = rem.nextKm - currentKm;
        const total = record.km !== null && record.km !== undefined ? rem.nextKm - record.km : rem.kmInterval;
        if (total > 0) progress = Math.max(progress, (total - left) / total);
        if (left < 0) { overdue = true; parts.push(`passou ${formatKm(-left)} km`); }
        else { if (left <= 1000) soon = true; parts.push(`faltam ${formatKm(left)} km`); }
      } else {
        parts.push(`aos ${formatKm(rem.nextKm)} km`);
      }
    }
    if (!parts.length) return;
    items.push({ record, title: record.description, text: parts.join(' · '), status: overdue ? 'overdue' : soon ? 'soon' : 'ok', progress: clamp01(progress) });
  });

  const order = { overdue: 0, soon: 1, ok: 2 };
  return items.sort((a, b) => order[a.status] - order[b.status] || b.progress - a.progress);
}

export function sumCost(records) {
  return (records || []).reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
}
export function sumCostMonth(records, today = new Date()) {
  return (records || []).reduce((sum, r) => {
    const d = parseDateBR(r.date);
    return d && d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() ? sum + (Number(r.cost) || 0) : sum;
  }, 0);
}

export function belongsToVehicle(record, vehicle) {
  if (!vehicle) return false;
  return record.vehicleId === vehicle.id || (!record.vehicleId && Boolean(record.vehicle) && record.vehicle === vehicle.name);
}
export function filterRecords(records, vehicles, { vehicleId = 'all', query = '' } = {}) {
  const vehicle = vehicleId === 'all' ? null : (vehicles || []).find((item) => item.id === vehicleId) || null;
  const tokens = normalizeService(query).split(' ').filter(Boolean);
  return (records || []).filter((record) => {
    if (vehicleId !== 'all' && vehicle && !belongsToVehicle(record, vehicle)) return false;
    if (!tokens.length) return true;
    const haystack = normalizeService([record.description, record.vehicleName, record.vehicle, record.vehiclePlate, record.date].filter(Boolean).join(' '));
    return tokens.every((token) => haystack.includes(token));
  });
}

const MONTH_LABELS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function monthlyCosts(records, today = new Date(), count = 6) {
  const months = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const ref = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push({ year: ref.getFullYear(), month: ref.getMonth(), label: MONTH_LABELS[ref.getMonth()], total: 0, current: i === 0 });
  }
  (records || []).forEach((record) => {
    const d = parseDateBR(record.date);
    const cost = Number(record.cost) || 0;
    if (!d || !cost) return;
    const slot = months.find((m) => m.year === d.getFullYear() && m.month === d.getMonth());
    if (slot) slot.total += cost;
  });
  return months;
}
export function costByService(records, limit = 3) {
  const groups = new Map();
  (records || []).forEach((record) => {
    const cost = Number(record.cost) || 0;
    const key = normalizeService(record.description);
    if (!cost || !key) return;
    const group = groups.get(key) || { label: String(record.description).trim(), total: 0, count: 0 };
    group.total += cost;
    group.count += 1;
    groups.set(key, group);
  });
  return [...groups.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}
export function formatMoneyShort(value) {
  const v = Number(value) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace('.', ',').replace(',0', '')} mil`;
  return String(Math.round(v));
}
