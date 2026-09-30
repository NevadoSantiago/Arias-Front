import { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Hourglass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { buildPendingItem, pendingHeading, pendingSummary, type PendingItemView } from '../pendingPurchaseModel';
import type { CreditPurchase } from '../types';

interface Props {
  purchases: CreditPurchase[];
  /** `card` (default, móvil) o `wide` (escritorio, F22c): mismos datos, otro marco. */
  variant?: 'card' | 'wide';
  /** Nombre del pack `DAY` del catálogo, para titular la compra de Sueltos. */
  looseName?: string | null;
  now?: Date;
  /** Pedido cuyo "Pagar ahora" está en curso (deshabilita su botón). */
  payingOrderId: number | null;
  onPayNow: (orderId: number) => void;
}

interface RowActions {
  payingOrderId: number | null;
  onPayNow: (orderId: number) => void;
}

const ACTION_LINK =
  'inline-flex min-h-11 items-center gap-1 text-[13.5px] font-bold text-foreground underline-offset-4 hover:underline';

/**
 * Aviso de pagos de Mercado Pago pendientes en "Mis almuerzos" (D6, prototipo
 * `Credits.dc.html` / `DesktopCredits.dc.html`, tablero v23): ámbar, entre el
 * saldo y lo que sigue. Los almuerzos "por acreditar" NUNCA se suman al saldo
 * disponible: acá son solo texto. Con varios pagos se agrupan y se expanden.
 * Presentacional: los datos y "Pagar ahora" vienen de `PendingPurchases`.
 */
export function PendingPurchasesNotice({ purchases, variant = 'card', looseName, now, payingOrderId, onPayNow }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (purchases.length === 0) return null;

  const wide = variant === 'wide';
  const reference = now ?? new Date();
  const items = purchases.map((purchase) => buildPendingItem(purchase, { now: reference, looseName }));
  const multi = items.length > 1;
  const showItems = !multi || expanded;
  const headingId = `pending-purchases-${variant}`;
  const summary = pendingSummary(items);
  const actions: RowActions = { payingOrderId, onPayNow };

  const toggle = multi && (
    <button
      type="button"
      onClick={() => setExpanded((current) => !current)}
      aria-expanded={expanded}
      className={cn(
        'inline-flex h-11 items-center gap-1.5 rounded-md border-[1.5px] border-foreground bg-transparent px-3.5 text-[13px] font-bold text-foreground',
        wide ? 'shrink-0 px-4' : 'self-start',
      )}
    >
      {expanded ? 'Ocultar detalle' : `Ver los ${items.length} pagos`}
      {expanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
    </button>
  );

  const heading = (
    <h2 id={headingId} className="m-0 flex items-center gap-2 text-[13px] font-bold uppercase tracking-brand text-foreground">
      <Hourglass className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      {pendingHeading(items.length)}
    </h2>
  );

  return (
    <section
      aria-labelledby={headingId}
      data-layout={wide ? 'wide' : 'card'}
      className={cn(
        'flex flex-col border-[1.5px] border-warning bg-warning/20 text-foreground',
        wide ? 'gap-3.5 rounded-xl px-[22px] py-[18px]' : 'gap-3 rounded-[10px] px-4 py-3.5',
      )}
    >
      {wide ? (
        <div className="flex items-center justify-between gap-5">
          <div className="flex min-w-0 flex-col gap-1">
            {heading}
            {multi && (
              <p className="m-0 text-sm leading-snug">
                <strong className="font-bold">{summary}</strong>. Todavía no están en tu saldo; se acreditan apenas Mercado Pago
                confirme cada pago.
              </p>
            )}
          </div>
          {toggle}
        </div>
      ) : (
        <>
          {heading}
          {multi && (
            <div className="flex flex-col gap-1">
              <p className="m-0 text-sm font-semibold leading-snug">{summary}</p>
              <p className="m-0 text-[13px] leading-snug">
                Todavía no están en tu saldo. Se acreditan apenas Mercado Pago confirme cada pago.
              </p>
            </div>
          )}
        </>
      )}

      {showItems && (
        <ul className={cn('m-0 flex list-none flex-col p-0', wide ? 'gap-3.5' : 'gap-3')}>
          {items.map((item, index) => (
            <li
              key={item.id}
              className={cn(
                'flex',
                wide ? 'items-start justify-between gap-6' : 'flex-col gap-2',
                index > 0 && 'border-t-[1.5px] border-dashed border-warning pt-3',
              )}
            >
              {wide ? (
                <>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <ItemTitle item={item} wide />
                    <ItemBody item={item} {...actions} />
                  </div>
                  <ItemFigures item={item} wide />
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <ItemTitle item={item} wide={false} />
                    <ItemFigures item={item} wide={false} />
                  </div>
                  <ItemBody item={item} {...actions} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {!wide && toggle}
    </section>
  );
}

function ItemTitle({ item, wide }: { item: PendingItemView; wide: boolean }) {
  return (
    <div className={cn('min-w-0', wide ? 'flex flex-wrap items-baseline gap-x-3 gap-y-1' : 'flex flex-col gap-0.5')}>
      <span className={cn('font-display font-bold leading-tight', wide ? 'text-[19px]' : 'text-[17px]')}>{item.title}</span>
      <span className={cn('text-muted-foreground', wide ? 'text-[13px]' : 'text-[12.5px] leading-snug')}>{item.sub}</span>
    </div>
  );
}

function ItemFigures({ item, wide }: { item: PendingItemView; wide: boolean }) {
  return (
    <div className={cn('flex shrink-0 flex-col items-end', wide ? 'w-[150px] gap-2' : 'gap-1.5')}>
      <span className={cn('whitespace-nowrap font-bold', wide ? 'text-lg' : 'text-[15px]')}>{item.amountLabel}</span>
      <span
        className={cn(
          'inline-flex items-center whitespace-nowrap rounded-full border-[1.5px] border-dashed border-foreground/50 font-bold',
          wide ? 'h-6 px-2.5 text-xs' : 'h-[22px] px-2 text-[11.5px]',
        )}
      >
        {item.badge}
      </span>
    </div>
  );
}

/** Texto de acreditación y acciones de una fila; iguales en móvil y escritorio. */
function ItemBody({ item, payingOrderId, onPayNow }: { item: PendingItemView } & RowActions) {
  return (
    <>
      <p className="m-0 text-[13px] leading-snug">{item.note}</p>
      <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1">
        {item.payNowOrderId !== null && (
          <button
            type="button"
            aria-label={item.payNowLabel}
            disabled={payingOrderId === item.payNowOrderId}
            onClick={() => onPayNow(item.payNowOrderId as number)}
            className="inline-flex h-11 items-center rounded-md bg-primary-deep px-4 text-[13px] font-bold uppercase tracking-brand text-primary-foreground disabled:opacity-60"
          >
            Pagar ahora
          </button>
        )}
        <Link to={item.statusHref} className={ACTION_LINK}>
          Ver estado del pago
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        {item.orderHref && (
          <Link to={item.orderHref} className={ACTION_LINK}>
            Ver pedido
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </>
  );
}
