import type { PackCatalog } from './purchaseModel';

/** "1, 5 o 20": las cantidades que se pueden comprar, armadas desde el catálogo habilitado. */
export function formatAmountList(amounts: number[]): string {
  if (amounts.length === 0) return 'la cantidad que quieras';
  if (amounts.length === 1) return String(amounts[0]);
  return `${amounts.slice(0, -1).join(', ')} o ${amounts[amounts.length - 1]}`;
}

/** Cantidades de almuerzos del catálogo habilitado (Sueltos incluido), ascendentes y sin repetir. */
export function catalogAmounts(catalog: Pick<PackCatalog, 'dayPack' | 'namedPacks'>): number[] {
  const all = [...(catalog.dayPack ? [catalog.dayPack] : []), ...catalog.namedPacks].map((p) => p.creditAmount);
  return [...new Set(all)].sort((a, b) => a - b);
}
