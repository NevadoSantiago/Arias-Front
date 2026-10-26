import { useEffect, useRef, useState } from 'react';
import { Check, Clock, Printer, Receipt, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatCountdown,
  plural,
  type BoardOrder,
  type GroupTone,
  type KitchenBoard,
  type OverdueOrder,
} from './kitchenBoard';
import { CountBadge, EmptyState, OrderNote } from './kitchenParts';
import { PickupTimeline } from './PickupTimeline';
import { PrintBadge, ProblemBanner } from './PrintChip';
import { describePrint, problemSummary, type PrintView } from './printStatus';

export interface CommandedBoxProps {
  board: KitchenBoard;
  leadMinutes: number;
  /** Disables every action while a move is in flight, so a double click cannot fire it twice. */
  busy: boolean;
  /** IANA zone of the restaurant, to show the time a ticket was printed. */
  timezone: string;
  /** Undefined until the first print agent status arrives. */
  agentOnline: boolean | undefined;
  /** Orders that were just sent to reprint: their button says "Enviada" for a moment. */
  reprinted: ReadonlySet<number>;
  onReprint: (order: BoardOrder) => void;
  onEntregar: (orders: BoardOrder[]) => void;
}

/** How long a group stays highlighted after its timeline marker was clicked. */
const HIGHLIGHT_MS = 2_000;

const TONE: Record<GroupTone | 'overdue', string> = {
  calm: 'text-muted-foreground',
  soon: 'text-warning-deep',
  urgent: 'font-semibold text-primary-deep',
  overdue: 'font-semibold text-primary-deep',
};

/** The ticket of an order: grouped lines (`2x Milanesa`, `2x C/papas`) and its notes. */
function TicketLines({ order }: { order: BoardOrder }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 text-[13px] leading-snug">
      {order.lines.map((line, i) => (
        <div key={i} className="flex flex-col">
          <span className="font-semibold">{`${line.qty}x ${line.dish}`}</span>
          {line.side && <span className="pl-4 text-muted-foreground">{`${line.qty}x C/${line.side}`}</span>}
          {line.note && <span className="pl-4 italic text-muted-foreground">{line.note}</span>}
        </div>
      ))}
      <OrderNote notas={order.notas} compact />
    </div>
  );
}

function ReprintButton({
  order,
  view,
  sent,
  onReprint,
}: {
  order: BoardOrder;
  view: PrintView;
  sent: boolean;
  onReprint: (order: BoardOrder) => void;
}) {
  const problem = view.kind === 'failed' || view.kind === 'expired';
  const Icon = sent ? Check : problem ? RotateCcw : Printer;
  return (
    <button
      type="button"
      aria-label={`${view.actionLabel} comanda del pedido N° ${order.id}`}
      title={view.actionLabel}
      disabled={view.actionDisabled}
      onClick={() => onReprint(order)}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-1.5 rounded border bg-transparent text-[13px] font-bold hover:bg-primary-deep/10',
        problem ? 'border-2 border-destructive px-3 text-destructive' : 'w-11 border-border text-foreground',
        view.actionDisabled && !sent && 'opacity-45',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {problem || sent ? (sent ? 'Enviada' : view.actionLabel) : null}
    </button>
  );
}

function OrderRow({
  order,
  late,
  busy,
  timezone,
  agentOnline,
  reprinted,
  onReprint,
  onEntregar,
}: Pick<CommandedBoxProps, 'busy' | 'timezone' | 'agentOnline' | 'onReprint' | 'onEntregar'> & {
  order: BoardOrder;
  late?: string;
  reprinted: boolean;
}) {
  const view = describePrint(order, { agentOnline, timezone });
  return (
    <article
      aria-label={`Pedido N° ${order.id}, ${order.customerNickname}`}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-3.5 py-2.5"
    >
      <div className="flex w-[116px] shrink-0 flex-col gap-px">
        <span className="text-xs font-semibold text-muted-foreground">N° {order.id}</span>
        <span className="overflow-hidden text-ellipsis text-[15px] font-bold [overflow-wrap:anywhere]">
          {order.customerNickname}
        </span>
        {late && <span className="text-xs font-semibold tabular-nums text-primary-deep">{late}</span>}
      </div>
      <div className="min-w-[200px] flex-1">
        <TicketLines order={order} />
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <PrintBadge view={view} />
        <ReprintButton order={order} view={view} sent={reprinted} onReprint={onReprint} />
        <button
          type="button"
          aria-label={`Entregado, pedido N° ${order.id}`}
          disabled={busy}
          onClick={() => onEntregar([order])}
          className="inline-flex h-11 items-center gap-1.5 rounded bg-primary-deep px-3.5 text-[13px] font-bold text-primary-foreground hover:bg-primary-deep/90 disabled:opacity-60"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          Entregado
        </button>
      </div>
    </article>
  );
}

