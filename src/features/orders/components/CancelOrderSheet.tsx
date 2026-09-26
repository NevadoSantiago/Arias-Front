import { useQuery } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetTitle } from '@/components/ui/sheet';
import { getWallet } from '@/features/credits/services/creditsApi';
import { formatLunches } from '../lunches';
import { formatOrderDayLabel, formatOrderTimeLabel } from './orderDateLabels';
import type { OrderV2 } from '../services/ordersApi';

interface Props {
  order: OrderV2 | null;
  now: Date;
  cancelling: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onClose: () => void;
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
export function CancelOrderSheet({ order, now, cancelling, errorMessage, onConfirm, onClose }: Props) {
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
  const lunchCount = order?.creditTotal ?? 0;
  const returnTitle =
    lunchCount === 1 ? 'Tu almuerzo vuelve a tu saldo' : `Tus ${formatLunches(lunchCount)} vuelven a tu saldo`;
  const available = wallet?.available ?? null;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent aria-label="Cancelar pedido" className="p-0">
        <div className="flex flex-col gap-4 p-4">
          <SheetTitle>¿Cancelar este pedido?</SheetTitle>
          <SheetDescription className="sr-only">
            Confirmá si querés cancelar este pedido. Tu almuerzo vuelve a tu saldo.
          </SheetDescription>

          <div className="rounded-md border border-border bg-muted/40 p-3.5">
            <p className="m-0 text-[15px] font-bold text-foreground">
              {dayLabel} · {timeLabel} hs
            </p>
            <p className="m-0 text-[13.5px] text-muted-foreground">{itemsLabel}</p>
          </div>

          <div className="flex items-center gap-3 rounded-md bg-success/15 p-3.5">
            <RotateCcw className="h-6 w-6 shrink-0 text-success" aria-hidden="true" />
            <div className="flex flex-col gap-0.5 text-sm">
              <span className="font-bold text-foreground">{returnTitle}</span>
              {available !== null && (
                <span className="text-foreground">
                  Pasás de {available} a {available + lunchCount} almuerzos disponibles.
                </span>
              )}
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
