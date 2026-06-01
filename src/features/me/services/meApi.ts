import { api } from '@/lib/api';

const BASE = '/api/v1/me';

export interface NotificationPreferences {
  recibeRecordatorioPedido: boolean;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await api.get<NotificationPreferences>(`${BASE}/notifications`);
  return data;
}

export async function updateNotificationPreferences(
  prefs: NotificationPreferences,
): Promise<NotificationPreferences> {
  const { data } = await api.put<NotificationPreferences>(`${BASE}/notifications`, prefs);
  return data;
}

/**
 * Llamada del link del mail "no quiero más recordatorios" — pública.
 * El token viene del query string (?t=...).
 */
export async function unsubscribeReminder(token: string): Promise<{ email: string }> {
  const { data } = await api.post<{ email: string }>(
    `${BASE}/unsubscribe-reminder`,
    null,
    { params: { t: token } },
  );
  return data;
}
