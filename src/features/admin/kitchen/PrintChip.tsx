import { useId } from 'react';
import { AlertTriangle, CheckCircle2, Printer, TimerOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { PrintView } from './printStatus';

/**
 * Print state of one commanded order: icon + short text. The detail (e.g. the time it printed) is
 * a tooltip that shows on hover and on keyboard focus. The status text is a polite live region so
 * a change is announced.
 */
export function PrintBadge({ view }: { view: PrintView }) {
  const tooltipId = useId();
  return (
    <div className="group relative inline-flex">
      <span
        tabIndex={0}
        aria-describedby={tooltipId}
        className={cn(
          'inline-flex h-9 cursor-default items-center gap-1.5 rounded border px-2.5 text-[13px] font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          BADGE[view.kind].box,
        )}
      >
        {view.kind === 'queued' && (
          <span aria-hidden="true" className="mx-0.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#2B5C8F] motion-reduce:animate-none" />
        )}
        {view.kind === 'printed' && <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
        {view.kind === 'failed' && <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />}
        {view.kind === 'expired' && <TimerOff className="h-4 w-4 shrink-0" aria-hidden="true" />}
        {view.kind === 'none' && <Printer className="h-4 w-4 shrink-0" aria-hidden="true" />}
        <span aria-live="polite">{view.label}</span>
        {view.detail && <span className="text-xs font-medium">{view.detail}</span>}
      </span>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-0 z-20 mb-1.5 whitespace-nowrap rounded bg-foreground px-2.5 py-1.5 text-xs font-medium text-background opacity-0 shadow-md transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {view.title}
      </span>
    </div>
  );
}

const BADGE: Record<PrintView['kind'], { box: string }> = {
  queued: { box: 'border-transparent bg-[#E3E9F1] text-[#2F3B4C]' },
  printed: { box: 'border-transparent bg-success/15 text-success' },
  failed: { box: 'border-destructive/30 bg-destructive/10 text-destructive' },
  expired: { box: 'border-warning/45 bg-warning/15 text-[#5E4106]' },
  none: { box: 'border-dashed border-[#B3C3D9] text-[#4A5566]' },
};

/** Shown above the commanded orders when a ticket failed or expired. */
export function ProblemBanner({ headline, className }: { headline: string; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border-2 border-destructive/60 bg-destructive/10 px-4 py-3',
        className,
      )}
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
      <p className="min-w-0 flex-1 basis-[320px] text-sm leading-snug">
        <strong className="font-bold">{headline}</strong>{' '}
        Fijate que la ticketera esté prendida, con papel y la tapa cerrada, y tocá Reimprimir.
      </p>
      <Link
        to="/admin/printers"
        className="text-xs font-semibold uppercase tracking-brand text-primary-deep underline"
      >
        Ver ticketeras
      </Link>
    </div>
  );
}
