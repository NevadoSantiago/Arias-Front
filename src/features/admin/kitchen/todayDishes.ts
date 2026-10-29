import { MINUTE_MS, type BoardOrder, type KitchenBoard } from './kitchenBoard';

/** A pickup minute the kitchen can pick as a range end. */
export interface PickupTime {
  /** Epoch ms of the start of the pickup minute. */
  ms: number;
  /** HH:MM in the restaurant zone. */
  label: string;
}

/** What the person picked; an end beyond the options simply means "the first / the last". */
export interface RangeSelection {
  from: number;
  to: number;
}

/** A selection whose ends are real pickup minutes. */
export type PickupRange = RangeSelection;

export const WHOLE_DAY: RangeSelection = { from: -Infinity, to: Infinity };

/** Orders the kitchen still has to make today: scheduled and commanded (overdue included), by pickup. */
export function countedOrders(board: KitchenBoard): BoardOrder[] {
  return [...board.scheduled, ...board.overdue, ...board.groups.flatMap((g) => g.orders)].sort(
    (a, b) => a.pickupMs - b.pickupMs || a.id - b.id,
  );
}

/** Distinct pickup minutes of the orders, sorted. */
export function pickupTimes(orders: BoardOrder[]): PickupTime[] {
  const seen = new Map<number, string>();
  for (const o of orders) seen.set(o.pickupMs, o.pickupLabel);
  return [...seen.entries()].sort(([a], [b]) => a - b).map(([ms, label]) => ({ ms, label }));
}

/**
 * Snaps a selection onto the current options. An end whose pickup disappeared (delivered or cancelled)
 * moves inwards to the nearest remaining one; if nothing is left in between, it is the whole day.
 */
export function resolveRange(times: PickupTime[], selection: RangeSelection): PickupRange | null {
  if (times.length === 0) return null;
  const whole = { from: times[0].ms, to: times[times.length - 1].ms };
  const from = times.find((t) => t.ms >= selection.from)?.ms;
  const to = [...times].reverse().find((t) => t.ms <= selection.to)?.ms;
  return from === undefined || to === undefined || from > to ? whole : { from, to };
}

/** Moves the start; the end follows when it would end up before it. */
export function setRangeFrom(range: RangeSelection, from: number): RangeSelection {
  return { from, to: Math.max(range.to, from) };
}

/** Moves the end; the start follows when it would end up after it. */
export function setRangeTo(range: RangeSelection, to: number): RangeSelection {
  return { from: Math.min(range.from, to), to };
}

/** From the first pickup in the current minute (or later) to the last; null when none remains. */
export function rangeFromNow(times: PickupTime[], nowMs: number): PickupRange | null {
  const minuteStart = Math.floor(nowMs / MINUTE_MS) * MINUTE_MS;
  const first = times.find((t) => t.ms >= minuteStart);
  return first ? { from: first.ms, to: times[times.length - 1].ms } : null;
}

export function filterByRange(orders: BoardOrder[], range: PickupRange): BoardOrder[] {
  return orders.filter((o) => o.pickupMs >= range.from && o.pickupMs <= range.to);
}
