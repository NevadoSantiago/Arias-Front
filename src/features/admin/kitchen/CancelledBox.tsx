import { ChevronDown, CircleMinus, CircleX, ReceiptText, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CancelledOrder } from '@/features/admin/services/adminApi';
import { cancelledSummary } from './cancelledOrders';
import { formatMinute, minuteOfDay } from './kitchenBoard';
import { CountBadge, Items, OrderNote } from './kitchenParts';
import { CANCELLED_BOX_ID } from './useCancelledOrders';

interface CancelledBoxProps {
  /** Newest cancellation first, as the backend sends them. */
  orders: CancelledOrder[];
  timezone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** First load in flight: no count is shown. */
  loading?: boolean;
  /** The list failed to load: an inline error replaces the count and the empty text. */
  error?: boolean;
}

function CreditTag({ refunded }: { refunded: boolean | null }) {
  if (refunded === null) return null;
  return refunded ? (
    <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-success/15 px-2.5 text-xs font-bold text-[#3F6B27]">
      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
      Crédito devuelto
    </span>
  ) : (
    <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-warning/15 px-2.5 text-xs font-bold text-warning-deep">
      <CircleMinus className="h-3.5 w-3.5" aria-hidden="true" />
      Crédito consumido
    </span>
  );
}

/**
 * Read-only box of the orders the customer cancelled today, below "Pedidos entregados". An order
 * with `comandadoAt` already had its ticket printed: the kitchen must not prepare it.
 */
export function CancelledBox({ orders, timezone, open, onOpenChange, loading = false, error = false }: CancelledBoxProps) {
  const { total, commandedLabel } = cancelledSummary(orders);
  const hhmm = (iso: string) => formatMinute(minuteOfDay(iso, timezone));
  return (
    <section
      id={CANCELLED_BOX_ID}
      aria-labelledby="kb-cancelled-h"
      className="min-w-0 scroll-mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-1.5"
    >
      <h2 id="kb-cancelled-h" className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="kb-cancelled-list"
          onClick={() => onOpenChange(!open)}
          className="flex min-h-[48px] w-full items-center justify-between gap-3 py-1 text-left"
        >
          <span className="flex flex-wrap items-center gap-2">
            <CircleX className="h-[18px] w-[18px] shrink-0 text-destructive" aria-hidden="true" />
            <span className="text-[13px] font-bold uppercase tracking-brand">Pedidos cancelados</span>
            {!loading && !error && <CountBadge n={total} className="h-[26px] bg-destructive text-[13px]" />}
            {commandedLabel && !error && (
              <span className="inline-flex h-6 items-center rounded-full border border-blue-600 bg-blue-500/10 px-2.5 text-xs font-bold text-blue-700">
                {commandedLabel}
              </span>
            )}
          </span>
          <ChevronDown
            className={cn('h-[18px] w-[18px] shrink-0 transition-transform', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </h2>
      {open && (
        <div id="kb-cancelled-list" className="pb-2.5">
          <p className="pb-2 text-[12.5px] text-muted-foreground">
            Cancelados por el cliente hoy. Solo lectura. Si dice «Ya comandado», la comanda ya salió por la ticketera: no lo
            prepares.
          </p>
          {error ? (
            <p role="alert" className="border-t border-destructive/20 py-2 text-[13px] text-destructive">
              No pudimos cargar los cancelados. Probá Actualizar.
            </p>
          ) : loading ? null : orders.length === 0 ? (
            <p className="border-t border-destructive/20 py-2 text-[13px] text-muted-foreground">
              Todavía no se canceló ningún pedido hoy.
            </p>
          ) : (
            <ul className="flex flex-col">
              {orders.map((o) => (
                <li
                  key={o.id}
                  data-cancelled-order={o.id}
                  aria-label={`Pedido N° ${o.id}, ${o.customerNickname}, cancelado a las ${hhmm(o.cancelledAt)}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 gap-y-2 border-t border-destructive/20 py-2.5 text-[13px]"
                >
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm">
                      <span>
                        <strong className="font-bold">N° {o.id}</strong> ·{' '}
                        <span className="font-semibold">{o.customerNickname}</span>
                      </span>
                      {o.comandadoAt && (
                        <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-blue-600 bg-blue-500/10 px-2.5 text-[11px] font-bold uppercase tracking-wide text-blue-700">
                          <ReceiptText className="h-3.5 w-3.5" aria-hidden="true" />
                          Ya comandado
                        </span>
                      )}
                    </div>
                    <Items order={o} compact className="font-medium" badgeClassName="bg-muted-foreground" />
                    <OrderNote notas={o.notas} compact />
                  </div>
                  <div className="flex flex-col items-end gap-1.5 text-right">
                    <span className="tabular-nums text-muted-foreground">
                      {`Retiro ${hhmm(o.pickupAt)} · cancelado ${hhmm(o.cancelledAt)}`}
                    </span>
                    <CreditTag refunded={o.cancelRefunded} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
