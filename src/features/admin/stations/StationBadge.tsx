import { ChefHat, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DishStation } from '@/features/admin/services/adminApi';
import { STATION_LABEL } from './station';

/** Parrilla is highlighted with a flame; Cocina stays a quiet outline. */
export function StationBadge({ station }: { station: DishStation }) {
  const isParrilla = station === 'PARRILLA';
  const Icon = isParrilla ? Flame : ChefHat;
  return (
    <span
      data-station={station}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border pl-2 pr-2.5 py-[3px] whitespace-nowrap',
        'text-[10px] font-bold uppercase tracking-brand',
        isParrilla
          ? 'border-warning/55 bg-warning/20 text-[#5E4106]'
          : 'border-border text-foreground/80',
      )}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {STATION_LABEL[station]}
    </span>
  );
}
