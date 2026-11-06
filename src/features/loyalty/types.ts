/** Contrato de `GET /api/v1/loyalty` (línea de beneficios). */

export type MilestoneStatus = 'LOCKED' | 'EARNED' | 'USED' | 'EXPIRED';
export type MilestoneKind = 'DESSERT' | 'LUNCH' | 'DISCOUNT';

export interface LoyaltyMilestone {
  /** Almuerzos del ciclo que hay que retirar para ganarlo. */
  lunches: number;
  kind: MilestoneKind;
  status: MilestoneStatus;
  /** ISO-8601; solo cuando el premio tiene vencimiento. */
  expiresAt: string | null;
  /** Solo para `DISCOUNT`. */
  percent?: number;
}

export interface LoyaltyCycle {
  /** ISO-8601. */
  startedAt: string;
  /** ISO-8601, exclusivo. */
  endsAt: string;
  lunches: number;
}

export interface PendingDessert {
  rewardId: number | string;
  expiresAt: string;
}

export interface LoyaltyEnabled {
  enabled: true;
  /** `null` sin historial o con el ciclo anterior ya terminado (`waiting`). */
  cycle: LoyaltyCycle | null;
  /** El ciclo terminó: el próximo arranca con el próximo almuerzo retirado. */
  waiting: boolean;
  milestones: LoyaltyMilestone[];
  pendingDessert: PendingDessert | null;
}

export type Loyalty = { enabled: false } | LoyaltyEnabled;

/** Postre elegible para canjear (`GET /api/v1/desserts/available`). */
export interface AvailableDessert {
  id: number;
  nombre: string;
  descripcion: string | null;
  fotoUrl: string | null;
  stockActual: number;
}
