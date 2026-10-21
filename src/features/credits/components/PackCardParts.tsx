import { cn } from '@/lib/utils';

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
