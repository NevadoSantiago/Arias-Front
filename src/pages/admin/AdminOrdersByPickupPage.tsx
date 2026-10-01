import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { KitchenBoardView } from '@/features/admin/kitchen/KitchenBoardView';
import { formatMinute, minuteOfDay } from '@/features/admin/kitchen/kitchenBoard';
import { useKitchenBoard } from '@/features/admin/kitchen/useKitchenBoard';

/**
 * Kitchen dashboard: today's B2C orders (table `orders`, direct pickup) split by kitchen state.
 * Container only: data, clock and actions live in `useKitchenBoard`, the boxes in `KitchenBoardView`.
 */
export function AdminOrdersByPickupPage() {
  const kitchen = useKitchenBoard();
  const { board } = kitchen;

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-brand text-muted-foreground">
            Hoy · {formatMinute(minuteOfDay(kitchen.now, kitchen.timezone))}
          </span>
          <h1 className="mb-1 font-display text-3xl font-bold leading-tight text-foreground lg:text-4xl">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">Pedidos de clientes con retiro en el local.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="min-h-[44px] self-start uppercase tracking-brand text-[11px] sm:self-auto"
          disabled={kitchen.isFetching}
          onClick={kitchen.refetch}
        >
          <RefreshCw className={cn('mr-1 h-3.5 w-3.5', kitchen.isFetching && 'animate-spin')} />
          Actualizar
        </Button>
      </header>

      <div aria-live="polite" className="sticky top-0 z-10 mb-4 empty:hidden">
        {kitchen.undo && (
          <div className="flex items-center justify-center gap-4 rounded-md bg-foreground px-4 text-background shadow-md">
            <span className="text-sm font-medium">{kitchen.undo.message}</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              disabled={kitchen.busy}
              onClick={kitchen.runUndo}
              className="min-h-[44px] px-3 text-xs font-bold uppercase tracking-brand text-warning hover:underline disabled:opacity-60"
            >
              Deshacer
            </button>
          </div>
        )}
      </div>

      {kitchen.isLoading && (
        <p className="py-12 text-center text-sm uppercase tracking-brand text-muted-foreground">Cargando…</p>
      )}

      {kitchen.isError && !kitchen.isLoading && (
        <p role="alert" className="py-12 text-center text-sm text-destructive">
          No se pudieron cargar los pedidos. Probá con Actualizar.
        </p>
      )}

      {board && (
        <KitchenBoardView
          board={board}
          leadMinutes={kitchen.leadMinutes}
          slotMinutes={kitchen.slotMinutes}
          busy={kitchen.busy}
          onComandar={kitchen.comandar}
          onEntregar={kitchen.entregar}
        />
      )}
    </div>
  );
}
