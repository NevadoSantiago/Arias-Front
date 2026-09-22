import { api } from '@/lib/api';
import type {
  CreatePurchasePayload,
  CreditMovement,
  CreditPack,
  CreditPurchase,
  CreditPurchaseCheckout,
  CreditWallet,
} from '../types';

const BASE = '/api/v1/credits';

/** Saldo AVAILABLE/COMMITTED del usuario autenticado — nunca se suman en el cliente. */
export async function getWallet(): Promise<CreditWallet> {
  const { data } = await api.get<CreditWallet>(`${BASE}/wallet`);
  return data;
}

/** Historial de movimientos, tal como el backend los ordena. */
export async function getMovements(): Promise<CreditMovement[]> {
  const { data } = await api.get<CreditMovement[]>(`${BASE}/movements`);
  return data;
}

/** Catálogo público de paquetes habilitados, con precio/descuento ya calculados por el servidor. */
export async function getPacks(): Promise<CreditPack[]> {
  const { data } = await api.get<CreditPack[]>(`${BASE}/packs`);
  return data;
}

/**
 * Inicia una compra. El importe NUNCA viaja en el request — lo calcula el
 * backend. La respuesta trae `initPoint`, la URL de checkout de Mercado Pago
 * a la que hay que redirigir.
 */
export async function createPurchase(payload: CreatePurchasePayload): Promise<CreditPurchaseCheckout> {
  const { data } = await api.post<CreditPurchaseCheckout>(`${BASE}/purchases`, payload);
  return data;
}

/**
 * Consulta el estado de una compra — usado por la página de retorno del
 * checkout para hacer polling. La acreditación real ocurre solo vía webhook
 * del backend; este endpoint solo informa el estado actual.
 */
export async function getPurchase(id: string): Promise<CreditPurchase> {
  const { data } = await api.get<CreditPurchase>(`${BASE}/purchases/${id}`);
  return data;
}
