import type { LoyaltyMilestone } from './types';

export type NodeStatus = 'locked' | 'ready' | 'done' | 'expired';

/** Posiciones (en %) de los hitos sobre la línea: escala visual, NO proporcional a los almuerzos. */
function anchorsFor(count: number): number[] {
  if (count === 3) return [30, 66, 92];
  return Array.from({ length: count }, (_, i) => Math.round((92 * (i + 1)) / count));
}

/**
 * Posición (0..100) de un valor de almuerzos sobre la línea. Los hitos van en
 * posiciones fijas por orden; entre ellos se interpola; pasado el último hito
 * la línea se acerca de a poco al 100%.
 */
export function positionFor(lunches: number, thresholds: number[]): number {
  if (lunches <= 0 || thresholds.length === 0) return 0;
  const anchors = anchorsFor(thresholds.length);
  let prevAt = 0;
  let prevPos = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (lunches <= thresholds[i]) {
      return prevPos + ((lunches - prevAt) / (thresholds[i] - prevAt)) * (anchors[i] - prevPos);
    }
    prevAt = thresholds[i];
    prevPos = anchors[i];
  }
  return Math.min(100, prevPos + (lunches - prevAt) * 2);
}

/** "20/10": día/mes sin ceros, en la hora local. */
export function formatDayMonth(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

const DAY_MS = 86_400_000;

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Días de calendario (hora local) que faltan para `iso`; 0 es "hoy". */
export function daysUntil(iso: string, now: Date = new Date()): number {
  return Math.round((startOfLocalDay(new Date(iso)) - startOfLocalDay(now)) / DAY_MS);
}

/** Si `iso` todavía no pasó. */
export function isInFuture(iso: string, now: Date = new Date()): boolean {
  return new Date(iso).getTime() > now.getTime();
}

export function expiryText(daysLeft: number): string {
  if (daysLeft <= 0) return 'vence hoy';
  if (daysLeft === 1) return 'vence mañana';
  return `vence en ${daysLeft} días`;
}

/** El estado visual del hito. Sin ciclo activo todos se ven bloqueados (los premios pendientes van en chips). */
export function statusFor(m: LoyaltyMilestone, cycleActive: boolean): NodeStatus {
  if (!cycleActive) return 'locked';
  switch (m.status) {
    case 'EARNED':
      // Un almuerzo de regalo se acredita solo: no hay nada para "usar".
      return m.kind === 'LUNCH' ? 'done' : 'ready';
    case 'USED':
      return 'done';
    case 'EXPIRED':
      return 'expired';
    default:
      return 'locked';
  }
}

export function rewardText(m: LoyaltyMilestone): string {
  switch (m.kind) {
    case 'DESSERT':
      return 'un postre de regalo';
    case 'LUNCH':
      return 'un almuerzo de regalo';
    default:
      return `${m.percent ?? 10}% off en tu próxima compra`;
  }
}

export function rewardTitle(m: LoyaltyMilestone): string {
  switch (m.kind) {
    case 'DESSERT':
      return 'Postre de regalo';
    case 'LUNCH':
      return 'Almuerzo de regalo';
    default:
      return `${m.percent ?? 10}% off`;
  }
}
