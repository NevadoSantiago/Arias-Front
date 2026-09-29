import { Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetTitle } from '@/components/ui/sheet';
import { CartSummary } from '../CartSummary';
import { PickupTimePicker } from './PickupTimePicker';
import { BalanceBox, PickupNotices } from './OrderReviewParts';
import type { CartLine } from '../../hooks/useCart';

export interface OrderReviewProps {
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

interface Props extends OrderReviewProps {
  open: boolean;
  onClose: () => void;
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

          <PickupNotices
            addToOrder={addToOrder}
            newOrderNotice={newOrderNotice}
            pickupTimeLabel={pickupTimeLabel}
            onJoinOrder={onJoinOrder}
          />

          <BalanceBox walletAvailable={walletAvailable} totalLunches={totalLunches} />

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
