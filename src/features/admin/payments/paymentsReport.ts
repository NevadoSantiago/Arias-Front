import type { CreditPurchaseStatus } from '@/features/credits/types';
import type { KindBreakdown, PaymentKind, PaymentRow } from './paymentsApi';

export type { PaymentRow } from './paymentsApi';

export const KIND_LABEL: Record<PaymentKind, string> = {
  INDIVIDUAL: 'Individual',
  SUGERIDO: 'Sugerido',
  OTRO: 'Otro',
  DIRECT: 'Pago directo',
};

/** Slice colours of the approved design; the legend repeats the label so colour is never the only cue. */
export const KIND_COLOR: Record<PaymentKind, string> = {
  INDIVIDUAL: '#B3252B',
  SUGERIDO: '#D99A2B',
  OTRO: '#1F63A8',
  DIRECT: '#3D5F27',
};

export const STATUS_LABEL: Record<CreditPurchaseStatus, string> = {
  APPROVED: 'Aprobado',
  PENDING: 'Pendiente',
  IN_MEDIATION: 'En mediación',
  REVERSED: 'Reembolsado',
  REJECTED: 'Rechazado',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Vencido',
};

const DAY_MS = 86_400_000;

/** Calendar day (`YYYY-MM-DD`) of an instant as seen in `timezone`. */
export function todayIn(timezone: string, now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export type QuickRangeKey = 'today' | '7d' | '30d';

export const QUICK_RANGES: { key: QuickRangeKey; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: '7d', label: 'Últimos 7 días' },
  { key: '30d', label: 'Últimos 30 días' },
];

const RANGE_DAYS: Record<QuickRangeKey, number> = { today: 1, '7d': 7, '30d': 30 };

/** Inclusive range ending `today`. */
export function quickRange(key: QuickRangeKey, today: string): { from: string; to: string } {
  return { from: addDays(today, 1 - RANGE_DAYS[key]), to: today };
}

export function formatPaymentDate(instant: string, timezone: string): { date: string; time: string } {
  const d = new Date(instant);
  return {
    date: new Intl.DateTimeFormat('es-AR', {
      timeZone: timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d),
    time: new Intl.DateTimeFormat('es-AR', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(d),
  };
}

export function conceptOf(row: PaymentRow): string {
  if (row.kind === 'DIRECT') return `${KIND_LABEL.DIRECT} · pedido N°${row.orderId ?? ''}`;
  return row.packName ? `${KIND_LABEL[row.kind]} · ${row.packName}` : KIND_LABEL[row.kind];
}

export interface KindShare extends KindBreakdown {
  label: string;
  percent: number;
}

export function kindShares(byKind: KindBreakdown[]): KindShare[] {
  const total = byKind.reduce((sum, k) => sum + k.count, 0);
  return byKind.map((k) => ({
    ...k,
    label: KIND_LABEL[k.kind],
    percent: total === 0 ? 0 : Math.round((k.count / total) * 100),
  }));
}

export interface DonutGeometry {
  cx: number;
  cy: number;
  outer: number;
  inner: number;
}

export interface DonutSlice {
  /** Position in the input array (empty slices are skipped, so it may not be contiguous). */
  index: number;
  d: string;
}

const round = (n: number) => Number(n.toFixed(3));

/** Annular-sector paths, clockwise from 12 o'clock. A lone slice is drawn as a (nearly) full ring. */
export function donutSlices(values: number[], { cx, cy, outer, inner }: DonutGeometry): DonutSlice[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  const point = (r: number, angle: number) =>
    `${round(cx + r * Math.sin(angle))} ${round(cy - r * Math.cos(angle))}`;
  let start = 0;
  const slices: DonutSlice[] = [];
  values.forEach((value, index) => {
    if (value <= 0) return;
    const full = (value / total) * 2 * Math.PI;
    const end = start + Math.min(full, 2 * Math.PI - 0.0001);
    const large = full > Math.PI ? 1 : 0;
    slices.push({
      index,
      d:
        `M${point(outer, start)} A${outer} ${outer} 0 ${large} 1 ${point(outer, end)} ` +
        `L${point(inner, end)} A${inner} ${inner} 0 ${large} 0 ${point(inner, start)} Z`,
    });
    start += full;
  });
  return slices;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function missingFeeNote(rowsWithoutFee: number): string | null {
  if (rowsWithoutFee <= 0) return null;
  return rowsWithoutFee === 1
    ? '1 pago sin dato de comisión: el neto no lo incluye.'
    : `${rowsWithoutFee} pagos sin dato de comisión: el neto no los incluye.`;
}

export function asideNote(inMediation: number, reversed: number): string | null {
  const parts = [
    inMediation > 0 ? plural(inMediation, 'pago en mediación', 'pagos en mediación') : null,
    reversed > 0 ? plural(reversed, 'pago reembolsado', 'pagos reembolsados') : null,
  ].filter((p): p is string => p !== null);
  if (parts.length === 0) return null;
  return `En este rango además hay ${parts.join(' y ')}, que no suman al ingreso.`;
}
