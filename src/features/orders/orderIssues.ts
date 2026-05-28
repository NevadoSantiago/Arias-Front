import type { DailyChoice } from './types';

export interface OrderIssues {
  hasAny: boolean;
  dishDisabled: boolean;
  sideDisabled: boolean;
  /** Lista de items afectados ("el plato", "el acompañamiento"). */
  affectedItems: string[];
  /** Mensaje listo para mostrar — combina los items en una frase. */
  summary: string;
}

/**
 * Detecta si el pedido tiene cambios respecto a su estado actual (plato/side
 * fueron desactivados por el admin después de que el empleado eligió).
 */
export function detectOrderIssues(order: DailyChoice): OrderIssues {
  const dishDisabled = !order.dishEnabled;
  const sideDisabled = order.sideEnabled === false;
  const affectedItems: string[] = [];
  if (dishDisabled) affectedItems.push('el plato');
  if (sideDisabled) affectedItems.push('el acompañamiento');

  let summary = '';
  if (affectedItems.length === 1) {
    summary = `${capitalize(affectedItems[0])} que elegiste ya no está disponible`;
  } else if (affectedItems.length === 2) {
    summary = 'El plato y el acompañamiento que elegiste ya no están disponibles';
  }

  return {
    hasAny: dishDisabled || sideDisabled,
    dishDisabled,
    sideDisabled,
    affectedItems,
    summary,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
