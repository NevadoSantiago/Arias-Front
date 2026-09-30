import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Banknote,
  CalendarX,
  CheckCircle2,
  Clock3,
  Gift,
  RotateCcw,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMovements } from '../services/creditsApi';
import type { CreditMovement, MovementType } from '../types';

const MOVEMENT_LABELS: Record<MovementType, string> = {
  WELCOME_GRANT: 'Almuerzo de bienvenida',
  PACK_PURCHASE: 'Compra de paquete',
  DIRECT_PURCHASE: 'Compra directa',
  DIRECT_PURCHASE_REFUND: 'Pago de un pedido cancelado · vuelve a tu saldo',
  COMMIT: 'Reservado para un pedido',
  RELEASE: 'Pedido cancelado',
  CONSUME: 'Pedido retirado',
  EXPIRATION: 'Vencimiento',
  PAYMENT_REVERSAL: 'Pago revertido',
  ADMIN_ADJUSTMENT: 'Ajuste administrativo',
};

const VISIBLE_COUNT = 5;

/** Ícono + color por tipo de movimiento (F5, prototipo `Credits.dc.html`). */
const MOVEMENT_ICON: Record<MovementType, { Icon: typeof Clock3; tone: string }> = {
  COMMIT: { Icon: Clock3, tone: 'bg-muted text-foreground' },
  CONSUME: { Icon: CheckCircle2, tone: 'bg-success/15 text-success' },
  RELEASE: { Icon: RotateCcw, tone: 'bg-muted text-foreground' },
  PAYMENT_REVERSAL: { Icon: TriangleAlert, tone: 'bg-destructive/15 text-destructive' },
  PACK_PURCHASE: { Icon: Banknote, tone: 'bg-success/15 text-success' },
  DIRECT_PURCHASE: { Icon: Banknote, tone: 'bg-success/15 text-success' },
  // F18 (backend B7): compra DIRECT aprobada con el pedido ya cancelado —
  // los almuerzos vuelven a disponibles en vez de perderse, siempre positivo.
  DIRECT_PURCHASE_REFUND: { Icon: RotateCcw, tone: 'bg-success/15 text-success' },
  WELCOME_GRANT: { Icon: Gift, tone: 'bg-primary-deep/15 text-primary-deep' },
  EXPIRATION: { Icon: CalendarX, tone: 'bg-muted text-muted-foreground' },
  ADMIN_ADJUSTMENT: { Icon: SlidersHorizontal, tone: 'bg-muted text-muted-foreground' },
};

function amountOf(movement: CreditMovement): number {
  return movement.deltaAvailable !== 0 ? movement.deltaAvailable : movement.deltaCommitted;
}

function formatAmount(amount: number): string {
  return amount > 0 ? `+${amount}` : `${amount}`;
}

function formatDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface Props {
  /**
   * `compact` (default, móvil): la fecha va en la línea de detalle.
   * `wide` (escritorio, F22c): la fecha tiene su propia columna, a la derecha del detalle.
   */
  layout?: 'compact' | 'wide';
}

/**
 * Historial de movimientos en el orden en que el backend los devuelve — el
 * frontend no reordena ni recalcula nada (spec `credits-ui`, requisito
 * "Historial de movimientos legible"). F5: un ícono por tipo, montos con
 * signo, y solo los primeros 5 hasta que el cliente pide ver el resto.
 */
export function PurchaseHistory({ layout = 'compact' }: Props = {}) {
  const wide = layout === 'wide';
  const [expanded, setExpanded] = useState(false);
  const { data: movements, isLoading, isError } = useQuery({
    queryKey: ['creditMovements'],
    queryFn: getMovements,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando historial…</p>;
  }

  if (isError) {
    return <p className="text-sm text-destructive">No pudimos cargar tu historial.</p>;
  }

  if (!movements || movements.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no tenés movimientos.</p>;
  }

  const visible = expanded ? movements : movements.slice(0, VISIBLE_COUNT);
  const hasMore = movements.length > VISIBLE_COUNT;

  return (
    <div className="flex flex-col gap-1">
      <ul className="m-0 list-none divide-y divide-border rounded-lg border border-border bg-card px-3.5 py-0">
        {visible.map((movement) => {
          const amount = amountOf(movement);
          const { Icon, tone } = MOVEMENT_ICON[movement.type] ?? { Icon: Clock3, tone: 'bg-muted text-foreground' };
          return (
            <li key={movement.id} className="flex items-center gap-3 py-3.5">
              <span aria-hidden="true" className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', tone)}>
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[14.5px] font-semibold leading-tight text-foreground">
                  {MOVEMENT_LABELS[movement.type] ?? movement.type}
                </span>
                <span className="text-[12.5px] leading-snug text-muted-foreground">
                  {wide ? movement.description : `${formatDate(movement.createdAt)}${movement.description ? ` · ${movement.description}` : ''}`}
                </span>
              </span>
              {wide && (
                <time dateTime={movement.createdAt} className="w-24 shrink-0 text-[13px] text-muted-foreground">
                  {formatDate(movement.createdAt)}
                </time>
              )}
              <span
                className={cn(
                  'shrink-0 text-base font-bold',
                  amount > 0 ? 'text-success' : amount < 0 ? 'text-destructive' : 'text-foreground',
                )}
              >
                {formatAmount(amount)}
              </span>
            </li>
          );
        })}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mx-auto h-11 px-3 text-sm font-bold text-primary-deep"
        >
          {expanded ? 'Ver menos' : 'Ver movimientos anteriores'}
        </button>
      )}
    </div>
  );
}
