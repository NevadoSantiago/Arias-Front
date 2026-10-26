import { AlertTriangle, Check, Clock, TimerOff } from 'lucide-react';
import type { PrintStatus } from '@/features/admin/services/adminApi';
import { cn } from '@/lib/utils';
import { printStatusLabel } from './printStatus';
import { plural, type Timeline } from './kitchenBoard';

interface PickupTimelineProps {
  timeline: Timeline;
  overdueCount: number;
  onPickGroup: (key: string) => void;
  onPickOverdue: () => void;
}

const MARKER: Record<PrintStatus, string> = {
  PRINTED: 'border-success bg-success text-primary-foreground',
  QUEUED: 'border-[#2B5C8F] bg-[#E3E9F1] text-[#2B5C8F]',
  FAILED: 'border-destructive bg-destructive text-primary-foreground',
  EXPIRED: 'border-warning-deep bg-warning text-warning-foreground',
  NONE: 'border-warning-deep bg-warning text-warning-foreground',
};

function MarkerIcon({ status }: { status: PrintStatus }) {
  if (status === 'PRINTED') return <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />;
  if (status === 'FAILED') return <AlertTriangle className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />;
  if (status === 'QUEUED') {
    return <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-[#2B5C8F] motion-reduce:animate-none" />;
  }
  return <TimerOff className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />;
}

const pct = (offset: number) => `${offset * 100}%`;

/**
 * The next 60 minutes of pickups: one marker per occupied pickup minute, colored by the worst print
 * status of that minute. Clicking one jumps to its group.
 */
export function PickupTimeline({ timeline, overdueCount, onPickGroup, onPickOverdue }: PickupTimelineProps) {
  return (
    <section aria-label="Próximos 60 minutos" className="flex flex-col gap-1 rounded-md border border-border bg-card px-4 pb-2 pt-3">
      <div className="flex items-start gap-3">
        {overdueCount > 0 && (
          <button
            type="button"
            onClick={onPickOverdue}
            aria-label={`Atrasados ${overdueCount}`}
            className="mt-[18px] inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded bg-destructive px-3 text-xs font-bold text-primary-foreground"
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            Atrasados {overdueCount}
          </button>
        )}
        <div className="relative mr-[18px] h-[72px] min-w-0 flex-1">
          {/* Very light bands: 0-3 min and 3-10 min, where the countdown changes color. */}
          <div aria-hidden="true" className="absolute top-[25px] h-3 bg-primary-deep/10" style={{ left: 0, width: pct(3 / 60) }} />
          <div aria-hidden="true" className="absolute top-[25px] h-3 bg-warning/15" style={{ left: pct(3 / 60), width: pct(7 / 60) }} />
          <div aria-hidden="true" className="absolute inset-x-0 top-[30px] h-0.5 bg-border" />
          <div aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-primary-deep" />
          <span className="absolute left-1.5 top-0 whitespace-nowrap text-[11px] font-bold tabular-nums text-primary-deep">
            Ahora {timeline.nowLabel}
          </span>
          <span className="absolute right-0 top-0 whitespace-nowrap text-[11px] font-semibold tabular-nums text-muted-foreground">
            +60 min · {timeline.endLabel}
          </span>
          {timeline.ticks.map((tick) => (
            <div key={tick.offset} aria-hidden="true">
              <div className="absolute top-6 h-3.5 w-px bg-muted-foreground" style={{ left: pct(tick.offset) }} />
            </div>
          ))}
          {timeline.ticks.slice(1, -1).map((tick) => (
            <span
              key={`l-${tick.offset}`}
              className="absolute top-11 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums text-muted-foreground"
              style={{ left: pct(tick.offset) }}
            >
              {tick.label}
            </span>
          ))}
          {timeline.markers.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => onPickGroup(m.key)}
              aria-label={`${m.time}, ${plural(m.count, 'pedido', 'pedidos')}, ${printStatusLabel(m.worst)}`}
              className="absolute top-[9px] z-[1] flex h-11 w-11 -translate-x-1/2 items-center justify-center"
              style={{ left: pct(m.offset) }}
            >
              <span
                className={cn(
                  'relative flex h-[26px] w-[26px] items-center justify-center rounded-full border-2',
                  MARKER[m.worst],
                )}
              >
                <MarkerIcon status={m.worst} />
                {m.count > 1 && (
                  <span className="absolute -right-2.5 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-bold leading-none text-background">
                    {m.count}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>Cada punto es un minuto de retiro</span>
        <span>color = peor estado de impresión</span>
      </p>
    </section>
  );
}
