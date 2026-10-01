import { Bell, Check, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChefBackdrop, OrderComanda } from './OrderComanda';
import { formatComandaWhen, lowerFirst } from './comandaModel';
import type { ComandaFooter, ComandaItem } from './comandaModel';

interface Props {
  isToday: boolean;
  /** "Jueves 24 de septiembre" (capitalizado). */
  dayLongLabel: string;
  pickupTimeLabel: string;
  orderId: number;
  /** Nombre con el que la cocina llama al cliente (`AuthUser.displayName`). */
  callName: string;
  items: ComandaItem[];
  footer: ComandaFooter | null;
  /** El pedido se pagó con Mercado Pago: cambia el encabezado, la nota y el segundo botón. */
  paidWithMercadoPago?: boolean;
  /** Cantidad de platos SUMADOS a un pedido existente; null/ausente = pedido nuevo. */
  addedPlates?: number | null;
  onBackToMenu: () => void;
}

/**
 * Pantalla de confirmación B2C (F20, prototipo `Main.dc.html` escenarios
 * `done` y `doneDirect`, tablero v20): el chef de fondo y el pedido como
 * comanda (`OrderComanda`) con el nombre con el que se llama al cliente.
 * Reemplaza la vista tipo ticket de F4; el toast B2B `OrderConfirmation`
 * sigue sin cambios. También es donde termina "sumar platos" a un pedido
 * existente (`addedPlates`).
 */
export function OrderConfirmedView({
  isToday,
  dayLongLabel,
  pickupTimeLabel,
  orderId,
  callName,
  items,
  footer,
  paidWithMercadoPago = false,
  addedPlates = null,
  onBackToMenu,
}: Props) {
  const dayWhen = isToday ? 'hoy' : `el ${lowerFirst(dayLongLabel)}`;
  const isAddition = addedPlates !== null;
  const title = isAddition ? '¡Sumado a tu pedido!' : isToday ? '¡Pedido confirmado!' : '¡Pedido programado!';
  const headline = isAddition
    ? `Sumaste ${addedPlates === 1 ? '1 plato' : `${addedPlates} platos`} a tu pedido ${isToday ? 'de hoy' : `del ${lowerFirst(dayLongLabel)}`} a las ${pickupTimeLabel}.`
    : `${paidWithMercadoPago ? 'Mercado Pago aprobó el pago. ' : ''}Te esperamos ${dayWhen} a las ${pickupTimeLabel}.`;
  const whenLabel = formatComandaWhen({ dateLabel: dayLongLabel, isToday, timeLabel: pickupTimeLabel });

  return (
    <ChefBackdrop>
      <div className="flex flex-col gap-3 px-4 pb-4 pt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_480px] lg:grid-rows-[auto_auto_1fr] lg:gap-x-[72px] lg:gap-y-6 lg:px-0 lg:pt-6">
        <div className="flex items-center gap-2.5 lg:col-start-1 lg:flex-col lg:items-start lg:gap-[22px]">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground lg:h-[72px] lg:w-[72px]"
          >
            <Check className="h-5 w-5 lg:h-9 lg:w-9" strokeWidth={2.6} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5 lg:gap-2">
            <h1 className="m-0 font-display text-[21px] font-bold leading-[1.1] text-foreground lg:text-[46px]">{title}</h1>
            <span className="text-[13px] leading-snug text-muted-foreground lg:text-base">{headline}</span>
          </span>
        </div>

        <div className="lg:col-start-2 lg:row-span-3 lg:row-start-1">
          <OrderComanda
            orderId={orderId}
            dateLabel={dayLongLabel}
            callName={callName}
            whenLabel={whenLabel}
            items={items}
            footer={footer}
          />
        </div>

        <ul className="m-0 mt-0.5 flex list-none flex-col gap-1.5 p-0 lg:col-start-1 lg:mt-0">
          <li className="flex items-start gap-2 text-[13px] leading-snug text-foreground">
            <Bell className="mt-px h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>Te avisamos 25 minutos antes del horario de retiro.</span>
          </li>
          {!paidWithMercadoPago && (
            <li className="flex items-start gap-2 text-[13px] leading-snug text-foreground">
              <RotateCcw className="mt-px h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>Si cancelás el pedido, el almuerzo vuelve a tu saldo.</span>
            </li>
          )}
        </ul>

        <div className="grid grid-cols-2 gap-2 lg:col-start-1 lg:flex lg:max-w-sm lg:flex-col lg:gap-2.5">
          <button
            type="button"
            onClick={onBackToMenu}
            className="h-[52px] rounded-md bg-primary-deep text-sm font-bold uppercase tracking-brand text-primary-foreground"
          >
            Volver al menú
          </button>
          <Link
            to={paidWithMercadoPago ? '/orders/mine' : '/credits'}
            className="flex h-[52px] items-center justify-center rounded-md border border-border bg-card text-sm font-semibold text-foreground no-underline"
          >
            {paidWithMercadoPago ? 'Ver mis pedidos' : 'Ver mis almuerzos'}
          </Link>
        </div>
      </div>
    </ChefBackdrop>
  );
}
