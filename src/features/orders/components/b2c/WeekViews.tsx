import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { OrderWeek, WeekDay, WeekKey } from './myOrdersWeeks';
import type { OrderV2 } from '../../services/ordersApi';

/**
 * Piezas de presentación de "Mis pedidos" por semana y por día (F29,
 * prototipos `MyOrders` y `DesktopMyOrders`, tablero v26). Puras: reciben las
 * semanas ya armadas (`buildOrderWeeks`) y dejan que la página pinte cada
 * pedido (`renderOrder`), así el acordeón y su estado abierto viven en un solo
 * lugar.
 */

const pluralOrders = (count: number): string => (count === 1 ? '1 pedido' : `${count} pedidos`);

interface SwitchProps {
  weeks: OrderWeek[];
  selected: WeekKey;
  onSelect: (key: WeekKey) => void;
}

/** Móvil: interruptor "Esta semana / Semana próxima", cada una con sus fechas y cantidad de pedidos. */
export function WeekSwitch({ weeks, selected, onSelect }: SwitchProps) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
      {weeks.map((week) => {
        const on = week.key === selected;
        return (
          <button
            key={week.key}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(week.key)}
            className={cn(
              'flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1.5 text-center',
              on ? 'bg-card shadow-sm' : 'text-muted-foreground',
            )}
          >
            <span className="flex items-center gap-1.5 text-[13.5px] font-bold text-foreground">
              {week.label}
              <span
                className={cn(
                  'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold',
                  on ? 'bg-primary-deep text-primary-foreground' : 'bg-border text-foreground',
                )}
              >
                {week.count}
              </span>
            </span>
            <span className="text-[11.5px] font-medium text-muted-foreground">{week.rangeLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

function EmptyWeek({ weekKey }: { weekKey: WeekKey }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-4 py-10 text-center">
      <span className="flex flex-col gap-1">
        <span className="text-sm font-bold text-foreground">
          {weekKey === 'esta' ? 'No tenés pedidos esta semana' : 'No tenés pedidos para la semana próxima'}
        </span>
        <span className="text-sm text-muted-foreground">Podés pedir para cualquier día de esta semana y de la próxima.</span>
      </span>
      <Link
        to="/orders/today"
        className="flex h-11 items-center rounded-md bg-primary-deep px-5 text-sm font-bold uppercase tracking-brand text-primary-foreground no-underline"
      >
        Hacer un pedido
      </Link>
    </div>
  );
}

function TodayChip() {
  return (
    <span className="inline-flex h-[18px] items-center rounded-[3px] bg-primary-deep px-1.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-primary-foreground">
      Hoy
    </span>
  );
}

interface DayProps {
  day: WeekDay;
  variant: 'mobile' | 'desktop';
  renderOrder: (order: OrderV2) => ReactNode;
}

function DayGroup({ day, variant, renderOrder }: DayProps) {
  const label = `${day.weekday} ${day.dayNumber}`;
  const empty = day.orders.length === 0;

  if (variant === 'desktop') {
    return (
      <div
        data-testid="day-row"
        data-today={day.isToday}
        className={cn(
          'grid grid-cols-[132px_minmax(0,1fr)] gap-5 rounded-lg border p-4',
          day.isToday ? 'border-primary/30 bg-primary/[0.06]' : 'border-border bg-card/40',
          empty && 'items-center py-3',
        )}
      >
        <div className={cn('flex flex-col gap-1', empty && 'flex-row items-baseline gap-2')}>
          <span className="text-[11px] font-semibold uppercase tracking-brand text-muted-foreground">{day.weekday}</span>
          <span className={cn('font-display font-bold leading-none text-foreground', empty ? 'text-xl' : 'text-4xl')}>
            {day.dayNumber}
          </span>
          {day.isToday && <TodayChip />}
          {!empty && <span className="text-xs font-bold text-muted-foreground">{pluralOrders(day.orders.length)}</span>}
        </div>
        {empty ? (
          <span className="text-sm text-muted-foreground">Sin pedidos</span>
        ) : (
          <ul aria-label={label} className="m-0 flex list-none flex-col gap-3 p-0">
            {day.orders.map(renderOrder)}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="m-0 font-display text-base font-bold text-foreground">
          {label}
          {day.isToday && (
            <>
              {' '}
              <TodayChip />
            </>
          )}
        </h3>
        <span className="text-xs font-semibold text-muted-foreground">{empty ? 'Sin pedidos' : pluralOrders(day.orders.length)}</span>
      </div>
      {!empty && (
        <ul aria-label={label} className="m-0 flex list-none flex-col gap-3 p-0">
          {day.orders.map(renderOrder)}
        </ul>
      )}
    </div>
  );
}

interface WeekViewProps {
  week: OrderWeek;
  variant: 'mobile' | 'desktop';
  /** "Anteriores" ya está a la vista: la línea de días pasados no ofrece revelarla. */
  showPast: boolean;
  onShowPast: () => void;
  renderOrder: (order: OrderV2) => ReactNode;
}

/**
 * Una semana: móvil, sus días bajo el interruptor; escritorio, un encabezado
 * (nombre, fechas, cantidad) y una fila por día. Los días de esta semana que
 * ya pasaron van en una sola línea; una semana sin pedidos muestra el vacío.
 */
export function WeekView({ week, variant, showPast, onShowPast, renderOrder }: WeekViewProps) {
  const desktop = variant === 'desktop';
  const titleId = `week-${week.key}`;
  const past = week.pastDays;

  return (
    <section aria-labelledby={desktop ? titleId : undefined} aria-label={desktop ? undefined : week.label} className="flex flex-col gap-4">
      {desktop && (
        <header className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
          <h2 id={titleId} className="m-0 font-display text-xl font-bold text-foreground">
            {week.label}
          </h2>
          <span className="flex items-baseline gap-3 text-xs font-semibold text-muted-foreground">
            <span>{week.rangeLabel}</span>
            <span>{pluralOrders(week.count)}</span>
          </span>
        </header>
      )}

      {week.count === 0 ? (
        <>
          {past && <PastDaysLine past={past} showPast={showPast} onShowPast={onShowPast} />}
          <EmptyWeek weekKey={week.key} />
        </>
      ) : (
        <div className="flex flex-col gap-4">
          {past && <PastDaysLine past={past} showPast={showPast} onShowPast={onShowPast} />}
          {week.days.map((day) => (
            <DayGroup key={day.dateKey} day={day} variant={variant} renderOrder={renderOrder} />
          ))}
        </div>
      )}
    </section>
  );
}

function PastDaysLine({
  past,
  showPast,
  onShowPast,
}: {
  past: NonNullable<OrderWeek['pastDays']>;
  showPast: boolean;
  onShowPast: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
      <span>{past.label}</span>
      {past.orderCount > 0 && !showPast && (
        <button type="button" onClick={onShowPast} className="h-9 px-1 text-xs font-bold text-primary-deep">
          {`Ver ${pluralOrders(past.orderCount)}`}
        </button>
      )}
    </div>
  );
}
