import type { PickupOrder, PickupOrderItem, PrintStatus } from '@/features/admin/services/adminApi';

export const MINUTE_MS = 60_000;
/** The timeline strip looks this far ahead. */
export const TIMELINE_MS = 60 * MINUTE_MS;
/** From here on the countdown of a group turns dark mustard. */
export const SOON_MS = 10 * MINUTE_MS;
/** From here on it turns deep red. */
export const URGENT_MS = 3 * MINUTE_MS;
const TICK_EVERY_MS = 10 * MINUTE_MS;

export interface BoardContext {
  /** Epoch ms of "now", already corrected with the server clock. */
  nowMs: number;
  /** IANA zone of the restaurant (`restaurant_config.timezone`). */
  timezone: string;
  /** `pickupLeadMinutes`: an order is commanded this long before its pickup. */
  leadMinutes: number;
}

/** One printed ticket line, equal items grouped (`2x Milanesa` / `2x C/papas`). */
export interface TicketLine {
  qty: number;
  dish: string;
  side: string | null;
  note: string | null;
}

export interface BoardOrder extends PickupOrder {
  /** Epoch ms of the start of the pickup minute. */
  pickupMs: number;
  pickupLabel: string;
  lines: TicketLine[];
  /** HH:MM the customer got it; empty when it has not happened. */
  deliveredLabel: string;
}

export interface ScheduledOrder extends BoardOrder {
  /** HH:MM at which the server commands it on its own (pickup − lead). */
  comandarAtLabel: string;
  /** Ms until that moment; negative when the scheduler is about to pick it up. */
  comandarInMs: number;
}

export interface OverdueOrder extends BoardOrder {
  /** Ms since the pickup minute started. */
  overdueMs: number;
}

export type GroupTone = 'calm' | 'soon' | 'urgent';

export interface PickupGroup {
  /** Stable DOM / marker key: the epoch ms of the pickup minute. */
  key: string;
  time: string;
  msUntil: number;
  tone: GroupTone;
  worst: PrintStatus;
  orders: BoardOrder[];
}

export interface TimelineMarker {
  key: string;
  time: string;
  /** 0 = now, 1 = 60 minutes from now. */
  offset: number;
  count: number;
  worst: PrintStatus;
  msUntil: number;
}

export interface Timeline {
  nowLabel: string;
  endLabel: string;
  ticks: { offset: number; label: string }[];
  markers: TimelineMarker[];
}

