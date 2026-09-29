import { useEffect, useRef } from 'react';
import { ChevronLeft, CreditCard, Pencil, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChefBackdrop, OrderComanda } from './OrderComanda';
import { addPlatesPath, comandaCopy, comandaFooter, comandaItems, comandaWhenLabel } from './comandaModel';
import { formatOrderDateLabel } from '../orderDateLabels';
import type { OrderV2 } from '../../services/ordersApi';

interface Props {
  order: OrderV2;
  /** Instante de referencia ("hoy", si el retiro ya pasó) — una vez por carga de datos, en la página. */
  now: Date;
  /** Nombre con el que la cocina llama al cliente (`AuthUser.displayName`). */
  callName: string;
  /** Saldo disponible — solo informativo ("Te quedan N"); null mientras no se conoce. */
  walletAvailable: number | null;
  /** `getRestaurantConfig().pickupLeadMinutes`, para nombrar el corte; null/undefined si no se conoce. */
  pickupLeadMinutes?: number | null;
  /** true mientras "Pagar ahora" está en curso para este pedido. */
  payingNow?: boolean;
  onBack: () => void;
  onRequestChangePickupTime?: (order: OrderV2) => void;
  onRequestCancel?: (order: OrderV2) => void;
  onRequestPayNow?: (order: OrderV2) => void;
}

/**
 * Comanda a pantalla completa de un pedido de "Mis pedidos" (F20, prototipo
 * `MyOrders.dc.html`, tablero v20): la comanda aprobada con la insignia de
 * estado y las acciones que ese estado permite. Presentacional puro: las
 * acciones solo se ofrecen si el backend las habilita (`cancellable`,
 * `modifiable`, `pickupTimeChangeable`) — nunca se recalcula el corte — y
 * las hojas de confirmación (cambiar horario, cancelar) las monta la página.
 * Vive sobre la lista (z-40, bajo las hojas z-50) para que, tras una acción,
 * se actualice en el lugar con el pedido refrescado.
 */
export function OrderComandaScreen({
  order,
  now,
  callName,
  walletAvailable,
  pickupLeadMinutes,
  payingNow = false,
  onBack,
  onRequestChangePickupTime,
  onRequestCancel,
  onRequestPayNow,
}: Props) {
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // El foco entra a la vista al abrirla (es un diálogo a pantalla completa).
    backRef.current?.focus();
  }, []);

  const { title, headline } = comandaCopy(order, { now, pickupLeadMinutes });
  const cancelled = order.estado === 'CANCELADO';
  const scheduled = order.estado === 'PENDIENTE';
  const canPay = order.estado === 'PENDIENTE_PAGO' && order.cancellable && !!onRequestPayNow;
  const canChange = scheduled && order.pickupTimeChangeable && !!onRequestChangePickupTime;
  const canAdd = scheduled && order.modifiable;
  const canCancel = !cancelled && order.cancellable && !!onRequestCancel;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="comanda-title"
      className="fixed inset-0 z-40 flex flex-col bg-background"
    >
      <div className="flex h-14 shrink-0 items-center border-b border-border bg-card px-2">
        <button
          ref={backRef}
          type="button"
          onClick={onBack}
          className="inline-flex h-11 items-center gap-1 rounded-md px-2 text-sm font-semibold text-primary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="h-[18px] w-[18px]" aria-hidden="true" />
          Mis pedidos
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <ChefBackdrop>
          <div className="mx-auto flex max-w-xl flex-col gap-[18px] px-4 pb-7 pt-[18px]">
            <div className="flex flex-col gap-1">
              <h1 id="comanda-title" className="m-0 font-display text-[25px] font-bold leading-[1.1] text-foreground">
                {title}
              </h1>
              <span className="text-sm leading-snug text-muted-foreground">{headline}</span>
            </div>

            <OrderComanda
              orderId={order.id}
              dateLabel={formatOrderDateLabel(order.pickupAt)}
              callName={callName}
              whenLabel={comandaWhenLabel(order, now)}
              items={comandaItems(order)}
              footer={comandaFooter(order, { now, walletAvailable })}
              estado={order.estado}
              muted={cancelled}
            />

            {(canPay || canChange || canAdd || canCancel) && (
              <div className="flex flex-col gap-2.5 pt-1.5">
                {canPay && (
                  <button
                    type="button"
                    onClick={() => onRequestPayNow?.(order)}
                    disabled={payingNow}
                    className="flex h-[54px] items-center justify-center gap-2 rounded-md bg-primary-deep text-sm font-bold uppercase tracking-brand text-primary-foreground disabled:opacity-60"
                  >
                    <CreditCard className="h-[18px] w-[18px]" aria-hidden="true" />
                    Pagar ahora
                  </button>
                )}
                {(canChange || canAdd) && (
                  <div className="flex gap-2.5">
                    {canChange && (
                      <button
                        type="button"
                        onClick={() => onRequestChangePickupTime?.(order)}
                        className="flex h-[52px] min-w-0 flex-1 items-center justify-center gap-2 rounded-md border-[1.5px] border-primary-deep bg-card px-2.5 text-[13.5px] font-bold text-primary-deep"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Cambiar horario
                      </button>
                    )}
                    {canAdd && (
                      <Link
                        to={addPlatesPath(order)}
                        className="flex h-[52px] min-w-0 flex-1 items-center justify-center gap-2 rounded-md border-[1.5px] border-primary-deep bg-card px-2.5 text-[13.5px] font-bold text-primary-deep no-underline"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Agregar platos
                      </Link>
                    )}
                  </div>
                )}
                {canCancel && (
                  <button
                    type="button"
                    onClick={() => onRequestCancel?.(order)}
                    className="h-12 rounded-md text-[13px] font-bold uppercase tracking-brand text-destructive"
                  >
                    Cancelar pedido
                  </button>
                )}
              </div>
            )}
          </div>
        </ChefBackdrop>
      </div>
    </div>
  );
}
