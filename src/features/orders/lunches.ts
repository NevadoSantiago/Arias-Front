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
 * Un pedido parcial cancelado no dice cuánto volvió: el backend devuelve todo
 * `creditTotal` si el pago ya se había aprobado y solo la parte del saldo si
 * no, y el DTO no distingue ambos casos. Se evita un número que puede ser falso.
 */
export const PARTIAL_RETURNED_TO_BALANCE = 'Los almuerzos reservados volvieron a tu saldo';
