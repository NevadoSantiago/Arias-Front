import { useQuery } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetTitle } from '@/components/ui/sheet';
import { getWallet } from '@/features/credits/services/creditsApi';
import { cn } from '@/lib/utils';
import { balancePartOf, formatLunches, mercadoPagoPartOf, pendingPaymentCreditedNotice } from '../lunches';
import { formatOrderDayLabel, formatOrderTimeLabel } from './orderDateLabels';
import type { OrderV2 } from '../services/ordersApi';

interface Props {
  order: OrderV2 | null;
  now: Date;
  cancelling: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onClose: () => void;
  /** `sheet` (default): hoja anclada abajo, la móvil. `dialog`: centrada, para escritorio (F22b). */
  presentation?: 'sheet' | 'dialog';
}

/**
 * Hoja de confirmación de "Cancelar pedido" (F10, prototipo
 * `MyOrders.dc.html`). El saldo mostrado ("Pasás de X a Y almuerzos
 * disponibles") es SOLO informativo — viene de la billetera (misma clave
 * de caché `creditsWallet` que `useWallet`) y nunca decide si el pedido se
 * puede cancelar; eso lo decide siempre `order.cancellable`, del backend.
 * La consulta de la billetera solo se activa mientras la hoja está
 * abierta, para no pedirla en cada carga de "Mis pedidos".
 */
export function CancelOrderSheet({ order, now, cancelling, errorMessage, onConfirm, onClose, presentation = 'sheet' }: Props) {
  const open = order !== null;

  const { data: wallet } = useQuery({
    queryKey: ['creditsWallet'],
    queryFn: getWallet,
    enabled: open,
  });

  const dayLabel = order ? formatOrderDayLabel(order.pickupAt, now) : '';
  const timeLabel = order ? formatOrderTimeLabel(order.pickupAt) : '';
  const itemsLabel = order
    ? order.items
        .map((item) => item.dishNombre + (item.sideNombre ? ` · ${item.sideNombre.toLowerCase()}` : ''))
        .join(' + ')
    : '';
  // Un pedido esperando el pago con Mercado Pago no usó almuerzos del saldo,
  // salvo los que ya reservó por un pago parcial (F23): esos vuelven al cancelar.
  const awaitingPayment = order?.estado === 'PENDIENTE_PAGO';
  const reserved = order ? balancePartOf(order) : 0;
  const lunchCount = awaitingPayment ? reserved : (order?.creditTotal ?? 0);
  const unpaid = awaitingPayment && reserved === 0;
  const returnTitle = unpaid
    ? 'Tu saldo no cambia'
    : awaitingPayment
      ? lunchCount === 1
        ? 'Tu almuerzo reservado vuelve a tu saldo'
        : `Tus ${lunchCount} almuerzos reservados vuelven a tu saldo`
      : lunchCount === 1
        ? 'Tu almuerzo vuelve a tu saldo'
        : `Tus ${formatLunches(lunchCount)} vuelven a tu saldo`;
  // F26: si el cliente ya pagó y Mercado Pago aún no lo confirmó, el pago se acredita al saldo.
  const mpLunches = order ? mercadoPagoPartOf(order) : 0;
  const creditedNotice = pendingPaymentCreditedNotice(mpLunches);
  const available = wallet?.available ?? null;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && !cancelling && onClose()}>
      <SheetContent aria-label="Cancelar pedido" className="p-0" variant={presentation}>
        <div className="flex flex-col gap-4 p-4">
          <SheetTitle>¿Cancelar este pedido?</SheetTitle>
          <SheetDescription className="sr-only">
            {unpaid
              ? 'Confirmá si querés cancelar este pedido. Tu saldo no cambia.'
              : 'Confirmá si querés cancelar este pedido. Tu almuerzo vuelve a tu saldo.'}
          </SheetDescription>

          <div className="rounded-md border border-border bg-muted/40 p-3.5">
            <p className="m-0 text-[15px] font-bold text-foreground">
              {dayLabel} · {timeLabel} hs
            </p>
            <p className="m-0 text-[13.5px] text-muted-foreground">{itemsLabel}</p>
          </div>

          <div className={cn('flex items-center gap-3 rounded-md p-3.5', unpaid ? 'bg-muted' : 'bg-success/15')}>
            <RotateCcw className={cn('h-6 w-6 shrink-0', unpaid ? 'text-foreground' : 'text-success')} aria-hidden="true" />
            <div className="flex flex-col gap-0.5 text-sm">
              <span className="font-bold text-foreground">{returnTitle}</span>
              {unpaid && (
                <span className="text-foreground">
                  Este pedido se iba a pagar con Mercado Pago y no usó almuerzos de tu saldo. Se libera la reserva del
                  plato.
                </span>
              )}
              {!unpaid && available !== null && (
                <span className="text-foreground">Pasás de {available} a {available + lunchCount} almuerzos disponibles.</span>
              )}
              {awaitingPayment && mpLunches > 0 && <span className="text-foreground">{creditedNotice}</span>}
            </div>
          </div>

          {errorMessage && (
            <p role="alert" className="text-xs text-destructive">
              {errorMessage}
            </p>
          )}
        </div>
        <SheetFooter>
          <button
            type="button"
            onClick={onConfirm}
            disabled={cancelling}
            className="h-[54px] w-full rounded-md bg-destructive text-sm font-bold uppercase tracking-brand text-destructive-foreground disabled:opacity-70"
          >
            {cancelling ? 'Cancelando…' : 'Sí, cancelar pedido'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={cancelling}
            className="h-[52px] w-full rounded-md border border-border bg-card text-sm font-semibold text-foreground disabled:opacity-70"
          >
            No, dejarlo
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
