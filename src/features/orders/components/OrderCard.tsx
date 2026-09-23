import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatLunches } from '../lunches';
import { OrderStatusBadge } from './OrderStatusBadge';
import type { OrderV2 } from '../services/ordersApi';

interface Props {
  order: OrderV2;
  cancelling: boolean;
  onCancel: () => void;
}

function formatPickupDate(iso: string): string {
  const formatted = new Date(iso).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatPickupTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Presentacional puro: una tarjeta de "Mis pedidos". La acción de cancelar
 * se ofrece ÚNICAMENTE cuando `order.cancellable` es `true` — ese valor
 * viene siempre del backend (`OrderPlacementService.isCancellable`, misma
 * regla que `cancel()`), el frontend nunca recalcula la ventana de
 * cancelación en base a `pickupAt`.
 */
export function OrderCard({ order, cancelling, onCancel }: Props) {
  return (
    // data-testid: la tarjeta y sus ítems son ambos <li>, así que el rol
    // "listitem" no alcanza para distinguir un pedido de sus platos.
    <li data-testid="order-card">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <p className="text-sm font-semibold text-foreground">{formatPickupDate(order.pickupAt)}</p>
            <p className="text-xs text-muted-foreground">Retiro {formatPickupTime(order.pickupAt)}</p>
          </div>
          <OrderStatusBadge estado={order.estado} />
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-1">
            {order.items.map((item) => (
              <li key={item.id} className="text-sm text-foreground">
                {item.dishNombre}
                {item.sideNombre && (
                  <span className="text-muted-foreground"> · {item.sideNombre.toLowerCase()}</span>
                )}
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-sm font-semibold uppercase tracking-brand">Total</span>
            <span className="text-sm font-bold text-foreground">{formatLunches(order.creditTotal)}</span>
          </div>

          {order.cancellable && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={cancelling}
                  className="w-full uppercase tracking-brand font-medium text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  {cancelling ? 'Cancelando…' : 'Cancelar pedido'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Cancelar pedido?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tus almuerzos comprometidos vuelven a estar disponibles.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={cancelling} className="uppercase tracking-brand text-xs">
                    No, dejarlo
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={cancelling}
                    onClick={(e) => {
                      // Mantenemos el dialog abierto hasta que termine la mutation;
                      // si la API falla, el usuario ve el error en lugar de un
                      // dialog que se cierra y "no hace nada".
                      e.preventDefault();
                      onCancel();
                    }}
                    className="uppercase tracking-brand text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {cancelling ? 'Cancelando…' : 'Sí, cancelar'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardContent>
      </Card>
    </li>
  );
}
