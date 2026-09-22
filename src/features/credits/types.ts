/**
 * Tipos del feature de credits (billetera/almuerzos).
 * Matchean (en su forma serializada) lo que expone el backend — ver
 * "Contrato con el backend" en `openspec/changes/b2c-credits-pivot/design.md`.
 */

export interface CreditWallet {
  available: number;
  committed: number;
  /** ISO-8601. Solo las compras de paquetes lo renuevan. */
  expiresAt: string | null;
}

export type MovementType =
  | 'WELCOME_GRANT'
  | 'PACK_PURCHASE'
  | 'DIRECT_PURCHASE'
  | 'COMMIT'
  | 'RELEASE'
  | 'CONSUME'
  | 'EXPIRATION'
  | 'PAYMENT_REVERSAL'
  | 'ADMIN_ADJUSTMENT';

export interface CreditMovement {
  id: number;
  type: MovementType;
  deltaAvailable: number;
  deltaCommitted: number;
  orderId: number | null;
  purchaseId: string | null;
  description: string | null;
  createdAt: string;
}

export interface CreditPack {
  id: number;
  code: string;
  nombre: string;
  creditAmount: number;
  priceCents: number;
  discountPercent: number;
  ordenDisplay: number;
  enabled: boolean;
}

export type PurchaseType = 'PACK' | 'DIRECT';

export interface CreatePurchasePayload {
  type: PurchaseType;
  packId?: number;
  orderId?: number;
}

export interface CreditPurchaseCheckout {
  purchaseId: string;
  initPoint: string;
}

/** Corresponde exactamente al CHECK `chk_credit_purchase_status` del backend. */
export type CreditPurchaseStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'REVERSED'
  | 'EXPIRED'
  | 'IN_MEDIATION';

export interface CreditPurchase {
  id: string;
  type: PurchaseType;
  creditAmount: number;
  amountCents: number;
  currency: string;
  status: CreditPurchaseStatus;
  createdAt: string;
  creditedAt: string | null;
  reversedAt: string | null;
}
