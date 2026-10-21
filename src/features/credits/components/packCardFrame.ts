import { cn } from '@/lib/utils';

export type PackCardLayout = 'row' | 'stacked';

/** Clases del marco común a las tarjetas de Sueltos y de los paquetes. */
export function packCardFrameClasses(checked: boolean): string {
  return cn(
    'relative flex w-full flex-col rounded-xl bg-card font-sans text-foreground',
    checked
      ? 'border-2 border-primary-deep shadow-[inset_0_0_0_2.5px_hsl(var(--card)),inset_0_0_0_3.5px_hsl(var(--primary-deep)),0_10px_22px_-10px_rgba(142,28,33,0.35)]'
      : 'border border-border shadow-[0_1px_2px_rgba(60,30,20,0.05),0_8px_18px_-10px_rgba(60,30,20,0.22)]',
  );
}

/**
 * Marco de las tarjetas-resumen del celular (mismo formato que la hoja
 * "Revisá tu compra"): borde rojo suave sin elegir; elegida, borde grueso
 * `primary-deep` con anillo interior. El padding se compensa (13px + 2px de
 * borde = 15px; 14px + 1px) para que nada se mueva al elegir.
 */
export function packSummaryFrameClasses(checked: boolean): string {
  return cn(
    'relative flex w-full flex-col gap-3 rounded-xl bg-card font-sans text-sm text-foreground',
    checked
      ? 'border-2 border-primary-deep p-[13px] shadow-[inset_0_0_0_2.5px_hsl(var(--card)),inset_0_0_0_3.5px_hsl(var(--primary-deep)),0_10px_22px_-10px_rgba(142,28,33,0.35)]'
      : 'border border-[rgba(220,44,46,0.38)] p-3.5 shadow-[0_1px_2px_rgba(60,30,20,0.05),0_8px_18px_-10px_rgba(142,28,33,0.22)]',
  );
}
