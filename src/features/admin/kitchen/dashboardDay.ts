import type { PickupOrder, PickupOrderItem } from '@/features/admin/services/adminApi';
import { addDays, localDate, schedulableRange, type DisabledDateEntry, type PickupScheduleEntry } from '@/features/admin/menu/pickupHours';
import { formatMinute, minuteOfDay } from './kitchenBoard';

export type DayStatus = 'open' | 'closed' | 'disabled';

export interface DayOption {
  /** `YYYY-MM-DD` in the restaurant timezone. */
  date: string;
  /** Text of the select option: "Hoy", "Mañana" or "Lun 5/10", plus " · cerrado" / " · deshabilitado". */
  label: string;
  /** "lunes 5/10", for sentences. */
  longLabel: string;
  isToday: boolean;
  status: DayStatus;
  motivo: string | null;
}

export interface DayOptionsInput {
  now: Date;
  /** IANA zone of the restaurant (`restaurant_config.timezone`). */
  timezone: string;
  /** Unknown (config still loading): every day counts as open. */
  schedule: PickupScheduleEntry[] | undefined;
  disabledDates: DisabledDateEntry[];
}

const SHORT_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const LONG_DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** JS weekday (0 = Sunday) of a calendar date, independent of any timezone. */
function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const dayMonth = (date: string) => {
  const [, m, d] = date.split('-').map(Number);
  return `${d}/${m}`;
};

const STATUS_SUFFIX: Record<DayStatus, string> = { open: '', closed: ' · cerrado', disabled: ' · deshabilitado' };

/**
 * Days the dashboard can browse: today up to Sunday of next week, which is the horizon the backend
 * accepts orders for. Closed and disabled days stay in the list, only labelled.
 */
export function buildDayOptions({ now, timezone, schedule, disabledDates }: DayOptionsInput): DayOption[] {
  const today = localDate(now, timezone);
  const { to } = schedulableRange(now, timezone);
  const disabled = new Map(disabledDates.map((d) => [d.fecha, d.motivo]));
  const options: DayOption[] = [];

  for (let date = today, i = 0; date <= to; date = addDays(date, 1), i++) {
    const weekday = weekdayOf(date);
    const isoDay = weekday === 0 ? 7 : weekday;
    const entry = schedule?.find((d) => d.dayOfWeek === isoDay);
    const status: DayStatus = disabled.has(date) ? 'disabled' : schedule && !entry?.open ? 'closed' : 'open';
    const base = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : `${SHORT_DAYS[weekday]} ${dayMonth(date)}`;
    options.push({
      date,
      label: base + STATUS_SUFFIX[status],
      longLabel: `${LONG_DAYS[weekday]} ${dayMonth(date)}`,
      isToday: i === 0,
      status,
      motivo: status === 'disabled' ? (disabled.get(date) ?? null) : null,
    });
  }
  return options;
}

/** The option a URL value points at; today when it is missing, malformed or out of range. */
export function resolveDay(value: string | null, options: DayOption[]): DayOption {
  return options.find((o) => o.date === value) ?? options[0];
}

export interface NotedGroup {
  count: number;
  /** `null` when the dish has no side. */
  side: string | null;
  /** Trimmed, first spelling seen. */
  note: string;
}

export interface DishSummary {
  total: number;
  dishes: {
    name: string;
    /** Every unit of the dish, with or without note. */
    count: number;
    /** Units without a dish note: what `breakdown` describes. */
    plainCount: number;
    breakdown: string;
    notedGroups: NotedGroup[];
  }[];
}

type SummarizableOrder = { items: Pick<PickupOrderItem, 'dishNombre' | 'sideNombre' | 'notas'>[] };

const byCountThenName = (a: { count: number; name: string }, b: { count: number; name: string }) =>
  b.count - a.count || a.name.localeCompare(b.name, 'es');

/** The text a side is shown as, also the key noted groups sort by. */
export const sideLabel = (side: string | null) => (side ? `c/ ${side}` : 'sin acompañamiento');

const byCountSideNote = (a: NotedGroup, b: NotedGroup) =>
  b.count - a.count ||
  sideLabel(a.side).localeCompare(sideLabel(b.side), 'es') ||
  a.note.localeCompare(b.note, 'es');

interface DishAcc {
  count: number;
  plainCount: number;
  sides: Map<string, number>;
  noSide: number;
  noted: Map<string, NotedGroup>;
}

/**
 * Totals per dish name, so the kitchen can prep before the day. Items with a dish note are listed
 * apart (per side and note, case-insensitive) and left out of the main count and side breakdown.
 */
export function summarizeDishes(orders: SummarizableOrder[]): DishSummary {
  const perDish = new Map<string, DishAcc>();
  let total = 0;
  for (const item of orders.flatMap((o) => o.items)) {
    const dish = perDish.get(item.dishNombre) ?? { count: 0, plainCount: 0, sides: new Map(), noSide: 0, noted: new Map() };
    dish.count++;
    const note = item.notas?.trim();
    if (note) {
      const key = JSON.stringify([item.sideNombre, note.toLowerCase()]);
      const group = dish.noted.get(key) ?? { count: 0, side: item.sideNombre, note };
      group.count++;
      dish.noted.set(key, group);
    } else {
      dish.plainCount++;
      if (item.sideNombre) dish.sides.set(item.sideNombre, (dish.sides.get(item.sideNombre) ?? 0) + 1);
      else dish.noSide++;
    }
    perDish.set(item.dishNombre, dish);
    total++;
  }

  const dishes = [...perDish.entries()]
    .map(([name, { count, plainCount, sides, noSide, noted }]) => {
      const parts = [...sides.entries()]
        .map(([side, n]) => ({ name: side, count: n }))
        .sort(byCountThenName)
        .map((s) => `${s.count} c/ ${s.name}`);
      if (noSide > 0) parts.push(`${noSide} sin acompañamiento`);
      return { name, count, plainCount, breakdown: parts.join(' · '), notedGroups: [...noted.values()].sort(byCountSideNote) };
    })
    .sort(byCountThenName);
  return { total, dishes };
}

export interface DayOrder extends PickupOrder {
  pickupMinute: number;
  pickupLabel: string;
}

/** The orders of a day sorted by pickup time, then by number, with the time in the restaurant zone. */
export function buildDayOrders(orders: PickupOrder[], timezone: string): DayOrder[] {
  return orders
    .map((o) => {
      const pickupMinute = minuteOfDay(o.pickupAt, timezone);
      return { ...o, pickupMinute, pickupLabel: formatMinute(pickupMinute) };
    })
    .sort((a, b) => a.pickupMinute - b.pickupMinute || a.id - b.id);
}
