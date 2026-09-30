import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetTitle } from '@/components/ui/sheet';
import { formatLunches } from '../lunches';
import type { OrderItemV2, OrderV2 } from '../services/ordersApi';

export interface RemoveOrderItemTarget {
  order: OrderV2;
  item: OrderItemV2;
}

interface Props {
  target: RemoveOrderItemTarget | null;
  removing: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onClose: () => void;
  /** `sheet` (default): hoja anclada abajo, la móvil. `dialog`: centrada, para escritorio (F29). */
  presentation?: 'sheet' | 'dialog';
}

/**
 * Hoja de confirmación de "Quitar plato" (F16, pedido del usuario:
 * "agregar un modal de confirmación antes de sacar un plato"). Solo se
 * ofrece por plato de un pedido modificable (`order.cancellable`, ver la
 * "×" en `OrderCard`) — el backend libera el almuerzo del ítem
 * (`DELETE /api/v2/orders/{id}/items/{itemId}`), y si era el único plato el
 * pedido entero queda cancelado, lo que esta hoja avisa de antemano. Mismo
 * patrón que `CancelOrderSheet`: no se cierra sola (Escape ni overlay)
 * mientras la eliminación está en curso.
 */
export function RemoveOrderItemSheet({
  target,
  removing,
  errorMessage,
  onConfirm,
  onClose,
  presentation = 'sheet',
}: Props) {
  const open = target !== null;
  const isOnlyItem = target ? target.order.items.length === 1 : false;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && !removing && onClose()}>
      <SheetContent aria-label="Quitar plato" className="p-0" variant={presentation}>
        <div className="flex flex-col gap-4 p-4">
          <SheetTitle>{target ? `¿Quitar ${target.item.dishNombre} de tu pedido?` : ''}</SheetTitle>
          <SheetDescription className="sr-only">
            Confirmá si querés quitar este plato de tu pedido. El almuerzo vuelve a tu saldo.
          </SheetDescription>

          {target && (
            <p className="m-0 text-sm text-foreground">
              Vuelve {formatLunches(target.item.creditCost)} a tu saldo
            </p>
          )}

          {isOnlyItem && (
            <p className="m-0 text-sm font-semibold text-destructive">
              Es el único plato: se cancela el pedido.
            </p>
          )}

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
            disabled={removing}
            className="h-[54px] w-full rounded-md bg-destructive text-sm font-bold uppercase tracking-brand text-destructive-foreground disabled:opacity-70"
          >
            {removing ? 'Quitando…' : 'Sí, quitar'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={removing}
            className="h-[52px] w-full rounded-md border border-border bg-card text-sm font-semibold text-foreground disabled:opacity-70"
          >
            No
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
