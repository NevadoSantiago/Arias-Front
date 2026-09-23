/**
 * Formatea una cantidad de almuerzos con el singular/plural correcto.
 * Los textos orientados al usuario dicen SIEMPRE "almuerzos", nunca
 * "créditos" (proposal `b2c-credits-pivot`, "Vocabulario").
 */
export function formatLunches(count: number): string {
  return `${count} ${count === 1 ? 'almuerzo' : 'almuerzos'}`;
}
