import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { OtherDayBoardView } from '@/features/admin/kitchen/OtherDayBoardView';
import { useDashboardDay } from '@/features/admin/kitchen/useDashboardDay';
import { CancelledNotice } from '@/features/admin/kitchen/CancelledNotice';
import { KitchenBoardView } from '@/features/admin/kitchen/KitchenBoardView';
import { formatMinute, minuteOfDay } from '@/features/admin/kitchen/kitchenBoard';
import { useCancelledOrders } from '@/features/admin/kitchen/useCancelledOrders';
import { PrintAgentPill } from '@/features/admin/kitchen/PrintAgentPill';
import { UNDO_OTHER_MS, useKitchenBoard } from '@/features/admin/kitchen/useKitchenBoard';
import { usePrintAgentStatus } from '@/features/admin/printing/usePrintAgentStatus';

/**
 * Kitchen dashboard: today's B2C orders (table `orders`, direct pickup) split by kitchen state.
 * Container only: data, clock and actions live in `useKitchenBoard`, the boxes in `KitchenBoardView`.
 * The day select (`useDashboardDay`) swaps the board for a read-only look at another day.
 */
export function AdminOrdersByPickupPage() {
  const day = useDashboardDay();
  const kitchen = useKitchenBoard({ enabled: day.isToday });
  const cancelled = useCancelledOrders({ fecha: day.selected.date, enabled: day.isToday });
  const agent = usePrintAgentStatus();
  const { board, undo } = kitchen;
  const otherDay = !day.isToday && !day.isPending;
  const fetching = otherDay ? day.isFetching : kitchen.isFetching;
  const refetch = otherDay
    ? day.refetch
    : () => {
        kitchen.refetch();
        cancelled.refetch();
      };
  const loading = otherDay ? day.isLoading : kitchen.isLoading || (day.isPending && !kitchen.isError);
  const failed = kitchen.isError || (otherDay && day.isError);

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
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          <PrintAgentPill status={agent.data} queued={kitchen.queuedCount} now={kitchen.now} />
          <div className="flex items-center gap-2">
            <label htmlFor="dashboard-day" className="text-[11px] font-semibold uppercase tracking-brand text-muted-foreground">
              Día
            </label>
            <select
              id="dashboard-day"
              value={day.selected.date}
              onChange={(e) => day.select(e.target.value)}
              className={cn(
                'min-h-[44px] w-[200px] rounded-md bg-card px-3 text-sm font-medium text-foreground',
                day.isToday ? 'border border-input' : 'border-2 border-primary-deep',
              )}
            >
              {day.options.map((o) => (
                <option key={o.date} value={o.date}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px] uppercase tracking-brand text-[11px]"
            disabled={fetching}
            onClick={refetch}
          >
            <RefreshCw className={cn('mr-1 h-3.5 w-3.5', fetching && 'animate-spin')} />
            Actualizar
          </Button>
        </div>
      </header>

      <div aria-live="polite" className="sticky top-0 z-10 mb-4 empty:hidden">
        {!otherDay && undo && (
          <div className="relative flex items-center justify-center gap-4 overflow-hidden rounded-md bg-foreground px-4 text-background shadow-md">
            <span className="text-sm font-medium">{undo.message}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[13px] tabular-nums opacity-80">
              {`${undo.secondsLeft} s para deshacer`}
            </span>
            <button
              type="button"
              disabled={kitchen.busy}
              onClick={kitchen.runUndo}
              className="min-h-[44px] px-3 text-xs font-bold uppercase tracking-brand text-warning hover:underline disabled:opacity-60"
            >
              Deshacer
            </button>
            <span
              aria-hidden="true"
              className="absolute bottom-0 left-0 h-[3px] bg-warning transition-[width] duration-1000 ease-linear"
              style={{
                width: `${(undo.secondsLeft * 1000 / UNDO_OTHER_MS) * 100}%`,
              }}
            />
          </div>
        )}
      </div>

      <div aria-live="polite" className="mb-4 flex flex-col gap-3 empty:hidden">
        {!otherDay &&
          cancelled.notices.map((notice) => (
            <CancelledNotice
              key={notice.id}
              order={notice}
              onShow={cancelled.showCancelled}
              onDismiss={() => cancelled.dismissNotice(notice.id)}
            />
          ))}
      </div>

      {loading && (
        <p className="py-12 text-center text-sm uppercase tracking-brand text-muted-foreground">Cargando…</p>
      )}

      {failed && !loading && (
        <p role="alert" className="py-12 text-center text-sm text-destructive">
          No se pudieron cargar los pedidos. Probá con Actualizar.
        </p>
      )}

      {otherDay && !loading && !failed && (
        <OtherDayBoardView
          day={day.selected}
          orders={day.orders}
          summary={day.summary}
          leadMinutes={kitchen.leadMinutes}
          onBackToToday={day.backToToday}
        />
      )}

      {!otherDay && board && (
        <KitchenBoardView
          board={board}
          leadMinutes={kitchen.leadMinutes}
          busy={kitchen.busy}
          timezone={kitchen.timezone}
          agentOnline={agent.data?.online}
          reprinted={kitchen.reprinted}
          onReprint={kitchen.reprint}
          onComandar={kitchen.comandar}
          onEntregar={kitchen.entregar}
          cancelled={cancelled.orders}
          cancelledOpen={cancelled.open}
          onCancelledOpenChange={cancelled.setOpen}
        />
      )}
    </div>
  );
}
