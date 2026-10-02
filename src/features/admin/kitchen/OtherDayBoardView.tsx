import type { ReactNode } from 'react';
import { ClipboardList, Clock } from 'lucide-react';
import type { DayOption, DayOrder, DishSummary } from './dashboardDay';
import { CountBadge, Items, OrderNote } from './KitchenBoardView';

interface OtherDayBoardViewProps {
  day: DayOption;
  orders: DayOrder[];
  summary: DishSummary;
  leadMinutes: number;
  onBackToToday: () => void;
}

const EMPTY_HINT: Record<DayOption['status'], string> = {
  open: 'Todavía no hay pedidos para ese día. Los que lleguen van a aparecer acá.',
  closed: 'Ese día el local está cerrado, así que no se reciben pedidos.',
  disabled: 'Esa fecha está deshabilitada, así que no se reciben pedidos.',
};

function dayNote(day: DayOption, hasOrders: boolean): string | null {
  if (day.status === 'open') return null;
  const base =
    day.status === 'closed'
      ? 'Día cerrado: no se reciben pedidos nuevos.'
      : `Fecha deshabilitada.${day.motivo ? ` Motivo: ${day.motivo}` : ''}`;
  return hasOrders ? `${base} Los pedidos que ya existen siguen activos.` : base;
}

function DishesBox({ day, summary }: Pick<OtherDayBoardViewProps, 'day' | 'summary'>) {
  return (
    <section
      aria-labelledby="od-dishes"
      className="flex min-w-0 flex-[1_1_340px] flex-col gap-4 rounded-md border border-border bg-card p-5 lg:max-w-[400px]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-[18px] w-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />
          <h2 id="od-dishes" className="text-[13px] font-bold uppercase tracking-brand">
            Platos del día · {day.longLabel}
          </h2>
        </div>
        <span className="rounded-full bg-primary-deep px-3 py-1 text-xs font-bold text-primary-foreground">
          {summary.total === 1 ? '1 plato' : `${summary.total} platos`}
        </span>
      </div>
      <ul className="flex flex-col">
        {summary.dishes.map((dish) => (
          <li key={dish.name} className="flex items-baseline gap-3 border-t border-border py-2.5 first:border-t-0 first:pt-0">
            <span className="min-w-[3rem] font-display text-3xl font-bold leading-none">{dish.count} ×</span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[17px] font-semibold leading-snug">{dish.name}</span>
              <span className="text-[13px] text-muted-foreground">{dish.breakdown}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ScheduledDayBox({ day, orders, leadMinutes }: Omit<OtherDayBoardViewProps, 'summary' | 'onBackToToday'>) {
  return (
    <section
      aria-labelledby="od-scheduled"
      className="flex min-w-0 flex-[2_1_420px] flex-col gap-3 rounded-md border border-warning/40 bg-warning/15 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          <Clock className="h-[18px] w-[18px] shrink-0 text-warning-foreground" aria-hidden="true" />
          <h2 id="od-scheduled" className="text-[13px] font-bold uppercase tracking-brand">
            Pedidos programados · {day.longLabel}
          </h2>
          <CountBadge n={orders.length} className="h-[26px] bg-warning-foreground text-[13px]" />
        </div>
        <span className="text-xs text-muted-foreground">
          ese día pasan a confirmados {leadMinutes} min antes de cada retiro
        </span>
      </div>
      {orders.length === 0 ? (
        <div className="flex flex-col gap-1 rounded-md border border-dashed border-warning/50 p-4 text-center">
          <p className="text-base font-semibold">No hay pedidos programados para el {day.longLabel}</p>
          <p className="text-sm text-muted-foreground">{EMPTY_HINT[day.status]}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {orders.map((o) => (
            <li key={o.id} className="grid grid-cols-[64px_minmax(0,1fr)] items-baseline gap-4 rounded bg-card/70 px-3.5 py-2.5">
              <span className="text-[17px] font-bold">{o.pickupLabel}</span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">
                  N° {o.id} · {o.customerNickname}
                </span>
                <Items order={o} className="text-[15px] font-semibold leading-snug" badgeClassName="bg-warning-foreground" />
                <OrderNote notas={o.notas} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Presentational: a read-only look at another day, the dish totals next to its scheduled orders. */
export function OtherDayBoardView({ day, orders, summary, leadMinutes, onBackToToday }: OtherDayBoardViewProps): ReactNode {
  const note = dayNote(day, orders.length > 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-foreground/30 bg-card px-4 py-2.5">
          <p className="text-sm">
            Estás viendo el <strong className="font-bold">{day.longLabel}</strong> · no es hoy · solo lectura
          </p>
          <button
            type="button"
            onClick={onBackToToday}
            className="min-h-[44px] px-1 text-sm font-semibold text-primary-deep underline-offset-2 hover:underline"
          >
            Volver a hoy
          </button>
        </div>
        {note && <p className="px-1 text-[13px] text-muted-foreground">{note}</p>}
      </div>
      <div className="flex flex-wrap items-start gap-6">
        {orders.length > 0 && <DishesBox day={day} summary={summary} />}
        <ScheduledDayBox day={day} orders={orders} leadMinutes={leadMinutes} />
      </div>
    </div>
  );
}
