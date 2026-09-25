import { cn } from '@/lib/utils';
import type { MenuSection } from '../../types';
import type { ActiveFilter } from '../FilterPills';

export type { ActiveFilter };

interface Props {
  sections: MenuSection[];
  active: ActiveFilter;
  counts: Record<number | 'all', number>;
  onChange: (filter: ActiveFilter) => void;
}

/**
 * Pills de sección B2C (F8, prototipo aprobado `Main.dc.html` — filtros del
 * menú). Reemplaza a `FilterPills` SOLO en `B2cOrderPage`: misma semántica
 * de filtro (mismo tipo `ActiveFilter`, deshabilita secciones sin platos
 * disponibles), estilo del prototipo (fila de pills, sin el botón redondo
 * "volver arriba" de `FilterPills`). `FilterPills` sigue igual para
 * `CompanyOrderPage` (B2B).
 */
export function SectionPills({ sections, active, counts, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Filtrar por sección"
      data-testid="section-pills"
      className="no-scrollbar flex gap-2 overflow-x-auto pb-1"
    >
      <Pill label="Todos" active={active === 'all'} onClick={() => onChange('all')} />
      {sections.map((section) => (
        <Pill
          key={section.id}
          label={section.nombre}
          active={active === section.id}
          disabled={(counts[section.id] ?? 0) === 0}
          onClick={() => onChange(section.id)}
        />
      ))}
    </div>
  );
}

interface PillProps {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function Pill({ label, active, disabled = false, onClick }: PillProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-11 shrink-0 items-center rounded-full border px-[18px] text-[13.5px] font-semibold',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active
          ? 'border-foreground bg-foreground text-background'
          : disabled
            ? 'border-border bg-transparent text-muted-foreground/50 cursor-not-allowed'
            : 'border-border bg-card text-foreground hover:border-primary hover:text-primary cursor-pointer',
      )}
    >
      {label}
    </button>
  );
}
