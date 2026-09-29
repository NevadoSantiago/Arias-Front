import { useQuery } from '@tanstack/react-query';
import { getRestaurantConfig } from '@/features/orders/services/ordersApi';
import { DEFAULT_EXPIRY_DAYS } from '../purchaseModel';

/**
 * Días de vigencia de los almuerzos que configura el restaurante
 * (`creditExpiryDays`). Comparte la query `restaurantConfig` con la página de
 * pedido; mientras carga (o si falla) devuelve el plazo por defecto.
 */
export function useCreditExpiryDays(): number {
  const { data } = useQuery({ queryKey: ['restaurantConfig'], queryFn: getRestaurantConfig });
  // Solo un entero finito >= 1 es un plazo válido; cualquier otra cosa usa el default.
  const days = data?.creditExpiryDays;
  return typeof days === 'number' && Number.isInteger(days) && days >= 1 ? days : DEFAULT_EXPIRY_DAYS;
}
