import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MenuSection } from '../types';

export type ActiveFilter = 'all' | number;

interface Props {
  sections: MenuSection[];
  active: ActiveFilter;
  counts: Record<number | 'all', number>;
  onChange: (filter: ActiveFilter) => void;
}

export function FilterPills({ sections, active, counts, onChange }: Props) {
  const handleClick = (filter: ActiveFilter) => {
    onChange(filter);
    if (filter === 'all') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const el = document.getElementById(`section-${filter}`);
      if (el) {
        const offset = 120;
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Navegar por sección"
      className={[
        'flex gap-2 overflow-x-auto pb-2',
        'sm:flex-wrap sm:overflow-visible sm:pb-0',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      ].join(' ')}
    >
      <button
        type="button"
        aria-label="Volver arriba"
        onClick={() => handleClick('all')}
        className={cn(
          'inline-flex items-center justify-center w-9 h-9 rounded-full border shrink-0',
          'bg-card border-border text-foreground hover:border-primary hover:text-primary cursor-pointer',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'sticky left-0 z-10 shadow-[0_0_0_8px_hsl(var(--background))] sm:static sm:shadow-none'
        )}
      >
        <ArrowUp className="w-4 h-4" />
      </button>
      {sections.map((section) => {
        const count = counts[section.id] ?? 0;
        return (
          <Pill
            key={section.id}
            label={section.nombre}
            count={count}
            active={active === section.id}
            disabled={count === 0}
            onClick={() => handleClick(section.id)}
          />
        );
      })}
    </div>
  );
}

interface PillProps {
  label: string;
  count: number;
  active: boolean;
  disabled?: boolean;
  /** Pin a la izquierda mientras se hace scroll horizontal (solo mobile) */
  sticky?: boolean;
  onClick: () => void;
}

function Pill({ label, count, active, disabled = false, sticky = false, onClick }: PillProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs shrink-0',
        'uppercase tracking-brand font-medium',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active
          ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
          : disabled
            ? 'bg-transparent border-border text-muted-foreground/50 cursor-not-allowed'
            : 'bg-card border-border text-foreground hover:border-primary hover:text-primary cursor-pointer',
        // Sticky-left: TODOS queda anclado al borde izquierdo del scroll en mobile.
        // El box-shadow con spread=8px y color=background crea un "halo" INVISIBLE
        // (mismo color que el fondo de página) que oculta las pills que pasan por
        // detrás antes de cruzar el borde del scroll — eliminando ese "cuadradito"
        // que asomaba alrededor de TODOS.
        sticky &&
          'sticky left-0 z-10 shadow-[0_0_0_8px_hsl(var(--background))] sm:static sm:shadow-none'
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          'text-[10px] tracking-normal font-normal px-1.5 rounded-full',
          active
            ? 'bg-primary-foreground/20 text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {count}
      </span>
    </button>
  );
}
