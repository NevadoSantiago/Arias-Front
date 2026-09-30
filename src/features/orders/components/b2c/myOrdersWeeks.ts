import { restaurantDateKey } from '../orderDateLabels';
import type { OrderV2 } from '../../services/ordersApi';
import type { PickupScheduleDay } from '../../types';

/**
 * Modelo de "Mis pedidos" por semana y por día (F29, prototipo D7): puro, sin
 * React. Las semanas son la actual y la próxima (el rango que admite el
 * backend, `PickupSlotService`); los días salen del horario del local
 * (`pickupSchedule`, día abierto) menos las fechas deshabilitadas; y cada
 * pedido cae en su día de retiro EN LA ZONA DEL LOCAL, no la del navegador.
 */

export type WeekKey = 'esta' | 'proxima';

export interface WeekDay {
  /** "AAAA-MM-DD" en la zona del local. */
  dateKey: string;
  /** "Jueves". */
  weekday: string;
  dayNumber: number;
  isToday: boolean;
  /** Pedidos próximos de ese día, por hora de retiro. */
  orders: OrderV2[];
}

/** Los días de esta semana que ya pasaron, resumidos en una línea. */
export interface PastDaysFold {
  /** "Lunes 21 a miércoles 23". */
  label: string;
  /** Pedidos anteriores (pasados o cancelados) de esos días. */
  orderCount: number;
}

export interface OrderWeek {
  key: WeekKey;
  label: string;
  /** "21–25 sep" / "28 sep – 2 oct". */
  rangeLabel: string;
  /** Pedidos próximos de la semana. */
  count: number;
  /** Días de hoy en adelante (o toda la semana próxima), en orden. */
  days: WeekDay[];
  pastDays: PastDaysFold | null;
}

interface Input {
  /** Pedidos próximos (los que van bajo cada día). */
  upcoming: OrderV2[];
  /** Pedidos anteriores: solo se cuentan para la línea de días pasados. */
  past: OrderV2[];
  now: Date;
  /** `getRestaurantConfig().pickupSchedule`; ausente = lunes a viernes. */
  schedule?: PickupScheduleDay[];
  /** Fechas "AAAA-MM-DD" en las que el local no abre. */
  disabledDates?: ReadonlySet<string>;
}

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DAY_MS = 24 * 60 * 60 * 1000;

/** Una fecha "AAAA-MM-DD" como instante UTC del mediodía: sumar días no depende del huso ni del horario de verano. */
const parseKey = (key: string): number => Date.parse(`${key}T12:00:00Z`);
const toKey = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const addDays = (key: string, days: number): string => toKey(parseKey(key) + days * DAY_MS);
/** Día ISO de la semana (1 = lunes .. 7 = domingo). */
const isoWeekday = (key: string): number => new Date(parseKey(key)).getUTCDay() || 7;
const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

function mondayOf(key: string): string {
  return addDays(key, 1 - isoWeekday(key));
}

export const orderDateKey = (order: OrderV2): string => restaurantDateKey(new Date(order.pickupAt));

/** Esta semana o la próxima, según el día de retiro del pedido. */
export function weekKeyOfOrder(order: OrderV2, now: Date): WeekKey {
  const nextMonday = addDays(mondayOf(restaurantDateKey(now)), 7);
  return orderDateKey(order) >= nextMonday ? 'proxima' : 'esta';
}

function dayOf(dateKey: string, todayKey: string, orders: OrderV2[]): WeekDay {
  return {
    dateKey,
    weekday: WEEKDAYS[new Date(parseKey(dateKey)).getUTCDay()],
    dayNumber: Number(dateKey.slice(8)),
    isToday: dateKey === todayKey,
    orders,
  };
}

function rangeLabelOf(firstKey: string, lastKey: string): string {
  const first = { day: Number(firstKey.slice(8)), month: MONTHS[Number(firstKey.slice(5, 7)) - 1] };
  const last = { day: Number(lastKey.slice(8)), month: MONTHS[Number(lastKey.slice(5, 7)) - 1] };
  if (firstKey === lastKey) return `${first.day} ${first.month}`;
  if (first.month === last.month) return `${first.day}–${last.day} ${last.month}`;
  return `${first.day} ${first.month} – ${last.day} ${last.month}`;
}

export function buildOrderWeeks({ upcoming, past, now, schedule, disabledDates }: Input): OrderWeek[] {
  const todayKey = restaurantDateKey(now);
  const thisMonday = mondayOf(todayKey);
  const nextMonday = addDays(thisMonday, 7);

  // Sin horario cargado (backend viejo o config sin traer) se asume lunes a viernes.
  const isOpen = (dateKey: string): boolean => {
    if (disabledDates?.has(dateKey)) return false;
    if (!schedule) return isoWeekday(dateKey) <= 5;
    return schedule.some((d) => d.dayOfWeek === isoWeekday(dateKey) && d.open);
  };

  const ordersByDay = new Map<string, OrderV2[]>();
  for (const o of [...upcoming].sort((a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime())) {
    const key = orderDateKey(o);
    ordersByDay.set(key, [...(ordersByDay.get(key) ?? []), o]);
  }

  const definitions: { key: WeekKey; label: string; monday: string }[] = [
    { key: 'esta', label: 'Esta semana', monday: thisMonday },
    { key: 'proxima', label: 'Semana próxima', monday: nextMonday },
  ];

  return definitions.map(({ key, label, monday }): OrderWeek => {
    const sunday = addDays(monday, 6);
    // Un pedido más allá de la semana próxima no se pierde: suma su día a la última semana.
    const inWeek = (dateKey: string) => dateKey >= monday && (key === 'proxima' ? true : dateKey <= sunday);
    const weekKeys = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter(isOpen);
    const withOrders = [...ordersByDay.keys()].filter(inWeek);
    // Un día con pedidos se muestra aunque el horario lo dé por cerrado (el pedido ya existe).
    const shown = [...new Set([...weekKeys, ...withOrders])].sort();

    const pastKeys = shown.filter((k) => k < todayKey);
    const liveKeys = shown.filter((k) => k >= todayKey);
    const days = liveKeys.map((k) => dayOf(k, todayKey, ordersByDay.get(k) ?? []));

    let pastDays: PastDaysFold | null = null;
    if (pastKeys.length > 0) {
      const first = dayOf(pastKeys[0], todayKey, []);
      const last = dayOf(pastKeys[pastKeys.length - 1], todayKey, []);
      pastDays = {
        label:
          pastKeys.length === 1
            ? `${first.weekday} ${first.dayNumber}`
            : `${first.weekday} ${first.dayNumber} a ${lowerFirst(last.weekday)} ${last.dayNumber}`,
        orderCount: past.filter((o) => pastKeys.includes(orderDateKey(o))).length,
      };
    }

    const rangeKeys = shown.length > 0 ? shown : [monday, addDays(monday, 4)];
    return {
      key,
      label,
      rangeLabel: rangeLabelOf(rangeKeys[0], rangeKeys[rangeKeys.length - 1]),
      count: days.reduce((sum, d) => sum + d.orders.length, 0),
      days,
      pastDays,
    };
  });
}
