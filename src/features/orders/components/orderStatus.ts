import type { OrderEstado } from '../types';

// F10, decisión del usuario (2026-09-26): PENDIENTE → "Programado";
// ENTREGADO → "Retirado" (v2 no lo produce hoy, pero se mantiene el mapeo
// para cuando exista). CONFIRMADO y CANCELADO no cambian: un pedido
// CONFIRMADO ya consumió el almuerzo y no se puede cancelar, así que tanto
// el pasado como el futuro muestran "Confirmado". F18: PENDIENTE_PAGO →
// "Pago pendiente", mismo tono mostaza que "Programado" (`bg-warning`).
export const ESTADO_MAP: Record<OrderEstado, { label: string; className: string }> = {
  PENDIENTE_PAGO: { label: 'Pago pendiente', className: 'bg-warning text-warning-foreground' },
  PENDIENTE: { label: 'Programado', className: 'bg-warning text-warning-foreground' },
  CONFIRMADO: { label: 'Confirmado', className: 'bg-primary text-primary-foreground' },
  COMANDADO: { label: 'Comandado', className: 'bg-blue-500 text-white' },
  ENTREGADO: { label: 'Retirado', className: 'bg-success text-success-foreground' },
  CANCELADO: { label: 'Cancelado', className: 'bg-muted text-muted-foreground' },
};

export const DEFAULT_BADGE = { label: 'Estado', className: 'bg-muted text-muted-foreground' };

/** Texto de la insignia ("Programado", "Confirmado"…) — para nombres accesibles que la mencionan. */
export function orderStatusLabel(estado: OrderEstado): string {
  return (ESTADO_MAP[estado] ?? DEFAULT_BADGE).label;
}
