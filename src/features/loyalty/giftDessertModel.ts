import { isInFuture } from './timelineModel';
import type { Loyalty, PendingDessert } from './types';

/** El postre de regalo ganado y todavía vigente; `null` si no hay (o la función está apagada / sin cargar). */
export function pendingGift(loyalty: Loyalty | undefined): PendingDessert | null {
  if (!loyalty || !loyalty.enabled) return null;
  const pending = loyalty.pendingDessert;
  return pending && isInFuture(pending.expiresAt) ? pending : null;
}

/**
 * Almuerzos que le faltan al cliente para ganar su postre de regalo, según lo que informa el
 * servidor (el hito `DESSERT` y el contador del ciclo). `null` si ya lo ganó, lo usó, venció o
 * tiene uno pendiente, y también si la función está apagada o el hito no existe.
 */
export function lunchesToDessert(loyalty: Loyalty | undefined): number | null {
  if (!loyalty || !loyalty.enabled || pendingGift(loyalty)) return null;
  const dessert = loyalty.milestones.find((m) => m.kind === 'DESSERT');
  if (!dessert || dessert.status !== 'LOCKED') return null;
  const missing = dessert.lunches - (loyalty.cycle?.lunches ?? 0);
  return missing > 0 ? missing : null;
}

export function dessertTeaser(missing: number): string {
  return `${missing === 1 ? 'Te falta 1 almuerzo' : `Te faltan ${missing} almuerzos`} para tu postre de regalo.`;
}
