import { useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BoardOrder, KitchenBoard, ScheduledOrder } from './kitchenBoard';
import type { CancelledOrder } from '@/features/admin/services/adminApi';
import { CancelledBox } from './CancelledBox';
import { CommandedBox, type CommandedBoxProps } from './CommandedBox';
import { CountBadge, Items, OrderNote } from './kitchenParts';
import { ScheduledBox } from './ScheduledBox';

interface KitchenBoardViewProps extends Omit<CommandedBoxProps, 'onEntregar'> {
  onComandar: (order: ScheduledOrder) => void;
  onEntregar: (orders: BoardOrder[]) => void;
  /** Today's cancelled orders, newest first. Without them the board shows no cancelled box. */
  cancelled?: CancelledOrder[];
  cancelledOpen?: boolean;
  onCancelledOpenChange?: (open: boolean) => void;
}

function DeliveredBox({ board }: { board: KitchenBoard }) {
  const [open, setOpen] = useState(false);
  const list = board.delivered;
  return (
    <section
      aria-labelledby="kb-delivered"
      className="min-w-0 rounded-md border border-success/40 bg-success/15 px-4 py-1.5"
    >
      <h2 id="kb-delivered" className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="kb-delivered-list"
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-[48px] w-full items-center justify-between gap-3 py-1 text-left"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-success" aria-hidden="true" />
            <span className="text-[13px] font-bold uppercase tracking-brand">Pedidos entregados</span>
            <CountBadge n={list.length} className="h-[26px] bg-success text-[13px]" />
          </span>
          <ChevronDown
            className={cn('h-[18px] w-[18px] shrink-0 transition-transform', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </h2>
      {open && (
        <div id="kb-delivered-list" className="pb-2.5">
          {list.length === 0 ? (
            <p className="py-2 text-[13px] text-muted-foreground">Todavía no se entregó ningún pedido hoy.</p>
          ) : (
            <ul className="flex flex-col">
              {list.map((o) => (
                <li
                  key={o.id}
                  className="flex items-baseline justify-between gap-3 border-t border-success/30 py-2 text-[13px]"
                >
                  <span className="min-w-0">
                    <strong className="font-semibold">N° {o.id}</strong> · {o.customerNickname}
                    <Items order={o} compact className="font-medium" badgeClassName="bg-success" />
                    <OrderNote notas={o.notas} compact />
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {`Retiro ${o.pickupLabel}`}
                    {o.deliveredLabel && ` · entregado ${o.deliveredLabel}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/** Presentational: Comandados as the main column, Programados beside it, Entregados and Cancelados folded below. */
export function KitchenBoardView(props: KitchenBoardViewProps): ReactNode {
  const { board, leadMinutes, busy, onComandar, cancelled, cancelledOpen = false, onCancelledOpenChange } = props;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <CommandedBox {...props} />
        <ScheduledBox orders={board.scheduled} leadMinutes={leadMinutes} busy={busy} onComandar={onComandar} />
      </div>
      <DeliveredBox board={board} />
      {cancelled && (
        <CancelledBox
          orders={cancelled}
          timezone={props.timezone}
          open={cancelledOpen}
          onOpenChange={(open) => onCancelledOpenChange?.(open)}
        />
      )}
    </div>
  );
}
