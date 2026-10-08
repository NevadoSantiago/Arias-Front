import type { PickupOrder } from '@/features/admin/services/adminApi';

/** A commanded order whose pickup was more than this many minutes ago folds into the faded group. */
export const STALE_AFTER_MINUTES = 30;

export interface BoardContext {
  now: Date;
  /** IANA zone of the restaurant (`restaurant_config.timezone`). */
  timezone: string;
  /** `pickupLeadMinutes`: an order is confirmed this long before its pickup. */
  leadMinutes: number;
  /** `pickupSlotMinutes`: distance between two pickup slots. */
  slotMinutes: number;
  /** Minute of the day where today's pickup window opens: slots are `anchor + k * slotMinutes`. */
  slotAnchorMinutes: number;
}

export interface BoardOrder extends PickupOrder {
  pickupMinute: number;
  pickupLabel: string;
  /** "en 10 min" / "ahora" / "hace 10 min". */
  rel: string;
  /** HH:MM the kitchen was told / the customer got it; empty when it has not happened. */
  comandadoLabel: string;
  deliveredLabel: string;
}

export interface ScheduledOrder extends BoardOrder {
  confirmAtLabel: string;
}

export interface ConfirmedSlot {
  minute: number;
  time: string;
  /** Slot already passed and still has orders to command. */
  overdue: boolean;
  /** First column that has orders: the one the kitchen should cook first. */
  first: boolean;
  rel: string;
  orders: BoardOrder[];
}

export interface KitchenBoard {
  confirmed: ConfirmedSlot[];
  commanded: { fresh: BoardOrder[]; stale: BoardOrder[] };
  scheduled: ScheduledOrder[];
  delivered: BoardOrder[];
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

/** Minute of the day (0-1439) of an instant, read in `timezone` and not in the browser's zone. */
export function minuteOfDay(instant: Date | string, timezone: string): number {
  let fmt = formatterCache.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatterCache.set(timezone, fmt);
  }
  const parts = fmt.formatToParts(typeof instant === 'string' ? new Date(instant) : instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}

export function formatMinute(minute: number): string {
  const m = ((minute % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function relative(pickupMinute: number, nowMinute: number): string {
  if (pickupMinute > nowMinute) return `en ${pickupMinute - nowMinute} min`;
  if (pickupMinute === nowMinute) return 'ahora';
  return `hace ${nowMinute - pickupMinute} min`;
}

function timeLabel(iso: string | null, timezone: string): string {
  return iso ? formatMinute(minuteOfDay(iso, timezone)) : '';
}

function toBoardOrder(order: PickupOrder, ctx: BoardContext, nowMinute: number): BoardOrder {
  const pickupMinute = minuteOfDay(order.pickupAt, ctx.timezone);
  return {
    ...order,
    pickupMinute,
    pickupLabel: formatMinute(pickupMinute),
    rel: relative(pickupMinute, nowMinute),
    comandadoLabel: timeLabel(order.comandadoAt, ctx.timezone),
    deliveredLabel: timeLabel(order.deliveredAt, ctx.timezone),
  };
}

const byPickup = (a: BoardOrder, b: BoardOrder) => a.pickupMinute - b.pickupMinute || a.id - b.id;

/** One column per pickup slot that has at least one CONFIRMADO order (overdue and early ones included). */
function buildConfirmed(confirmed: BoardOrder[], nowMinute: number): ConfirmedSlot[] {
  const ordersBySlot = new Map<number, BoardOrder[]>();
  for (const o of confirmed) {
    ordersBySlot.set(o.pickupMinute, [...(ordersBySlot.get(o.pickupMinute) ?? []), o]);
  }
  const minutes = [...ordersBySlot.keys()].sort((a, b) => a - b);
  let firstMarked = false;
  return minutes.map((minute) => {
    const orders = ordersBySlot.get(minute) ?? [];
    const first = !firstMarked;
    firstMarked = true;
    const overdue = minute < nowMinute;
    return {
      minute,
      time: formatMinute(minute),
      overdue,
      first,
      rel: overdue ? `atrasado ${nowMinute - minute} min` : minute === nowMinute ? 'retiran ahora' : `en ${minute - nowMinute} min`,
      orders,
    };
  });
}

/** Pure projection of today's B2C orders into the four boxes of the kitchen dashboard. */
export function buildKitchenBoard(orders: PickupOrder[], ctx: BoardContext): KitchenBoard {
  const nowMinute = minuteOfDay(ctx.now, ctx.timezone);
  const board = orders.map((o) => toBoardOrder(o, ctx, nowMinute)).sort(byPickup);
  const inState = (estado: PickupOrder['estado']) => board.filter((o) => o.estado === estado);

  const commanded = inState('COMANDADO');
  return {
    confirmed: buildConfirmed(inState('CONFIRMADO'), nowMinute),
    commanded: {
      fresh: commanded.filter((o) => nowMinute - o.pickupMinute <= STALE_AFTER_MINUTES),
      stale: commanded.filter((o) => nowMinute - o.pickupMinute > STALE_AFTER_MINUTES),
    },
    scheduled: inState('PENDIENTE').map((o) => ({
      ...o,
      confirmAtLabel: formatMinute(o.pickupMinute - ctx.leadMinutes),
    })),
    delivered: inState('ENTREGADO'),
  };
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** ISO weekday (1 = Monday) of an instant, read in `timezone`. */
export function isoWeekday(instant: Date, timezone: string): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(instant);
  return WEEKDAYS.indexOf(name) + 1;
}

interface ScheduleDay {
  dayOfWeek: number;
  open: boolean;
  windowStart: string | null;
}

/**
 * Minute of the day where today's pickup window opens. The backend generates slots from the window
 * start stepping by `pickupSlotMinutes`, so the columns must be aligned to it. Midnight when the
 * restaurant is closed or has no schedule: the columns then only show slots that have orders.
 */
export function slotAnchorFor(schedule: ScheduleDay[] | undefined, now: Date, timezone: string): number {
  const today = schedule?.find((d) => d.dayOfWeek === isoWeekday(now, timezone));
  if (!today?.open || !today.windowStart) return 0;
  const [h, m] = today.windowStart.split(':').map(Number);
  return h * 60 + m;
}
