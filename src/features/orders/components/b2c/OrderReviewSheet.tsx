import { Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetTitle } from '@/components/ui/sheet';
import { CartSummary } from '../CartSummary';
import { PickupTimePicker } from './PickupTimePicker';
import { formatLunches } from '../../lunches';
import type { CartLine } from '../../hooks/useCart';

interface Props {
  open: boolean;
  onClose: () => void;
  isToday: boolean;
  dayShortLabel: string;
  fecha: string;
  lastUsedTimeOfDay: string | null;
  onSelectPickup: (pickupAt: string) => void;
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
            />
          </div>

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
