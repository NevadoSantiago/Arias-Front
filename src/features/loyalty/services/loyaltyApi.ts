import { api } from '@/lib/api';
import type { AvailableDessert, Loyalty } from '../types';

export async function getLoyalty(): Promise<Loyalty> {
  const { data } = await api.get<Loyalty>('/api/v1/loyalty');
  return data;
}

/** Postres que el cliente puede elegir hoy para canjear su postre de regalo. */
export async function getAvailableDesserts(): Promise<AvailableDessert[]> {
  const { data } = await api.get<AvailableDessert[]>('/api/v1/desserts/available');
  return data;
}
