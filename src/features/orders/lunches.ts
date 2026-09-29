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
