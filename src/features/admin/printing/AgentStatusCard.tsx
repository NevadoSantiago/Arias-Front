import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PrintAgentStatus } from '@/features/admin/services/adminApi';
import { formatClock, formatStamp } from './printTime';

interface Props {
  status: PrintAgentStatus;
  checking: boolean;
  onRecheck: () => void;
}

/** Whether the PC at the restaurant (the print agent) is connected, with a manual re-check. */
export function AgentStatusCard({ status, checking, onRecheck }: Props) {
  const { online, lastSeenAt } = status;
  const label = online
    ? 'Ticketera en línea'
    : lastSeenAt ? `Sin conexión desde ${formatClock(lastSeenAt)}` : 'Sin conexión';
  const help = online
    ? 'El programa de impresión de la PC del local está conectado y toma las comandas en cuanto se comandan.'
    : 'Las comandas quedan en cola y salen solas cuando vuelva. Fijate que la PC del local esté prendida, con internet y con el programa de impresión abierto.';
  const last = lastSeenAt ? formatStamp(lastSeenAt, new Date(), true) : 'nunca';

  return (
    <section
      aria-labelledby="printer-agent-title"
      className={cn(
        'flex flex-wrap items-center gap-x-6 gap-y-4 rounded-md border p-5 px-6',
        online ? 'border-success/40 bg-success/10' : 'border-destructive/45 bg-destructive/10',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-3.5 w-3.5 shrink-0 rounded-full',
          online
            ? 'bg-success ring-[5px] ring-success/20'
            : 'bg-destructive ring-[5px] ring-destructive/20 animate-pulse motion-reduce:animate-none',
        )}
      />
      <div className="flex min-w-0 flex-1 basis-[420px] flex-col gap-1">
        <h2
          id="printer-agent-title"
          className={cn('text-lg font-bold', online ? 'text-success' : 'text-destructive')}
        >
          {label}
        </h2>
        <p className="text-sm leading-normal text-foreground/80">{help}</p>
        <p className="text-xs text-muted-foreground">
          Último contacto: {last} · Cuenta como en línea si consultó en los últimos 30 s.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onRecheck}
        disabled={checking}
        className="min-h-11 uppercase tracking-brand text-xs font-semibold"
      >
        <RefreshCw className={cn('w-3.5 h-3.5 mr-2', checking && 'animate-spin')} aria-hidden="true" />
        {checking ? 'Consultando…' : 'Volver a consultar'}
      </Button>
    </section>
  );
}
