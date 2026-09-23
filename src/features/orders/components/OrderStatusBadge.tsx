import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OrderEstado } from '../types';

const ESTADO_MAP: Record<OrderEstado, { label: string; className: string }> = {
  PENDIENTE: { label: 'Pendiente', className: 'bg-warning text-warning-foreground' },
  CONFIRMADO: { label: 'Confirmado', className: 'bg-primary text-primary-foreground' },
  COMANDADO: { label: 'Comandado', className: 'bg-blue-500 text-white' },
  ENTREGADO: { label: 'Entregado', className: 'bg-success text-success-foreground' },
  CANCELADO: { label: 'Cancelado', className: 'bg-muted text-muted-foreground' },
};

/** Estado de un pedido — mismo mapa de colores que `EstadoBadge` (admin), con CANCELADO agregado. */
export function OrderStatusBadge({ estado }: { estado: OrderEstado }) {
  const { label, className } = ESTADO_MAP[estado];
  return (
    <Badge className={cn('uppercase tracking-brand text-[9px] shrink-0', className)}>
      {label}
    </Badge>
  );
}
