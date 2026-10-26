import { useState } from 'react';
import { Clock, Printer } from 'lucide-react';
import type { ScheduledOrder } from './kitchenBoard';
import { CountBadge, OrderNote } from './kitchenParts';

interface ScheduledBoxProps {
  orders: ScheduledOrder[];
  leadMinutes: number;
  busy: boolean;
  onComandar: (order: ScheduledOrder) => void;
}

/** "(en 40 min)" until the server commands it on its own; "(en breve)" when that is about to happen. */
const commandIn = (ms: number) => (ms > 0 ? `(en ${Math.ceil(ms / 60_000)} min)` : '(en breve)');

function ScheduledCard({
  order,
  confirming,
  busy,
  onAsk,
  onCancel,
  onConfirm,
}: {
  order: ScheduledOrder;
  confirming: boolean;
  busy: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <li
      aria-label={`Pedido N° ${order.id}`}
      className="flex flex-col gap-2 rounded-md border border-border bg-card px-3.5 py-3"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-semibold text-muted-foreground">N° {order.id}</span>
        <span className="min-w-0 flex-1 text-[15px] font-bold [overflow-wrap:anywhere]">{order.customerNickname}</span>
        <span className="font-display text-lg font-bold">{order.pickupLabel}</span>
      </div>
      <div className="flex flex-col text-[13px] leading-snug">
        {order.lines.map((line, i) => (
          <div key={i} className="flex flex-col">
            <span className="font-semibold">{`${line.qty}x ${line.dish}`}</span>
            {line.side && <span className="text-muted-foreground">{`${line.qty}x C/${line.side}`}</span>}
            {line.note && <span className="italic text-muted-foreground">{line.note}</span>}
          </div>
        ))}
        <OrderNote notas={order.notas} compact />
      </div>
      <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
        <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{`Retira ${order.pickupLabel} · se comanda ${order.comandarAtLabel}`}</span>
        <span>{commandIn(order.comandarInMs)}</span>
      </p>
      {confirming ? (
        <div role="group" aria-label={`Confirmar comandar pedido N° ${order.id}`} className="flex flex-col gap-2 rounded-md bg-muted p-2.5">
          <p className="text-[13px] leading-snug">
            <strong>¿Comandar ahora?</strong> La comanda sale ya por la ticketera y el pedido pasa a Comandados.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-11 rounded border border-border px-3.5 text-[13px] font-semibold hover:bg-card"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className="h-11 rounded bg-primary-deep px-3.5 text-[13px] font-bold text-primary-foreground hover:bg-primary-deep/90 disabled:opacity-60"
            >
              Sí, comandar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          aria-label={`Comandar ahora el pedido N° ${order.id}`}
          disabled={busy}
          onClick={onAsk}
          className="inline-flex h-11 items-center justify-center gap-2 rounded border border-foreground/35 text-[13px] font-bold hover:bg-foreground/5 disabled:opacity-60"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          Comandar ahora
        </button>
      )}
    </li>
  );
}

/** The narrow side column: orders waiting for their time, each with an in-card "Comandar ahora". */
export function ScheduledBox({ orders, leadMinutes, busy, onComandar }: ScheduledBoxProps) {
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  return (
    <section aria-labelledby="kb-scheduled" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-1 pt-2">
        <div className="flex items-center gap-2.5">
          <h2 id="kb-scheduled" className="text-[13px] font-bold uppercase tracking-brand">
            Pedidos programados
          </h2>
          <CountBadge n={orders.length} className="h-[26px] bg-warning-foreground text-[13px]" />
        </div>
        <span className="text-xs text-muted-foreground">Se comandan solos {leadMinutes} min antes del retiro</span>
      </div>
      {orders.length === 0 ? (
        <p className="rounded-md border border-dashed border-warning/50 p-3 text-center text-sm text-muted-foreground">
          No quedan pedidos programados para hoy.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {orders.map((o) => (
            <ScheduledCard
              key={o.id}
              order={o}
              confirming={confirmingId === o.id}
              busy={busy}
              onAsk={() => setConfirmingId(o.id)}
              onCancel={() => setConfirmingId(null)}
              onConfirm={() => {
                setConfirmingId(null);
                onComandar(o);
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
