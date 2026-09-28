import { Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetTitle } from '@/components/ui/sheet';
import { CartSummary } from '../CartSummary';
import { PickupTimePicker } from './PickupTimePicker';
import { formatLunches } from '../../lunches';
import { formatOrderTimeLabel } from '../orderDateLabels';
import type { CartLine } from '../../hooks/useCart';

interface Props {
  open: boolean;
  onClose: () => void;
  isToday: boolean;
  dayShortLabel: string;
  fecha: string;
  lastUsedTimeOfDay: string | null;
  onSelectPickup: (pickupAt: string) => void;
  /**
   * Pedido modificable del día cuyo horario es IGUAL al elegido (F16, F21) —
   * cuando no es `null`, la hoja agrega el carrito a ESE pedido en vez de
   * armar uno nuevo, con el aviso "Se agrega a tu pedido de las HH:MM". El
   * selector de horario queda siempre visible. `B2cOrderPage` decide si hay
   * un pedido al que sumar — nunca esta hoja.
   */
  addToOrder: { pickupAt: string } | null;
  /** Horario elegido, "HH:MM" — para el título "Nuevo pedido a las HH:MM". `null` mientras cargan los horarios. */
  pickupTimeLabel: string | null;
  /**
   * Aviso de pedido NUEVO cuando el día ya tiene pedidos (F21); `null` si el
   * día no tiene pedidos o el carrito se suma a uno (`addToOrder`).
   * `otherPickupAts`: pedidos del día que quedan como están;
   * `lockedSamePickupAt`: el horario elegido coincide con un pedido NO
   * modificable (esperando pago o pagado aparte); `joinablePickupAt`: horario
   * de un pedido modificable al que el atajo permite volver.
   */
  newOrderNotice: {
    otherPickupAts: string[];
    lockedSamePickupAt: string | null;
    joinablePickupAt: string | null;
  } | null;
  /** Pedido de salto de horario para el selector (atajo "Sumarlo al pedido de las HH:MM"). */
  pickupJumpTo: { pickupAt: string } | null;
  onJoinOrder: (pickupAt: string) => void;
  lines: CartLine[];
  totalLunches: number;
  onRemoveLine: (localId: string) => void;
  /** Saldo disponible de la wallet — solo para mostrar el cálculo, nunca para decidir si se puede confirmar. */
  walletAvailable: number | null;
  confirmLabel: string;
  canConfirm: boolean;
  submitting: boolean;
  submitError: string | null;
  insufficientBalance: boolean;
  onConfirm: () => void;
}

/**
 * Hoja de revisión del pedido (F4, prototipo `Main.dc.html` — hoja de
 * revisión). Reúne el carrito, el horario de retiro y la confirmación en un
 * solo lugar en vez del bloque siempre visible de antes. El saldo insuficiente
 * SIEMPRE lo decide el servidor (`InsufficientCreditsError` en el padre); el
 * cálculo "Te quedan N" acá es solo informativo.
 */
export function OrderReviewSheet({
  open,
  onClose,
  isToday,
  dayShortLabel,
  fecha,
  lastUsedTimeOfDay,
  onSelectPickup,
  addToOrder,
  pickupTimeLabel,
  newOrderNotice,
  pickupJumpTo,
  onJoinOrder,
  lines,
  totalLunches,
  onRemoveLine,
  walletAvailable,
  confirmLabel,
  canConfirm,
  submitting,
  submitError,
  insufficientBalance,
  onConfirm,
}: Props) {
  const dayLabel = isToday ? `Para retirar hoy, ${dayShortLabel}` : `Pedido programado para el ${dayShortLabel}`;
  const left = walletAvailable !== null ? walletAvailable - totalLunches : null;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent aria-label="Tu pedido" className="p-0">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="flex flex-col gap-1">
            <SheetTitle>Tu pedido</SheetTitle>
            <SheetDescription className="sr-only">Revisá los platos, elegí el horario de retiro y confirmá tu pedido.</SheetDescription>
            <span className="text-sm text-muted-foreground">{dayLabel}</span>
          </div>

          <CartSummary
            lines={lines}
            totalCredits={totalLunches}
            onRemove={onRemoveLine}
            insufficientBalance={insufficientBalance}
          />

          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-fit items-center gap-1.5 px-1 text-sm font-bold text-primary-deep"
          >
            <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
            Agregar otro plato
          </button>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-brand text-muted-foreground">
              ¿A qué hora lo retirás?
            </span>
            <PickupTimePicker
              fecha={fecha}
              isToday={isToday}
              dayShortLabel={dayShortLabel}
              lastUsedTimeOfDay={lastUsedTimeOfDay}
              onSelect={onSelectPickup}
              jumpTo={pickupJumpTo}
            />
          </div>

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

          {left !== null && (
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
          )}

          {submitError && (
            <p role="alert" className="text-xs text-destructive">
              {submitError}
            </p>
          )}
        </div>
        <SheetFooter>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="h-[54px] w-full rounded-md bg-primary-deep text-sm font-bold uppercase tracking-brand text-primary-foreground disabled:cursor-not-allowed disabled:border disabled:border-dashed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
          >
            {submitting ? 'Confirmando…' : confirmLabel}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
