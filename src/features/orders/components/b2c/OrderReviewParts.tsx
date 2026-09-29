import { Link } from 'react-router-dom';
import { formatLunches } from '../../lunches';
import { formatOrderTimeLabel } from '../orderDateLabels';
import type { OrderReviewProps } from './OrderReviewSheet';

/**
 * Avisos de horario de la revisión del pedido (F16, F21): "Se agrega a tu
 * pedido de las HH:MM" o "Nuevo pedido a las HH:MM". Los comparten la hoja
 * móvil y el panel de escritorio: un solo texto, un solo lugar.
 */
export function PickupNotices({
  addToOrder,
  newOrderNotice,
  pickupTimeLabel,
  onJoinOrder,
}: Pick<OrderReviewProps, 'addToOrder' | 'newOrderNotice' | 'pickupTimeLabel' | 'onJoinOrder'>) {
  return (
    <>
      {addToOrder && (
        <div role="status" className="flex flex-col gap-0.5 rounded-lg border-[1.5px] border-success bg-success/10 px-3.5 py-3">
          <strong className="text-sm font-bold text-foreground">
            Se agrega a tu pedido de las {formatOrderTimeLabel(addToOrder.pickupAt)}
          </strong>
          <span className="text-[13px] leading-snug text-muted-foreground">Retirás todo junto.</span>
        </div>
      )}

      {!addToOrder && newOrderNotice && pickupTimeLabel && (
        <div role="status" className="flex flex-col gap-0.5 rounded-lg border-[1.5px] border-dashed border-border bg-card px-3.5 py-3">
          <strong className="text-sm font-bold text-foreground">Nuevo pedido a las {pickupTimeLabel}</strong>
          <span className="text-[13px] leading-snug text-muted-foreground">
            {newOrderNotice.lockedSamePickupAt
              ? `Tu pedido de las ${formatOrderTimeLabel(newOrderNotice.lockedSamePickupAt)} espera el pago, así que este va aparte.`
              : `Tu pedido de las ${newOrderNotice.otherPickupAts.map(formatOrderTimeLabel).join(' y de las ')} queda como está.`}
          </span>
          {newOrderNotice.joinablePickupAt && (
            <button
              type="button"
              onClick={() => onJoinOrder(newOrderNotice.joinablePickupAt!)}
              className="mt-0.5 flex min-h-11 w-fit items-center text-[13.5px] font-bold text-primary-deep underline underline-offset-2"
            >
              Sumarlo al pedido de las {formatOrderTimeLabel(newOrderNotice.joinablePickupAt)}
            </button>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Cálculo de saldo — solo informativo; el servidor decide siempre si alcanza.
 * En el panel de escritorio (`missingNotice`), si el pedido usa más de lo
 * disponible, dice "Te faltan N" y ofrece pagar solo este pedido o comprar un
 * paquete, en vez de un "Te quedan" negativo.
 */
export function BalanceBox({
  walletAvailable,
  totalLunches,
  missingNotice = false,
}: {
  walletAvailable: number | null;
  totalLunches: number;
  missingNotice?: boolean;
}) {
  if (walletAvailable === null) return null;
  const left = walletAvailable - totalLunches;

  if (missingNotice && left < 0) {
    return (
      <div className="flex flex-col gap-2 rounded-md border-[1.5px] border-warning bg-warning/20 p-3.5">
        <strong className="text-[15px] font-bold text-foreground">Te faltan {formatLunches(-left)}</strong>
        <span className="text-[13.5px] leading-snug text-foreground">
          Podés pagar solo este pedido con Mercado Pago, o comprar un paquete y ahorrar.
        </span>
        <Link to="/credits/packs" className="flex h-11 w-fit items-center text-[13.5px] font-bold text-primary-deep">
          Comprar almuerzos
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md bg-muted p-3.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Tenés disponibles</span>
        <span className="font-semibold text-foreground">{formatLunches(walletAvailable!)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Este pedido usa</span>
        <span className="font-semibold text-foreground">{formatLunches(totalLunches)}</span>
      </div>
      <div className="border-t border-border" />
      <div className="flex justify-between text-[15px] font-bold text-foreground">
        <span>Te quedan</span>
        <span>{formatLunches(left)}</span>
      </div>
    </div>
  );
}
