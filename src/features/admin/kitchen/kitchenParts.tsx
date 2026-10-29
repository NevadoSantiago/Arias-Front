import { cn } from '@/lib/utils';
import type { BoardOrder } from './kitchenBoard';
import type { DishSummary } from './dashboardDay';

/** One numbered row per dish, each with its own note right under it. */
export function Items({
  order,
  className,
  badgeClassName,
  compact = false,
}: {
  order: Pick<BoardOrder, 'items'>;
  className: string;
  badgeClassName: string;
  compact?: boolean;
}) {
  return (
    <ol className={cn('flex flex-col', compact && 'mt-1')}>
      {order.items.map((item, i) => (
        <li
          key={i}
          className={cn('flex items-start gap-2.5 py-1.5 first:pt-0 last:pb-0', i > 0 && 'border-t border-foreground/15')}
        >
          <span
            aria-hidden="true"
            className={cn(
              'mt-px flex shrink-0 items-center justify-center rounded-full font-bold text-primary-foreground',
              compact ? 'h-5 w-5 text-[11px]' : 'h-6 w-6 text-xs',
              badgeClassName,
            )}
          >
            {i + 1}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={className}>
              {item.sideNombre ? `${item.dishNombre} c/ ${item.sideNombre}` : item.dishNombre}
            </span>
            <Note notas={item.notas} compact={compact} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function Note({
  notas,
  compact = false,
  label = 'Nota',
}: {
  notas: string | null;
  compact?: boolean;
  label?: string;
}) {
  if (!notas) return null;
  return (
    <p className={compact ? 'text-[13px] leading-snug' : 'text-[15px] leading-snug'}>
      <strong className="mr-1.5 text-[11px] uppercase tracking-brand text-destructive">{label}</strong>
      <span>{notas}</span>
    </p>
  );
}

/** The note of the whole order, labelled apart from the dish notes. */
export function OrderNote({ notas, compact = false }: { notas: string | null; compact?: boolean }) {
  return <Note notas={notas} compact={compact} label="Nota del pedido" />;
}

export function CountBadge({ n, className }: { n: number; className: string }) {
  return (
    <span
      className={cn(
        'flex min-w-[2rem] items-center justify-center rounded-full px-2.5 font-bold text-primary-foreground',
        className,
      )}
    >
      {n}
    </span>
  );
}

export function EmptyState({ title, hint, className }: { title: string; hint: string; className: string }) {
  return (
    <div className={cn('flex flex-col gap-1 rounded-md border border-dashed px-4 py-8 text-center', className)}>
      <p className="text-lg font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

/** The dishes to prepare: how many of each, with the breakdown by side. */
export function DishList({ dishes, label }: { dishes: DishSummary['dishes']; label?: string }) {
  return (
    <ul aria-label={label} className="flex flex-col">
      {dishes.map((dish) => (
        <li key={dish.name} className="flex items-baseline gap-3 border-t border-border py-2.5 first:border-t-0 first:pt-0">
          <span className="min-w-[3rem] shrink-0 font-display text-3xl font-bold leading-none">{dish.count} ×</span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="break-words text-[17px] font-semibold leading-snug">{dish.name}</span>
            <span className="text-[13px] text-muted-foreground">{dish.breakdown}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