function Overdue({ list, ...row }: Pick<CommandedBoxProps, 'busy' | 'timezone' | 'agentOnline' | 'reprinted' | 'onReprint' | 'onEntregar'> & { list: OverdueOrder[] }) {
  return (
    <section id="kb-overdue" aria-label="Atrasados" className="scroll-mt-4 overflow-hidden rounded-md border border-destructive bg-card">
      <div className="flex items-center gap-2.5 bg-destructive px-3.5 py-2.5 text-primary-foreground">
        <Clock className="h-4 w-4" aria-hidden="true" />
        <span className="text-[15px] font-bold">Atrasados</span>
        <span className="text-[13px]">Ya pasó la hora de retiro</span>
        <span className="ml-auto text-xs font-semibold">{plural(list.length, 'pedido', 'pedidos')}</span>
      </div>
      {list.map((o) => (
        <OrderRow
          key={o.id}
          order={o}
          late={`Retiro ${o.pickupLabel} · atrasado +${formatCountdown(o.overdueMs)}`}
          {...row}
          reprinted={row.reprinted.has(o.id)}
        />
      ))}
    </section>
  );
}

/** The main column: overdue orders pinned on top, then one group per occupied pickup minute. */
export function CommandedBox(props: CommandedBoxProps) {
  const { board, leadMinutes, reprinted, ...row } = props;
  const { overdue, groups } = board;
  const [highlight, setHighlight] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const jump = (id: string, key: string | null) => {
    document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    setHighlight(key);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
  };

  const problems = problemSummary([...overdue, ...groups.flatMap((g) => g.orders)]);
  return (
    <section
      aria-labelledby="kb-commanded"
      className="flex min-w-0 flex-col gap-4 rounded-md border border-[#B3C3D9] bg-[#E1E8F1] p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-3">
          <Receipt className="h-6 w-6 shrink-0 text-[#2B5C8F]" aria-hidden="true" />
          <h2 id="kb-commanded" className="font-display text-2xl font-bold leading-tight sm:text-3xl">
            Pedidos comandados
          </h2>
          <CountBadge n={board.commandedCount} className="h-9 bg-[#2B5C8F] text-lg" />
        </div>
        <p className="text-[13px] text-[#4A5566]">Ordenados por horario de retiro</p>
      </div>

      {problems && <ProblemBanner headline={problems} />}

      <PickupTimeline
        timeline={board.timeline}
        overdueCount={overdue.length}
        onPickGroup={(key) => jump(`kb-g-${key}`, key)}
        onPickOverdue={() => jump('kb-overdue', null)}
      />

      {board.commandedCount === 0 && (
        <EmptyState
          title="No hay pedidos en cocina"
          hint={`Los pedidos programados pasan solos a comandados ${leadMinutes} min antes del retiro.`}
          className="border-[#B3C3D9] bg-[#F4F7FB]"
        />
      )}

      {overdue.length > 0 && <Overdue list={overdue} reprinted={reprinted} {...row} />}

      {groups.map((g) => (
        <section
          key={g.key}
          id={`kb-g-${g.key}`}
          aria-label={`Retiro ${g.time}`}
          className={cn(
            'scroll-mt-4 overflow-hidden rounded-md border border-border bg-card transition-shadow',
            highlight === g.key && 'ring-2 ring-primary-deep',
          )}
        >
          <div
            data-testid="group-header"
            className={cn('flex items-center gap-1.5 px-3.5 py-2 text-[13px] tabular-nums', TONE[g.tone])}
          >
            <span>
              {g.time} · <Clock className="inline h-3 w-3 align-[-1px]" aria-hidden="true" /> entrega en{' '}
              {formatCountdown(g.msUntil)}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">{plural(g.orders.length, 'pedido', 'pedidos')}</span>
          </div>
          {g.orders.map((o) => (
            <OrderRow key={o.id} order={o} reprinted={reprinted.has(o.id)} {...row} />
          ))}
        </section>
      ))}
    </section>
  );
}
