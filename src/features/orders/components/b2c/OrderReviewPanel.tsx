import { CartSummary } from '../CartSummary';
import { PickupTimePicker } from './PickupTimePicker';
import { BalanceBox, PickupNotices, pickupDayLabel } from './OrderReviewParts';
import type { ReactNode } from 'react';
import type { OrderReviewProps } from './orderReviewProps';

interface PanelProps extends OrderReviewProps {
  /**
   * Contenido decorativo bajo el panel, dentro de la misma columna fija (la
   * ilustración del día). Sin él el panel se comporta como siempre.
   */
  below?: ReactNode;
}

/**
 * Panel fijo "Tu pedido" del escritorio (F22a, prototipo `DesktopOrder.dc.html`,
 * tablero v20). Reemplaza en pantallas anchas a la barra inferior + la hoja de
 * revisión (`CartBar`/`OrderReviewSheet`): mismos datos, mismos handlers, otro
 * layout — carrito con "quitar", el MISMO selector de horario y los mismos
 * avisos del día (F21), el cálculo de saldo ("Te quedan" / "Te faltan N") y el
 * botón de confirmar. El saldo insuficiente lo decide siempre el servidor.
 */
export function OrderReviewPanel({
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
  below,
}: PanelProps) {
  const dayLabel = pickupDayLabel(isToday, dayShortLabel);
  const empty = lines.length === 0;

  const panel = (
    <aside
      aria-label="Tu pedido"
      className={
        below
          ? 'flex max-h-[calc(100vh-3rem-300px)] min-h-[360px] flex-col overflow-hidden rounded-xl border border-border bg-card'
          : 'sticky top-6 flex max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-xl border border-border bg-card'
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-[22px] pb-4 pt-5">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 font-display text-[26px] font-bold leading-tight text-foreground">Tu pedido</h2>
          <span className="text-[13.5px] text-muted-foreground">{dayLabel}</span>
        </div>

        {empty ? (
          <p className="m-0 rounded-[10px] border-[1.5px] border-dashed border-border px-[18px] py-[26px] text-center text-sm leading-snug text-muted-foreground">
            Elegí un plato del menú para armar tu pedido. Podés sumar más de uno.
          </p>
        ) : (
          <>
            <CartSummary
              lines={lines}
              onRemove={onRemoveLine}
              insufficientBalance={insufficientBalance}
            />

            <div data-tour="picker" className="flex flex-col gap-2">
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

            <BalanceBox walletAvailable={walletAvailable} totalLunches={totalLunches} missingNotice />

            {submitError && (
              <p role="alert" className="text-xs text-destructive">
                {submitError}
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex flex-none flex-col gap-2 border-t border-border bg-card px-[22px] pb-5 pt-4">
        <button
          type="button"
          onClick={onConfirm}
          data-tour="confirm"
          disabled={!canConfirm || empty}
          className="h-[54px] w-full rounded-md bg-primary-deep text-sm font-bold uppercase tracking-brand text-primary-foreground disabled:cursor-not-allowed disabled:border disabled:border-dashed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
        >
          {submitting ? 'Confirmando…' : confirmLabel}
        </button>
        {empty && (
          <span className="text-center text-[12.5px] text-muted-foreground">Agregá al menos un plato para confirmar.</span>
        )}
      </div>
    </aside>
  );

  if (!below) return panel;
  return (
    <div className="sticky top-6 flex flex-col gap-5">
      {panel}
      {below}
    </div>
  );
}
