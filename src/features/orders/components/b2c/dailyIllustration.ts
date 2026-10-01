/** Cantidad de ilustraciones del pedido de escritorio que rotan por día. */
export const DAILY_ILLUSTRATION_COUNT = 5;

/** Fecha LOCAL como "YYYY-MM-DD". */
function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Qué ilustración toca hoy: un hash de la fecha local `YYYY-MM-DD` módulo
 * `count`. Es la misma todo el día para todos y cambia al día siguiente.
 */
export function dailyIllustrationIndex(date: Date, count = DAILY_ILLUSTRATION_COUNT): number {
  let hash = 0;
  for (const char of localDateKey(date)) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % count;
}
