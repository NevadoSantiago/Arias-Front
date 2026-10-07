import { api } from '@/lib/api';

/**
 * Marca el tour de primer ingreso como visto (terminado o salteado). El backend
 * es idempotente: si ya estaba marcado conserva la primera fecha.
 */
export async function markOnboardingTourSeen(): Promise<void> {
  await api.post('/api/v1/me/onboarding-tour/seen');
}
