import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Clock3, CreditCard, Pencil, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatOrderDateLabel } from '../orderDateLabels';
import { OrderStatusBadge } from '../OrderStatusBadge';
import { orderStatusLabel } from '../orderStatus';
import { ChefBackdrop, OrderComanda } from './OrderComanda';
import { addPlatesPath, comandaCopy, comandaFooter, comandaItems, comandaWhenLabel } from './comandaModel';
import { orderAccordionHeader } from './orderAccordionModel';
import type { OrderV2 } from '../../services/ordersApi';

/** Aviso dentro de la fila abierta (p. ej. "Horario cambiado"). */
export interface OrderAccordionNotice {
  title: string;
  text: string;
}

interface Props {
  order: OrderV2;
  /** Instante de referencia — una vez por carga de datos, en la página. */
  now: Date;
  /** Nombre con el que la cocina llama al cliente (`resolveCallName`). */
  callName: string;
  /** Saldo disponible — solo informativo ("Te quedan N"); null mientras no se conoce. */
  walletAvailable: number | null;
  /** `getRestaurantConfig().pickupLeadMinutes`, para nombrar el corte; null/undefined si no se conoce. */
  pickupLeadMinutes?: number | null;
  open: boolean;
  onToggle: () => void;
  /** "Anteriores": el encabezado suma el día del retiro (bajo un día no hace falta). */
  showDate?: boolean;
  /**
   * `stack` (móvil): la comanda y debajo el mensaje y las acciones.
   * `split` (escritorio): la comanda a la izquierda y, en una columna angosta a
   * la derecha, el mensaje, el aviso y las acciones (tablero de escritorio).
   */
  layout?: 'stack' | 'split';
  /** true mientras "Pagar ahora" está en curso para este pedido. */
  payingNow?: boolean;
  notice?: OrderAccordionNotice | null;
  onDismissNotice?: () => void;
  onRequestChangePickupTime?: (order: OrderV2) => void;
  onRequestCancel?: (order: OrderV2) => void;
  onRequestPayNow?: (order: OrderV2) => void;
  /**
   * Cuándo llevar la fila a la vista: `deep` al llegar por `?pedido=` (la sube al
   * tope) y `keep` tras abrir a mano (solo si el encabezado quedó fuera de vista).
   */
  scrollMode?: 'deep' | 'keep' | null;
  /** Avisa que la fila ya atendió `scrollMode`, para que la página lo limpie. */
  onScrolled?: () => void;
}

const HEADER_ATTR = 'data-order-acc-header';

/** Flechas, Inicio y Fin mueven el foco entre los encabezados (Enter y Espacio ya los resuelve el botón). */
function moveBetweenHeaders(event: KeyboardEvent<HTMLButtonElement>) {
  const { key } = event;
  if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Home' && key !== 'End') return;
  const heads = Array.from(document.querySelectorAll<HTMLElement>(`[${HEADER_ATTR}]`));
  const index = heads.indexOf(event.currentTarget);
  if (index < 0) return;
  event.preventDefault();
  const next =
    key === 'Home'
      ? 0
      : key === 'End'
        ? heads.length - 1
        : key === 'ArrowDown'
          ? (index + 1) % heads.length
          : (index - 1 + heads.length) % heads.length;
  heads[next].focus();
}

/**
 * Un pedido de "Mis pedidos" como fila de acordeón (F29, prototipo D7.1): el
 * encabezado cerrado resume el pedido (retiro, estado, platos y almuerzos, y
 * cómo se paga) y el panel abierto es la comanda con las acciones que el
 * estado permite. Reemplaza a `OrderCard` + la comanda a pantalla completa
 * en esta pantalla (`OrderCard` sigue en `B2cOrderPage`). Presentacional
 * puro: cuál está abierta lo decide la página (una sola a la vez) y las
 * acciones solo se ofrecen si el backend las habilita (`cancellable`,
 * `modifiable`, `pickupTimeChangeable`) — nunca se recalcula el corte.
 */
