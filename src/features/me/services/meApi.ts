import { api } from '@/lib/api';

const BASE = '/api/v1/me';

export interface NotificationPreferences {
  recibeRecordatorioPedido: boolean;
  recibeAvisoRetiro: boolean;
  /** Mails de novedades y promociones (campaña de reseña/descuento). */
  recibeNovedades: boolean;
}

/** Tarjeta de reseña de Google: el servidor decide si se muestra y con qué plato/link. */
export interface ReviewPrompt {
  show: boolean;
  dishName: string | null;
  reviewUrl: string | null;
}

export async function getReviewPrompt(): Promise<ReviewPrompt> {
  const { data } = await api.get<ReviewPrompt>(`${BASE}/review-prompt`);
  return data;
}

/** El cliente tocó "Dejar mi opinión": no se vuelve a mostrar. 204. */
export async function markReviewOpened(): Promise<void> {
  await api.post(`${BASE}/review-prompt/opened`);
}

/** El cliente tocó "Nunca": no se vuelve a mostrar. 204. */
export async function markReviewNever(): Promise<void> {
  await api.post(`${BASE}/review-prompt/never`);
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await api.get<NotificationPreferences>(`${BASE}/notifications`);
  return data;
}

export async function updateNotificationPreferences(
  prefs: Partial<NotificationPreferences>,
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

/**
 * Llamada del link del mail "no quiero más novedades" — pública.
 * El token viene del query string (?t=...). 400 `invalid-token` si no sirve.
 */
export async function unsubscribeNews(token: string): Promise<{ email: string }> {
  const { data } = await api.post<{ email: string }>(
    `${BASE}/unsubscribe-news`,
    null,
    { params: { t: token } },
  );
  return data;
}
