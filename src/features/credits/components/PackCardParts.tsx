import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { PackCardLayout } from './packCardFrame';

/** Sello redondo con tilde, en la esquina superior derecha de la tarjeta elegida. */
export function SelectedSeal() {
  return (
    <span
      data-part="selected-seal"
      aria-hidden="true"
      className="absolute -right-[7px] -top-[9px] flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-background bg-primary-deep text-primary-foreground"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}

/** Cinta roja centrada sobre el borde inferior de la tarjeta recomendada. */
export function BestOptionRibbon() {
  const tail = 'h-[17px] w-[14px] bg-[#8E1C21]';
  return (
    <span className="pointer-events-none absolute inset-x-0 -bottom-[11px] flex items-end justify-center">
      <span
        aria-hidden="true"
        className={cn(tail, '-mb-1 -mr-1.5')}
        style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 40% 50%)' }}
      />
      <span
        data-part="recommended-ribbon"
        className="relative inline-flex h-[22px] items-center bg-primary-deep px-3.5 font-display text-[11px] font-extrabold uppercase tracking-[0.08em] text-primary-foreground shadow-[0_1px_3px_rgba(80,20,20,0.18)]"
      >
        Mejor opción
      </span>
      <span
        aria-hidden="true"
        className={cn(tail, '-mb-1 -ml-1.5')}
        style={{ clipPath: 'polygon(0 0, 100% 0, 60% 50%, 100% 100%, 0 100%)' }}
      />
    </span>
  );
}

/** Número de almuerzos como protagonista; la palabra debajo (escritorio) o al lado (celular). */
export function CountBlock({ count, word, layout }: { count: number; word: string; layout: PackCardLayout }) {
  const stacked = layout === 'stacked';
  return (
    <span
      data-part="count-block"
      data-layout={layout}
      className={cn('flex w-full justify-center', stacked ? 'flex-col items-center gap-1' : 'items-baseline gap-2')}
    >
      <span className={cn('font-display font-black leading-none text-foreground', stacked ? 'text-[46px]' : 'text-[40px]')}>
        {count}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-brand text-muted-foreground">{word}</span>
    </span>
  );
}

/** Lema entre dos líneas punteadas, estilo ticket. */
export function TaglineRow({ children }: { children: ReactNode }) {
  return (
    <span className="flex w-full items-center gap-2.5">
      <span aria-hidden="true" className="flex-1 border-t border-dashed border-border" />
      <span className="shrink-0 text-center text-[10px] font-bold uppercase tracking-brand text-primary-deep">{children}</span>
      <span aria-hidden="true" className="flex-1 border-t border-dashed border-border" />
    </span>
  );
}

/** Precio por almuerzo, centrado, en letras rojas y sin recuadro. */
export function PriceBlock({ price }: { price: string }) {
  return (
    <span data-part="price-block" className="flex w-full flex-col items-center gap-0.5">
      <span className="font-display text-[24px] font-black leading-tight text-primary-deep">{price}</span>
      <span className="text-[11px] text-muted-foreground">por almuerzo</span>
    </span>
  );
}
