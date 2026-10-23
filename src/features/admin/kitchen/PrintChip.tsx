import { AlertTriangle, CheckCircle2, Printer, TimerOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { PrintView } from './printStatus';

/** Print state of one commanded order. Polite live region so a state change is announced. */
export function PrintChip({ view }: { view: PrintView }) {
  return (
    <div aria-live="polite">
      {view.kind === 'queued' && (
        <div className="flex items-center gap-2 rounded bg-[#E3E9F1] px-2.5 py-2 text-[#2F3B4C]">
          <span aria-hidden="true" className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#2B5C8F] motion-reduce:animate-none" />
          <span className="text-[13px] font-bold">{view.label}</span>
          {view.detail && <span className="text-xs text-[#4A5566]">{view.detail}</span>}
        </div>
      )}
      {view.kind === 'printed' && (
        <div className="flex items-center gap-2 rounded bg-success/15 px-2.5 py-2 text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="text-[13px] font-bold">{view.label}</span>
        </div>
      )}
      {view.kind === 'failed' && (
        <div className="flex items-center gap-2 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-[7px] text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="text-[13px] font-bold">{view.label}</span>
        </div>
      )}
      {view.kind === 'expired' && (
        <div className="flex items-center gap-2 rounded border border-warning/45 bg-warning/15 px-2.5 py-[7px] text-[#5E4106]">
          <TimerOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="text-[13px] font-bold">{view.label}</span>
          {view.detail && <span className="text-xs">{view.detail}</span>}
        </div>
      )}
      {view.kind === 'none' && (
        <div className="flex items-center gap-2 rounded border border-dashed border-[#B3C3D9] px-2.5 py-[7px] text-[#4A5566]">
          <Printer className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold">{view.label}</span>
        </div>
      )}
    </div>
  );
}

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
