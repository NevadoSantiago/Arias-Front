import { api } from '@/lib/api';

export interface QuoteRequest {
  /** Nombre de quien consulta */
  nombre: string;
  /** Empresa que representa */
  empresa: string;
  email: string;
  /** Teléfono opcional */
  telefono?: string;
  /** Cantidad aproximada de empleados */
  empleados?: number;
  /** Mensaje libre */
  mensaje?: string;
}

/**
 * Envía una solicitud de cotización. El backend dispara un mail a Arias
 * vía Resend (endpoint público, no requiere sesión). No persiste en BD.
 */
export async function submitQuote(payload: QuoteRequest): Promise<void> {
  await api.post('/api/v1/contact/quote', payload);
}
