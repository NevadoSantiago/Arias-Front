import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Mail, X } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { AffectedOrder } from '@/features/admin/services/adminApi';

interface Props {
  /** Nombre de la entidad para mostrar en el dialog (ej: "Tira de Asado") */
  itemName: string;
  /** Loader de la lista de pedidos afectados — null cuando dialog cerrado */
  fetchAffected: () => Promise<AffectedOrder[]>;
  /** Key única para el cache de TanStack (ej: ['dishAffected', dishId]) */
  queryKey: readonly unknown[];
  /** Callback al confirmar. cancelOrders = true → cancelar todos. */
  onConfirm: (cancelOrders: boolean) => void;
  /** Si false, oculta la opción de cancelar (sides → solo notify). */
  allowCancel?: boolean;
  /** Trigger custom (botón en la tabla, etc.) */
  trigger: React.ReactNode;
}

/**
 * Dialog rico para desactivar un plato o side:
 *  - Fetch lazy de los pedidos afectados (solo al abrir)
 *  - Si 0 afectados → confirmación simple
 *  - Si >0 afectados → muestra lista + opciones (notificar / cancelar)
 */
export function DisableWithOrdersDialog({
  itemName, fetchAffected, queryKey, onConfirm, allowCancel = true, trigger,
}: Props) {
  const [open, setOpen] = useState(false);

  const { data: affected, isLoading } = useQuery({
    queryKey,
    queryFn: fetchAffected,
    enabled: open, // solo cargar cuando dialog abre
    staleTime: 0,  // siempre fetch fresco
  });

  const count = affected?.length ?? 0;
  const hasAffected = count > 0;

  const handleAction = (cancelOrders: boolean) => {
    onConfirm(cancelOrders);
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>

      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl">
            ¿Desactivar {itemName}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed">
            No va a aparecer más en el menú del empleado. Lo podés reactivar cuando quieras.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Estado de carga */}
        {isLoading && (
          <div className="py-4 flex items-center justify-center gap-2 text-xs uppercase tracking-brand text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Buscando pedidos afectados…
          </div>
        )}

        {/* Bloque de pedidos afectados */}
        {!isLoading && hasAffected && (
          <div className="my-2 p-3 rounded-md border border-warning/40 bg-warning/5">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs uppercase tracking-brand text-foreground font-semibold">
                {count} {count === 1 ? 'pedido pendiente' : 'pedidos pendientes'} de hoy {count === 1 ? 'lo tiene' : 'lo tienen'}
              </p>
            </div>
            <ul className={cn(
              'space-y-1.5 text-xs',
              count > 5 && 'max-h-[150px] overflow-y-auto pr-1'
            )}>
              {affected!.map((a) => (
                <li key={a.orderId} className="flex items-baseline justify-between gap-2">
                  <span className="text-foreground">
                    {a.userFirstName ?? '(sin nombre)'} {a.userLastName ?? ''}
                  </span>
                  <span className="text-[10px] text-muted-foreground italic">{a.companyName}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {/* Caso 1: sin afectados → confirm simple */}
          {!isLoading && !hasAffected && (
            <>
              <AlertDialogCancel className="uppercase tracking-brand text-xs mt-0">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleAction(false)}
                className="uppercase tracking-brand text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Sí, desactivar
              </AlertDialogAction>
            </>
          )}

          {/* Caso 2: con afectados → opciones */}
          {!isLoading && hasAffected && (
            <>
              <AlertDialogAction
                onClick={() => handleAction(false)}
                className="w-full uppercase tracking-brand text-xs justify-start"
              >
                <Mail className="w-3.5 h-3.5 mr-2" />
                Notificar y mantener pedidos
              </AlertDialogAction>
              {allowCancel && (
                <AlertDialogAction
                  onClick={() => handleAction(true)}
                  className="w-full uppercase tracking-brand text-xs justify-start bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <X className="w-3.5 h-3.5 mr-2" />
                  Cancelar {count === 1 ? 'el pedido' : 'los pedidos'} (devuelve stock)
                </AlertDialogAction>
              )}
              <AlertDialogCancel className="w-full uppercase tracking-brand text-xs mt-0">
                Volver atrás
              </AlertDialogCancel>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