export function OrderAccordionItem({
  order,
  now,
  callName,
  walletAvailable,
  pickupLeadMinutes,
  open,
  onToggle,
  showDate = false,
  layout = 'stack',
  payingNow = false,
  notice = null,
  onDismissNotice,
  onRequestChangePickupTime,
  onRequestCancel,
  onRequestPayNow,
  scrollMode = null,
  onScrolled,
}: Props) {
  const headerRef = useRef<HTMLButtonElement>(null);
  const head = orderAccordionHeader(order, { now, pickupLeadMinutes });
  const cancelled = order.estado === 'CANCELADO';
  const awaiting = order.estado === 'PENDIENTE_PAGO';
  const scheduled = order.estado === 'PENDIENTE';
  const canPay = awaiting && order.cancellable && !!onRequestPayNow;
  const canChange = scheduled && order.pickupTimeChangeable && !!onRequestChangePickupTime;
  const canAdd = scheduled && order.modifiable;
  const canCancel = !cancelled && order.cancellable && !!onRequestCancel;
  const hasActions = canPay || canChange || canAdd || canCancel;

  const headerId = `order-acc-${order.id}-h`;
  const panelId = `order-acc-${order.id}-p`;
  const ariaLabel = [
    showDate ? head.dateLabel : null,
    head.time.toLowerCase(),
    orderStatusLabel(order.estado),
    head.summary,
    head.payLine,
  ]
    .filter(Boolean)
    .join(', ');

  useEffect(() => {
    if (!open || !scrollMode) return;
    const header = headerRef.current;
    if (header && (scrollMode === 'deep' || header.getBoundingClientRect().top < 0)) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      header.scrollIntoView?.({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }
    onScrolled?.();
    // Solo al abrirse o al pedirse el scroll; `onScrolled` no debe re-disparar el efecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scrollMode]);

  const { headline } = comandaCopy(order, { now, pickupLeadMinutes });
  const split = layout === 'split';

  const actions = hasActions && (
    <div className="flex flex-col gap-2.5">
      {canPay && (
        <button
          type="button"
          onClick={() => onRequestPayNow?.(order)}
          disabled={payingNow}
          className="flex h-[52px] items-center justify-center gap-2 rounded-md bg-primary-deep text-sm font-bold uppercase tracking-brand text-primary-foreground disabled:opacity-60"
        >
          <CreditCard className="h-[18px] w-[18px]" aria-hidden="true" />
          Pagar ahora
        </button>
      )}
      {(canChange || canAdd) && (
        <div className={cn('flex gap-2.5', split && 'flex-col')}>
          {canChange && (
            <button
              type="button"
              onClick={() => onRequestChangePickupTime?.(order)}
              className="flex h-[50px] min-w-0 flex-1 items-center justify-center gap-2 rounded-md border-[1.5px] border-primary-deep bg-card px-2.5 text-[13.5px] font-bold text-primary-deep"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Cambiar horario
            </button>
          )}
          {canAdd && (
            <Link
              to={addPlatesPath(order)}
              className="flex h-[50px] min-w-0 flex-1 items-center justify-center gap-2 rounded-md border-[1.5px] border-primary-deep bg-card px-2.5 text-[13.5px] font-bold text-primary-deep no-underline"
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
          className="h-11 rounded-md text-[13px] font-bold uppercase tracking-brand text-destructive"
        >
          Cancelar pedido
        </button>
      )}
    </div>
  );

  return (
    <li id={`order-acc-${order.id}`} data-testid="order-accordion-item">
      <div
        className={cn(
          'rounded-[10px] border bg-card',
          awaiting ? 'border-[1.5px] border-warning' : open ? 'border-border shadow-lg' : 'border-border',
          (cancelled || showDate) && !open && 'opacity-90',
        )}
      >
        <h3 className="m-0">
          <button
            ref={headerRef}
            type="button"
            id={headerId}
            data-order-acc-header=""
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={ariaLabel}
            onClick={onToggle}
            onKeyDown={moveBetweenHeaders}
            className="flex min-h-[64px] w-full scroll-mt-20 items-center gap-3 rounded-[10px] px-3.5 py-3 text-left outline-none hover:bg-primary/[0.045] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              {showDate && (
                <span className="font-display text-[15px] font-bold leading-tight text-foreground">{head.dateLabel}</span>
              )}
              <span className="inline-flex items-center gap-1.5 text-[14px] font-bold text-foreground">
                <Clock3 className="h-[17px] w-[17px] text-primary-deep" aria-hidden="true" />
                {head.time}
              </span>
              <span className="text-[13px] text-muted-foreground">{head.summary}</span>
              {head.payLine && <span className="text-[12.5px] font-bold text-primary-deep">{head.payLine}</span>}
              {head.note && <span className="text-[12.5px] text-muted-foreground">{head.note}</span>}
            </span>
            <OrderStatusBadge estado={order.estado} />
            <ChevronDown
              className={cn(
                'h-[19px] w-[19px] shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none',
                open && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </button>
        </h3>

        {open && (
          <div
            id={panelId}
            role="region"
            aria-labelledby={headerId}
            className="overflow-hidden rounded-b-[9px] border-t-[1.5px] border-dashed border-border bg-background motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200"
          >
            <ChefBackdrop>
              <div
                data-layout={layout}
                className={cn(
                  'gap-[18px] p-4',
                  split ? 'grid grid-cols-[minmax(0,440px)_minmax(0,1fr)] items-start gap-8 p-6' : 'flex flex-col',
                )}
              >
                <OrderComanda
                  orderId={order.id}
                  dateLabel={formatOrderDateLabel(order.pickupAt)}
                  callName={callName}
                  whenLabel={comandaWhenLabel(order, now)}
                  items={comandaItems(order)}
                  footer={comandaFooter(order, { now, walletAvailable })}
                  muted={cancelled}
                />
                <div className={cn('flex flex-col gap-3', split && 'pt-2')}>
                  <p className="m-0 text-sm leading-snug text-foreground">{headline}</p>
                  {notice && (
                    <div role="status" className="flex items-start gap-2.5 rounded-md bg-success/15 p-3">
                      <span
                        aria-hidden="true"
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground"
                      >
                        <Check className="h-3 w-3" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-sm font-bold text-foreground">{notice.title}</span>
                        <span className="text-[13px] leading-snug text-muted-foreground">{notice.text}</span>
                      </span>
                      <button
                        type="button"
                        onClick={onDismissNotice}
                        aria-label="Cerrar aviso"
                        className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                  {actions}
                </div>
              </div>
            </ChefBackdrop>
          </div>
        )}
      </div>
    </li>
  );
}
