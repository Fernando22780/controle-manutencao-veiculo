import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

let configured = false;

export async function configureNotifications() {
  if (Platform.OS === 'web') return false;
  if (configured) return true;

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return false;

  configured = true;
  return true;
}

function parseDateBR(value) {
  const match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 9, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function scheduleMaintenanceNotification({ recordId, description, nextDate, time = '09:00' }) {
  if (Platform.OS === 'web' || !nextDate) return null;
  const date = parseDateBR(nextDate);
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(String(time || '09:00'));
  if (date && timeMatch) { date.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0); }
  if (!date || date <= new Date()) return null;
  if (!(await configureNotifications())) return null;

  try { return await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Lembrete de manutenção',
      body: `${description || 'Uma manutenção'} está prevista para hoje.`,
      data: { recordId },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
    },
  }); } catch (error) { console.warn('[notifications] não foi possível agendar:', error?.message || error); return null; }
}

export async function scheduleTestNotification() {
  if (Platform.OS === 'web') return { ok: false, reason: 'web' };
  try {
    if (!(await configureNotifications())) return { ok: false, reason: 'permission' };
    const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Teste de notificação',
      body: 'As notificações de manutenção estão funcionando.',
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 10,
      repeats: false,
    },
    });
    return { ok: true, identifier };
  } catch (error) { console.warn('[notifications] teste recusado:', error?.message || error); return { ok: false, reason: 'unsupported' }; }
}

export async function cancelMaintenanceNotification(identifier) {
  if (!identifier || Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(identifier);
}
