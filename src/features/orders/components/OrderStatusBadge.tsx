import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OrderEstado } from '../types';

// F10, decisión del usuario (2026-09-26): PENDIENTE → "Programado";
// ENTREGADO → "Retirado" (v2 no lo produce hoy, pero se mantiene el mapeo
// para cuando exista). CONFIRMADO y CANCELADO no cambian: un pedido
// CONFIRMADO ya consumió el almuerzo y no se puede cancelar, así que tanto
// el pasado como el futuro muestran "Confirmado".
const ESTADO_MAP: Record<OrderEstado, { label: string; className: string }> = {
  PENDIENTE: { label: 'Programado', className: 'bg-warning text-warning-foreground' },
  CONFIRMADO: { label: 'Confirmado', className: 'bg-primary text-primary-foreground' },
  COMANDADO: { label: 'Comandado', className: 'bg-blue-500 text-white' },
  ENTREGADO: { label: 'Retirado', className: 'bg-success text-success-foreground' },
  CANCELADO: { label: 'Cancelado', className: 'bg-muted text-muted-foreground' },
};

const DEFAULT_BADGE = { label: 'Estado', className: 'bg-muted text-muted-foreground' };

/** Estado de un pedido — mismo mapa de colores que `EstadoBadge` (admin), con CANCELADO agregado. */
export function OrderStatusBadge({ estado }: { estado: OrderEstado }) {
  // Fallback defensivo: `OrderEstado` es un union cerrado en TS, pero un
  // valor nuevo del backend no debería romper el render — se ve neutro.
  const { label, className } = ESTADO_MAP[estado] ?? DEFAULT_BADGE;
  return (
    <Badge className={cn('uppercase tracking-brand text-[9px] shrink-0', className)}>
      {label}
    </Badge>
  );
}
