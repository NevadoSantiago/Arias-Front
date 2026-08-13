import { api } from '@/lib/api';

const BASE = '/api/v1/admin/billing';

/** Una línea del desglose: "12 × Premium a $8000". */
export interface CategoryLine {
  categoria: string;
  /** null = pedido sin tarifa acordada cargada */
  precioUnitario: number | null;
  cantidad: number;
  subtotal: number;
  sinTarifa: boolean;
}

export interface CompanyBilling {
  companyId: number;
  companyNombre: string;
  totalPedidos: number;
  total: number;
  pedidosSinTarifa: number;
  lineas: CategoryLine[];
}

/** Total de un día. Solo vienen los días CON pedidos servidos. */
export interface DailyTotal {
  fecha: string;
  pedidos: number;
  total: number;
}

export interface BillingPeriod {
  desde: string;
  hasta: string;
  totalPedidos: number;
  totalGeneral: number;
  /** Si es > 0, hay comida servida que no se está cobrando. */
  pedidosSinTarifa: number;
  /** Evolución diaria. Suma exactamente lo mismo que `empresas`. */
  porDia: DailyTotal[];
  empresas: CompanyBilling[];
}

/**
 * @param companyId omitirlo (o null) trae todas las empresas.
 *   El filtro va al backend a propósito: así el total del período siempre
 *   corresponde a lo que se muestra, sin duplicar la suma en el cliente.
 */
export async function getBilling(
  desde: string,
  hasta: string,
  companyId?: number | null,
): Promise<BillingPeriod> {
  const { data } = await api.get<BillingPeriod>(BASE, {
    params: { desde, hasta, ...(companyId != null ? { companyId } : {}) },
  });
  return data;
}
