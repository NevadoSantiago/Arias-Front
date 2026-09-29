import { Bell, Check, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChefBackdrop, OrderComanda } from './OrderComanda';
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
  footer: ComandaFooter;
  /** El pedido se pagó con Mercado Pago: cambia el encabezado, la nota y el segundo botón. */
  paidWithMercadoPago?: boolean;
  /** Cantidad de platos SUMADOS a un pedido existente; null/ausente = pedido nuevo. */
  addedPlates?: number | null;
  onBackToMenu: () => void;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
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
  const whenLabel = `${isToday ? `Hoy, ${lowerFirst(dayLongLabel)}` : dayLongLabel} · ${pickupTimeLabel} hs`;

  return (
    <ChefBackdrop>
      <div className="flex flex-col gap-[18px] px-4 pb-7 pt-[18px]">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground"
          >
            <Check className="h-6 w-6" strokeWidth={2.6} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col gap-[3px]">
            <h1 className="m-0 font-display text-[25px] font-bold leading-[1.1] text-foreground">{title}</h1>
            <span className="text-sm leading-snug text-muted-foreground">{headline}</span>
          </span>
        </div>

        <OrderComanda
          orderId={orderId}
          dateLabel={dayLongLabel}
          callName={callName}
          whenLabel={whenLabel}
          items={items}
          footer={footer}
        />

        <ul className="m-0 mt-1.5 flex list-none flex-col gap-2.5 p-0">
          <li className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-foreground">
            <Bell className="mt-px h-[18px] w-[18px] shrink-0 text-primary" aria-hidden="true" />
            <span>Te avisamos 25 minutos antes del horario de retiro.</span>
          </li>
          {!paidWithMercadoPago && (
            <li className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-foreground">
              <RotateCcw className="mt-px h-[18px] w-[18px] shrink-0 text-primary" aria-hidden="true" />
              <span>Si cancelás el pedido, el almuerzo vuelve a tu saldo.</span>
            </li>
          )}
        </ul>

        <div className="flex flex-col gap-2.5">
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
