import { useId, useMemo, useState } from 'react';
import { ChevronDown, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { summarizeDishes } from './dashboardDay';
import { plural, type KitchenBoard } from './kitchenBoard';
import { DishList } from './kitchenParts';
import {
  countedOrders,
  filterByRange,
  pickupTimes,
  rangeFromNow,
  resolveRange,
  setRangeFrom,
  setRangeTo,
  WHOLE_DAY,
  type RangeSelection,
} from './todayDishes';

interface TodayDishesBoxProps {
  board: KitchenBoard;
  /** Epoch ms of "now", corrected with the server clock: where "Desde ahora" starts. */
  nowMs: number;
}

const SELECT_CLASS =
  'h-11 w-[84px] rounded-md border border-border bg-card pl-2.5 pr-1.5 text-sm font-semibold tabular-nums';

const pillClass = (on: boolean) =>
  cn(
    'min-h-[36px] rounded-full border px-3 text-[12.5px] font-bold disabled:cursor-not-allowed disabled:opacity-50',
    on ? 'border-foreground bg-foreground text-primary-foreground' : 'border-foreground/35 bg-card text-foreground',
  );

const rangePhrase = (from: string, to: string) => (from === to ? `a las ${from}` : `entre ${from} y ${to}`);

/** What the kitchen still has to make today, by pickup range. Collapsed until someone needs it. */
export function TodayDishesBox({ board, nowMs }: TodayDishesBoxProps) {
  const bodyId = useId();
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<RangeSelection>(WHOLE_DAY);

  const orders = useMemo(() => countedOrders(board), [board]);
  const times = useMemo(() => pickupTimes(orders), [orders]);
  const range = resolveRange(times, selection);
  const inRange = useMemo(() => (range ? filterByRange(orders, range) : []), [orders, range]);
  const summary = useMemo(() => summarizeDishes(inRange), [inRange]);

  const labelOf = (ms: number) => times.find((t) => t.ms === ms)?.label ?? '';
  const fromLabel = range ? labelOf(range.from) : '';
  const toLabel = range ? labelOf(range.to) : '';
  const isWholeDay = !!range && range.from === times[0].ms && range.to === times[times.length - 1].ms;
  const nowRange = rangeFromNow(times, nowMs);
  const isFromNow = !!range && !!nowRange && !isWholeDay && range.from === nowRange.from && range.to === nowRange.to;

  return (
    <section
      aria-labelledby="kb-dishes"
      className="min-w-0 rounded-md border border-border bg-card px-4 py-1.5"
    >
      <h2 id="kb-dishes" className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-[48px] w-full items-center justify-between gap-3 py-1 text-left"
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <ClipboardList className="h-[18px] w-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="text-[13px] font-bold uppercase tracking-brand">Resumen de platos</span>
              <span className="inline-flex h-[26px] items-center whitespace-nowrap rounded-full bg-primary-deep px-2.5 text-xs font-bold tabular-nums text-primary-foreground">
                {plural(summary.total, 'plato', 'platos')}
              </span>
            </span>
            {!open && range && !isWholeDay && (
              <span className="pl-[26px] text-xs font-medium tabular-nums text-muted-foreground">
                {`Retiro ${fromLabel === toLabel ? `a las ${fromLabel}` : `${fromLabel} a ${toLabel}`}`}
              </span>
            )}
          </span>
          <ChevronDown
            className={cn('h-[18px] w-[18px] shrink-0 transition-transform', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </h2>
      {open && (
        <div id={bodyId} className="flex flex-col gap-3 pb-3.5 pt-1">
          {!range ? (
            <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[13px] text-muted-foreground">
              No hay pedidos para preparar hoy.
            </p>
          ) : (
            <>
              <div role="group" aria-label="Horario de retiro" className="flex flex-col gap-2 rounded-md bg-muted p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor={`${bodyId}-from`} className="text-[13px] font-semibold">
                    Desde
                  </label>
                  <select
                    id={`${bodyId}-from`}
                    value={range.from}
                    onChange={(e) => setSelection(setRangeFrom(range, Number(e.target.value)))}
                    className={SELECT_CLASS}
                  >
                    {times.map((t) => (
                      <option key={t.ms} value={t.ms} disabled={t.ms > range.to}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <label htmlFor={`${bodyId}-to`} className="text-[13px] font-semibold">
                    hasta
                  </label>
                  <select
                    id={`${bodyId}-to`}
                    value={range.to}
                    onChange={(e) => setSelection(setRangeTo(range, Number(e.target.value)))}
                    className={SELECT_CLASS}
                  >
                    {times.map((t) => (
                      <option key={t.ms} value={t.ms} disabled={t.ms < range.from}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    aria-pressed={isWholeDay}
                    onClick={() => setSelection(WHOLE_DAY)}
                    className={pillClass(isWholeDay)}
                  >
                    Todo el día
                  </button>
                  <button
                    type="button"
                    aria-pressed={isFromNow}
                    disabled={!nowRange}
                    onClick={() => nowRange && setSelection(nowRange)}
                    className={pillClass(isFromNow)}
                  >
                    Desde ahora
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-[13px] font-semibold tabular-nums">
                  {`${plural(summary.total, 'plato', 'platos')} · ${plural(inRange.length, 'pedido', 'pedidos')} con retiro ${rangePhrase(fromLabel, toLabel)}`}
                </p>
                <p className="text-xs text-muted-foreground">No cuenta los pedidos entregados ni cancelados.</p>
              </div>
              <div className="border-t border-border pt-1">
                <DishList dishes={summary.dishes} label="Platos a preparar" />
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
