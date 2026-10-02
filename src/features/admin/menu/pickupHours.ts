import { formatMinute, isoWeekday, minuteOfDay } from '@/features/admin/kitchen/kitchenBoard';

export interface PickupScheduleEntry {
  dayOfWeek: number;
  open: boolean;
  windowStart: string | null;
  windowEnd: string | null;
}

export interface DisabledDateEntry {
  fecha: string;
  motivo: string | null;
}

export interface PickupHoursInput {
  now: Date;
  /** IANA zone of the restaurant (`restaurant_config.timezone`). */
  timezone: string;
  /** `pickupLeadMinutes`: nothing earlier than now + lead is offered. */
  leadMinutes: number;
  /** `pickupSlotMinutes`: distance between two slots, counted from the window start. */
  slotMinutes: number;
  schedule: PickupScheduleEntry[];
  disabledDates: DisabledDateEntry[];
}

export type TodayPickup =
  | { kind: 'available'; range: string; last: string }
  | { kind: 'ended'; range: string; last: string; nextOpen: string | null }
  | { kind: 'closed'; nextOpen: string | null }
  | { kind: 'disabled'; motivo: string | null; nextOpen: string | null };

export type WeekDay =
  | { kind: 'open'; name: string; isToday: boolean; range: string; last: string }
  | { kind: 'closed'; name: string; isToday: boolean }
  | { kind: 'disabled'; name: string; isToday: boolean; motivo: string | null };

export interface PickupHours {
  today: TodayPickup;
  week: WeekDay[];
}

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** The backend only offers the current and the next calendar week (`PickupSlotService`). */
const SCHEDULABLE_DAYS_AHEAD = 13;

function toMinutes(hhmm: string | null): number | null {
  const m = hhmm ? /^(\d{1,2}):(\d{2})/.exec(hhmm) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** `YYYY-MM-DD` of an instant, read in `timezone`. */
export function localDate(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

interface Window {
  start: number;
  end: number;
}

function windowOf(day: PickupScheduleEntry | undefined): Window | null {
  if (!day?.open) return null;
  const start = toMinutes(day.windowStart);
  const end = toMinutes(day.windowEnd);
  return start === null || end === null || end <= start ? null : { start, end };
}

/** Same rule as `PickupSlotService.slotsFor`: from the window start every step, the closing time excluded. */
function slotsOf(window: Window, slotMinutes: number): number[] {
  const step = Math.max(1, slotMinutes);
  const slots: number[] = [];
  for (let t = window.start; t < window.end; t += step) slots.push(t);
  return slots;
}

export function buildPickupHours(input: PickupHoursInput): PickupHours {
  const { now, timezone, leadMinutes, slotMinutes, schedule, disabledDates } = input;
  const byDay = new Map(schedule.map((d) => [d.dayOfWeek, d]));
  const disabled = new Map(disabledDates.map((d) => [d.fecha, d.motivo]));
  const today = localDate(now, timezone);
  const todayIso = isoWeekday(now, timezone);
  const isoOf = (date: string) => ((todayIso - 1 + daysBetween(today, date)) % 7 + 7) % 7 + 1;

  const dayState = (date: string) => {
    if (disabled.has(date)) return { disabled: true as const, motivo: disabled.get(date) ?? null };
    return { disabled: false as const, window: windowOf(byDay.get(isoOf(date))) };
  };

  const nextOpen = (): string | null => {
    for (let k = 1; k <= SCHEDULABLE_DAYS_AHEAD; k++) {
      const date = addDays(today, k);
      const state = dayState(date);
      if (state.disabled || !state.window) continue;
      return `${DAY_NAMES[isoOf(date) - 1]} desde las ${formatMinute(state.window.start)}`;
    }
    return null;
  };

  const todayState = dayState(today);
  let todayResult: TodayPickup;
  if (todayState.disabled) {
    todayResult = { kind: 'disabled', motivo: todayState.motivo, nextOpen: nextOpen() };
  } else if (!todayState.window) {
    todayResult = { kind: 'closed', nextOpen: nextOpen() };
  } else {
    const slots = slotsOf(todayState.window, slotMinutes);
    const range = `${formatMinute(todayState.window.start)} a ${formatMinute(todayState.window.end)}`;
    const last = formatMinute(slots[slots.length - 1]);
    // Seconds matter: a slot at exactly now + lead is offered, one a second earlier is not.
    const earliest = minuteOfDay(now, timezone) + now.getUTCSeconds() / 60 + leadMinutes;
    const hasSlotLeft = slots.some((t) => t >= earliest);
    todayResult = hasSlotLeft
      ? { kind: 'available', range, last }
      : { kind: 'ended', range, last, nextOpen: nextOpen() };
  }

  const monday = addDays(today, -(todayIso - 1));
  const week = DAY_NAMES.map((name, i): WeekDay => {
    const date = addDays(monday, i);
    const isToday = date === today;
    const state = dayState(date);
    if (state.disabled) return { kind: 'disabled', name, isToday, motivo: state.motivo };
    if (!state.window) return { kind: 'closed', name, isToday };
    const slots = slotsOf(state.window, slotMinutes);
    return {
      kind: 'open',
      name,
      isToday,
      range: `${formatMinute(state.window.start)} a ${formatMinute(state.window.end)}`,
      last: formatMinute(slots[slots.length - 1]),
    };
  });

  return { today: todayResult, week };
}

function daysBetween(from: string, to: string): number {
  const ms = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}

/** Monday of this week to Sunday of next week, in the restaurant timezone: what the backend can offer. */
export function schedulableRange(now: Date, timezone: string): { from: string; to: string } {
  const today = localDate(now, timezone);
  const monday = addDays(today, -(isoWeekday(now, timezone) - 1));
  return { from: monday, to: addDays(monday, SCHEDULABLE_DAYS_AHEAD) };
}
