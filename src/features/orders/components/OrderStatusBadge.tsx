import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OrderEstado } from '../types';
import { DEFAULT_BADGE, ESTADO_MAP } from './orderStatus';

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
