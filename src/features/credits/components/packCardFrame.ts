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
