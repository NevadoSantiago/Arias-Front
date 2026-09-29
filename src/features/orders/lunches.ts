/**
 * Formatea una cantidad de almuerzos con el singular/plural correcto.
 * Los textos orientados al usuario dicen SIEMPRE "almuerzos", nunca
 * "créditos" (proposal `b2c-credits-pivot`, "Vocabulario").
 */
export function formatLunches(count: number): string {
  return `${count} ${count === 1 ? 'almuerzo' : 'almuerzos'}`;
}

/** Los almuerzos de un pedido que ya salieron del saldo (pago parcial, F23); 0 si no hay o el backend no lo manda. */
export function balancePartOf(order: { creditsFromBalance?: number | null }): number {
  return Math.max(0, order.creditsFromBalance ?? 0);
}

/** Los almuerzos que cobra Mercado Pago en un pedido con pago parcial: el total menos la parte del saldo. */
export function mercadoPagoPartOf(order: { creditTotal: number; creditsFromBalance?: number | null }): number {
  return Math.max(0, order.creditTotal - balancePartOf(order));
}

/** "reservado" / "reservados" — el almuerzo comprometido de un pedido que espera el pago. */
export function reservedWord(count: number): string {
  return count === 1 ? 'reservado' : 'reservados';
}

/**
 * Pago parcial real: Mercado Pago está en juego y el saldo cubre solo una parte.
 * Los textos "N de tu saldo · M con Mercado Pago" solo valen con esta forma.
 */
export function isPartialPayment(order: {
  creditTotal: number;
  paidWithMercadoPago: boolean;
  creditsFromBalance?: number | null;
}): boolean {
  const fromBalance = balancePartOf(order);
  return order.paidWithMercadoPago && fromBalance > 0 && fromBalance < order.creditTotal;
}

/**
 * Un pedido con pago de Mercado Pago asociado que también reservó almuerzos del saldo
 * (parcial o cubierto entero por el saldo): al cancelarlo esos almuerzos vuelven.
 */
export function hasReservedBalanceWithMercadoPago(order: {
  paidWithMercadoPago: boolean;
  creditsFromBalance?: number | null;
}): boolean {
  return order.paidWithMercadoPago && balancePartOf(order) > 0;
}

/**
 * Un pedido parcial cancelado no dice cuánto volvió: el backend devuelve todo
 * `creditTotal` si el pago ya se había aprobado y solo la parte del saldo si
 * no, y el DTO no distingue ambos casos. Se evita un número que puede ser falso.
 */
export const PARTIAL_RETURNED_TO_BALANCE = 'Los almuerzos reservados volvieron a tu saldo';

/**
 * Un pedido cancelado que se pagaba con Mercado Pago: si el pago ya se había hecho,
 * el backend lo acredita al saldo al confirmarse (nunca se pierde). F26.
 */
export const MP_PAYMENT_CREDITED = 'Si pagaste con Mercado Pago, lo que pagaste se acredita en tu saldo.';

/** "ese almuerzo" / "esos N almuerzos": los que cubre Mercado Pago y se acreditan si el pago ya se hizo (F26). */
export function creditedLunchesPhrase(count: number): string {
  return count === 1 ? 'ese almuerzo' : `esos ${count} almuerzos`;
}

/** Aviso al cancelar un pedido esperando el pago: si el cliente ya pagó, se le acredita cuando se confirme. */
export function pendingPaymentCreditedNotice(mercadoPagoLunches: number): string {
  return `Si ya pagaste con Mercado Pago, cuando se confirme el pago te acreditamos ${creditedLunchesPhrase(mercadoPagoLunches)} en tu saldo.`;
}

/** Versión corta para el aviso de éxito al cancelar. */
export const PENDING_PAYMENT_CREDITED_TOAST =
  'Si ya pagaste con Mercado Pago, te acreditamos lo que pagaste en tu saldo cuando se confirme el pago.';
