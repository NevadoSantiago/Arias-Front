import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { getOrdersByPickup, getRestaurantConfigAdmin } from '@/features/admin/services/adminApi';
import { getDisabledDates } from '@/features/orders/services/ordersApi';
import { schedulableRange } from '@/features/admin/menu/pickupHours';
import { CLOCK_TICK_MS, useNow } from './useKitchenBoard';
import { buildDayOptions, buildDayOrders, resolveDay, summarizeDishes } from './dashboardDay';

const DAY_PARAM = 'dia';
/** Another day changes slowly: no need for the 20 s polling of today's board. */
const DAY_REFETCH_MS = 60_000;
const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Container logic of the day select: which day the dashboard shows (kept in `?dia=`), the options
 * for it and, when it is not today, that day's orders. Today's board lives in `useKitchenBoard`.
 */
export function useDashboardDay() {
  const now = useNow(CLOCK_TICK_MS);
  const [params, setParams] = useSearchParams();
  const config = useQuery({ queryKey: ['adminRestaurantConfig'], queryFn: getRestaurantConfigAdmin });
  const timezone = config.data?.timezone ?? DEFAULT_TIMEZONE;
  const range = useMemo(() => schedulableRange(now, timezone), [now, timezone]);

  const disabledDates = useQuery({
    queryKey: ['adminDisabledDates', range.from, range.to],
    queryFn: () => getDisabledDates(range.from, range.to),
  });

  const options = useMemo(
    () =>
      buildDayOptions({
        now,
        timezone,
        schedule: config.data?.pickupSchedule,
        disabledDates: disabledDates.data ?? [],
      }),
    [now, timezone, config.data, disabledDates.data],
  );

  const param = params.get(DAY_PARAM);
  // A day in the URL can only be validated once the timezone is known.
  const pending = param !== null && !config.data;
  const selected = resolveDay(pending ? null : param, options);
  const isToday = selected.isToday;

  const orders = useQuery({
    queryKey: ['adminOrdersByPickupDay', selected.date],
    queryFn: () => getOrdersByPickup(selected.date),
    refetchInterval: DAY_REFETCH_MS,
    enabled: !isToday,
  });

  const dayOrders = useMemo(() => buildDayOrders(orders.data ?? [], timezone), [orders.data, timezone]);
  const summary = useMemo(() => summarizeDishes(dayOrders), [dayOrders]);

  const select = (date: string) => {
    const next = new URLSearchParams(params);
    if (date === options[0].date) next.delete(DAY_PARAM);
    else next.set(DAY_PARAM, date);
    setParams(next);
  };

  return {
    options,
    selected,
    /** False while the URL asks for a day and the config needed to validate it is still loading. */
    isToday: isToday && !pending,
    isPending: pending,
    select,
    backToToday: () => select(options[0].date),
    orders: dayOrders,
    summary,
    isLoading: orders.isLoading,
    isError: orders.isError,
    isFetching: orders.isFetching,
    refetch: () => void orders.refetch(),
  };
}