export interface KitchenBoard {
  scheduled: ScheduledOrder[];
  overdue: OverdueOrder[];
  groups: PickupGroup[];
  timeline: Timeline;
  delivered: BoardOrder[];
  /** Every COMANDADO order not yet delivered. */
  commandedCount: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

/** Minute of the day (0-1439) of an instant, read in `timezone` and not in the browser's zone. */
export function minuteOfDay(instant: Date | string | number, timezone: string): number {
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
  const parts = fmt.formatToParts(typeof instant === 'string' ? new Date(instant) : new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}

export function formatMinute(minute: number): string {
  const m = ((minute % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** ISO weekday (1 = Monday) of an instant, read in `timezone`. */
export function isoWeekday(instant: Date, timezone: string): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(instant);
  return WEEKDAYS.indexOf(name) + 1;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const clockLabel = (epochMs: number, timezone: string) => formatMinute(minuteOfDay(epochMs, timezone));

const clean = (text: string | null | undefined) => {
  const t = text?.trim();
  return t ? t : null;
};

/** Groups equal items (same dish, side and note) like the printed ticket, in first-seen order. */
export function ticketLines(items: PickupOrderItem[]): TicketLine[] {
  const lines = new Map<string, TicketLine>();
  for (const item of items) {
    const dish = item.dishNombre.trim();
    const side = clean(item.sideNombre);
    const note = clean(item.notas);
    const key = JSON.stringify([dish, side, note]);
    const line = lines.get(key);
    if (line) line.qty += 1;
    else lines.set(key, { qty: 1, dish, side, note });
  }
  return [...lines.values()];
}

/** `07:32`, or `1:30:05` from one hour up. The sign is dropped: callers say "en" or "atrasado". */
export function formatCountdown(ms: number): string {
  const total = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
}

export function countdownTone(msUntil: number): GroupTone | 'overdue' {
  if (msUntil <= 0) return 'overdue';
  if (msUntil <= URGENT_MS) return 'urgent';
  if (msUntil <= SOON_MS) return 'soon';
  return 'calm';
}

const PRINT_SEVERITY: Record<PrintStatus, number> = { PRINTED: 0, QUEUED: 1, NONE: 2, EXPIRED: 3, FAILED: 4 };

/** The print status that needs the most attention. */
export function worstPrintStatus(statuses: PrintStatus[]): PrintStatus {
  return statuses.reduce<PrintStatus>(
    (worst, s) => (PRINT_SEVERITY[s] > PRINT_SEVERITY[worst] ? s : worst),
    'PRINTED',
  );
}

function toBoardOrder(order: PickupOrder, timezone: string): BoardOrder {
  const pickupMs = Math.floor(Date.parse(order.pickupAt) / MINUTE_MS) * MINUTE_MS;
  return {
    ...order,
    pickupMs,
    pickupLabel: clockLabel(pickupMs, timezone),
    lines: ticketLines(order.items),
    deliveredLabel: order.deliveredAt ? clockLabel(Date.parse(order.deliveredAt), timezone) : '',
  };
}

const byPickup = (a: BoardOrder, b: BoardOrder) => a.pickupMs - b.pickupMs || a.id - b.id;

function buildTimeline(groups: PickupGroup[], ctx: BoardContext): Timeline {
  const steps = TIMELINE_MS / TICK_EVERY_MS;
  return {
    nowLabel: clockLabel(ctx.nowMs, ctx.timezone),
    endLabel: clockLabel(ctx.nowMs + TIMELINE_MS, ctx.timezone),
    ticks: Array.from({ length: steps + 1 }, (_, i) => ({
      offset: i / steps,
      label: clockLabel(ctx.nowMs + i * TICK_EVERY_MS, ctx.timezone),
    })),
    markers: groups
      .filter((g) => g.msUntil > 0 && g.msUntil <= TIMELINE_MS)
      .map((g) => ({
        key: g.key,
        time: g.time,
        offset: g.msUntil / TIMELINE_MS,
        count: g.orders.length,
        worst: g.worst,
        msUntil: g.msUntil,
      })),
  };
}

/** Pure projection of today's B2C orders into the boxes of the kitchen dashboard. */
export function buildKitchenBoard(orders: PickupOrder[], ctx: BoardContext): KitchenBoard {
  const board = orders.map((o) => toBoardOrder(o, ctx.timezone)).sort(byPickup);
  const inState = (...estados: PickupOrder['estado'][]) => board.filter((o) => estados.includes(o.estado));

  const commanded = inState('COMANDADO');
  const overdue: OverdueOrder[] = [];
  const byMinute = new Map<number, BoardOrder[]>();
  for (const o of commanded) {
    if (o.pickupMs - ctx.nowMs <= 0) {
      overdue.push({ ...o, overdueMs: ctx.nowMs - o.pickupMs });
    } else {
      byMinute.set(o.pickupMs, [...(byMinute.get(o.pickupMs) ?? []), o]);
    }
  }

  const groups: PickupGroup[] = [...byMinute.entries()].map(([pickupMs, list]) => {
    const msUntil = pickupMs - ctx.nowMs;
    return {
      key: String(pickupMs),
      time: clockLabel(pickupMs, ctx.timezone),
      msUntil,
      tone: countdownTone(msUntil) as GroupTone,
      worst: worstPrintStatus(list.map((o) => o.printStatus)),
      orders: list,
    };
  });

  return {
    scheduled: inState('PENDIENTE', 'CONFIRMADO').map((o) => {
      const commandAt = o.pickupMs - ctx.leadMinutes * MINUTE_MS;
      return {
        ...o,
        comandarAtLabel: clockLabel(commandAt, ctx.timezone),
        comandarInMs: commandAt - ctx.nowMs,
      };
    }),
    overdue,
    groups,
    timeline: buildTimeline(groups, ctx),
    delivered: inState('ENTREGADO'),
    commandedCount: commanded.length,
  };
}
