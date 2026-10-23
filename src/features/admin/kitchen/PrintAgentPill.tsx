import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PrintAgentStatus } from '@/features/admin/services/adminApi';
import { formatClock, formatStamp } from '@/features/admin/printing/printTime';

interface Props {
  /** Undefined until the first answer; the pill stays hidden meanwhile. */
  status: PrintAgentStatus | undefined;
  /** Commanded orders whose ticket is still waiting to print. */
  queued: number;
  now: Date;
}

/** Header indicator of the print agent, with a popover that explains what is going on. */
export function PrintAgentPill({ status, queued, now }: Props) {
  const [open, setOpen] = useState(false);
  const popId = useId();
  if (!status) return null;

  const { online, lastSeenAt } = status;
  const label = online
    ? 'Ticketera en línea'
    : lastSeenAt ? `Sin conexión desde ${formatClock(lastSeenAt)}` : 'Sin conexión';
  const sub = online ? 'Programa de impresión activo' : 'Revisá la PC del local';

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={popId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex min-h-[44px] items-center gap-2.5 rounded-md border px-3.5 text-left',
          online ? 'border-border bg-card' : 'border-destructive/45 bg-destructive/10',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'h-2.5 w-2.5 shrink-0 rounded-full',
            online
              ? 'bg-success ring-[3px] ring-success/25'
              : 'bg-destructive ring-[3px] ring-destructive/20 animate-pulse motion-reduce:animate-none',
          )}
        />
        <span className="flex flex-col leading-tight">
          <span className={cn('text-xs font-bold', online ? 'text-success' : 'text-destructive')}>{label}</span>
          <span className="text-[11px] text-muted-foreground">{sub}</span>
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          id={popId}
          className="absolute right-0 top-[calc(100%+8px)] z-30 flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-md border border-border bg-card p-4 shadow-lg"
        >
          <p className="text-[11px] font-bold uppercase tracking-brand text-muted-foreground">
            Programa de impresión
          </p>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13px]">
            <dt className="text-muted-foreground">Dónde corre</dt>
            <dd className="font-semibold">PC del local</dd>
            <dt className="text-muted-foreground">Estado</dt>
            <dd className="font-semibold">{online ? 'En línea' : 'Sin conexión'}</dd>
            <dt className="text-muted-foreground">Último contacto</dt>
            <dd className="font-semibold">{lastSeenAt ? formatStamp(lastSeenAt, now, true) : 'nunca'}</dd>
            <dt className="text-muted-foreground">En cola ahora</dt>
            <dd className="font-semibold">{queued === 1 ? '1 comanda' : `${queued} comandas`}</dd>
          </dl>
          {!online && (
            <p className="text-xs leading-snug text-muted-foreground">
              Las comandas quedan en cola y salen solas cuando el programa vuelva. Si no salen en 30
              min, vencen. Fijate que la PC del local esté prendida, con internet y con el programa
              de impresión abierto.
            </p>
          )}
          <Link
            to="/admin/printers"
            className="self-start text-xs font-semibold uppercase tracking-brand text-primary-deep underline"
          >
            Ver ticketeras
          </Link>
        </div>
      )}
    </div>
  );
}
