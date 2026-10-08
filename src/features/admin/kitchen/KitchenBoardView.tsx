import { useState, type ReactNode } from 'react';
import { Check, CheckCircle2, ChevronDown, Clock, Flame, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STALE_AFTER_MINUTES, type BoardOrder, type KitchenBoard } from './kitchenBoard';

interface KitchenBoardViewProps {
  board: KitchenBoard;
  leadMinutes: number;
  slotMinutes: number;
  /** Disables every action while a move is in flight, so a double click cannot fire it twice. */
  busy: boolean;
  onComandar: (orders: BoardOrder[]) => void;
  onEntregar: (orders: BoardOrder[]) => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

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

function EmptyState({ title, hint, className }: { title: string; hint: string; className: string }) {
  return (
    <div className={cn('flex flex-col gap-1 rounded-md border border-dashed px-4 py-8 text-center', className)}>
      <p className="text-lg font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function ConfirmedBox({ board, leadMinutes, slotMinutes, busy, onComandar }: KitchenBoardViewProps) {
  const total = board.confirmed.reduce((sum, c) => sum + c.orders.length, 0);
  return (
    <section
      aria-labelledby="kb-confirmed"
      className="flex flex-col gap-4 rounded-md border border-primary/30 bg-primary/10 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-3">
          <Flame className="h-6 w-6 shrink-0 text-primary-deep" aria-hidden="true" />
          <h2 id="kb-confirmed" className="font-display text-2xl font-bold leading-tight sm:text-3xl">
            Pedidos confirmados para comandar
          </h2>
          <CountBadge n={total} className="h-9 bg-primary-deep text-lg" />
        </div>
        <p className="text-[13px] text-muted-foreground">
          Se confirman {leadMinutes} min antes del retiro · franjas de {slotMinutes} min
        </p>
      </div>

      {total === 0 ? (
        <EmptyState
          title="Nada para comandar ahora"
          hint={`Los pedidos programados aparecen acá ${leadMinutes} min antes de su retiro.`}
          className="border-primary/30 bg-card/60"
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] items-start gap-4">
          {board.confirmed.map((slot) => (
            <div
              key={slot.minute}
              className={cn(
                'flex flex-col gap-3 rounded-md border bg-card p-4',
                slot.first ? 'border-2 border-primary-deep' : 'border-primary/30',
              )}
            >
              <div className="flex items-center justify-between gap-2 border-b border-primary/25 pb-2.5">
                <div className="flex flex-col gap-1">
                  <span className="font-display text-4xl font-bold leading-none">{slot.time}</span>
                  <span
                    className={cn(
                      'text-[13px] font-semibold',
                      slot.overdue ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {slot.rel}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {slot.first && (
                    <span className="rounded-full bg-primary-deep px-2.5 py-1 text-[11px] font-bold uppercase tracking-brand text-primary-foreground">
                      Primero
                    </span>
                  )}
                  <span className="text-[13px] font-semibold text-muted-foreground">
                    {plural(slot.orders.length, 'pedido', 'pedidos')}
                  </span>
                </div>
              </div>

              {slot.orders.map((order) => (
                <div key={order.id} className="flex flex-col gap-2 border-b border-border pb-3 last:border-b-0 last:pb-0">
                  <span className="text-[13px] text-muted-foreground">
                    N° {order.id} · {order.customerNickname}
                  </span>
                  <Items
                    order={order}
                    className="text-[19px] font-semibold leading-snug"
                    badgeClassName="bg-primary-deep"
                  />
                  <OrderNote notas={order.notas} />
                  <button
                    type="button"
                    aria-label={`Comandado, pedido N° ${order.id}`}
                    disabled={busy}
                    onClick={() => onComandar([order])}
                    className="inline-flex min-h-[44px] items-center gap-1.5 self-start rounded bg-primary-deep px-[18px] text-[13px] font-semibold uppercase tracking-brand text-primary-foreground hover:bg-primary-deep/90 disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Comandado
                  </button>
                </div>
              ))}

              {slot.orders.length > 1 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onComandar(slot.orders)}
                  className="min-h-[44px] w-full rounded border border-primary-deep text-xs font-semibold uppercase tracking-brand text-primary-deep hover:bg-primary-deep/10 disabled:opacity-60"
                >
                  {`Comandar los ${slot.orders.length} de las ${slot.time}`}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CommandedBox({ board, busy, onEntregar }: KitchenBoardViewProps) {
  const [staleOpen, setStaleOpen] = useState(false);
  const { fresh, stale } = board.commanded;
  const total = fresh.length + stale.length;
  return (
    <section
      aria-labelledby="kb-commanded"
      className="flex flex-col gap-4 rounded-md border border-[#B3C3D9] bg-[#E1E8F1] p-4 text-foreground sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-3">
          <Receipt className="h-6 w-6 shrink-0 text-[#2B5C8F]" aria-hidden="true" />
          <h2 id="kb-commanded" className="font-display text-2xl font-bold leading-tight sm:text-3xl">
            Pedidos comandados
          </h2>
          <CountBadge n={total} className="h-9 bg-[#2B5C8F] text-lg" />
        </div>
        <p className="text-[13px] text-[#4A5566]">Ordenados por horario de retiro</p>
      </div>

      {total === 0 && (
        <EmptyState
          title="No hay pedidos en cocina"
          hint="Cuando marques un pedido como comandado, aparece acá hasta que se retire."
          className="border-[#B3C3D9] bg-[#F4F7FB]"
        />
      )}

      {fresh.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] items-start gap-4">
          {fresh.map((o) => (
            <article
              key={o.id}
              aria-label={`Pedido N° ${o.id}, ${o.customerNickname}`}
              className="flex flex-col gap-2.5 rounded-md border border-[#C7D3E3] bg-[#F4F7FB] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13px] font-bold tracking-wide text-[#2B5C8F]">N° {o.id}</span>
                  <span className="text-[17px] font-semibold">{o.customerNickname}</span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-brand text-[#4A5566]">Retira</span>
                  <span className="text-[26px] font-bold leading-none">{o.pickupLabel}</span>
                  <span className="text-xs font-semibold text-[#4A5566]">{o.rel}</span>
                </div>
              </div>
              <Items order={o} className="text-base font-semibold leading-snug" badgeClassName="bg-[#2B5C8F]" />
              <OrderNote notas={o.notas} />
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  aria-label={`Entregado, pedido N° ${o.id}`}
                  disabled={busy}
                  onClick={() => onEntregar([o])}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded bg-[#2B5C8F] px-4 text-xs font-semibold uppercase tracking-brand text-primary-foreground hover:bg-[#244E79] disabled:opacity-60"
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Entregado
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {stale.length > 0 && (
        <div className="rounded-md border border-[#C7D3E3] bg-[#F4F7FB]/60">
          <button
            type="button"
            aria-expanded={staleOpen}
            aria-controls="kb-stale-list"
            onClick={() => setStaleOpen((v) => !v)}
            className="flex min-h-[52px] w-full items-center justify-between gap-4 px-4 py-2 text-left text-[#3B4656]"
          >
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-sm font-semibold">
                {`Retiro hace más de ${STALE_AFTER_MINUTES} min (${stale.length})`}
              </span>
              <span className="text-[13px] text-[#4A5566]">Probablemente ya retirados. No bloquean nada.</span>
            </span>
            <ChevronDown
              className={cn('h-[18px] w-[18px] shrink-0 transition-transform', staleOpen && 'rotate-180')}
              aria-hidden="true"
            />
          </button>
          {staleOpen && (
            <div id="kb-stale-list" className="flex flex-col px-4 pb-4 text-[#3B4656]">
              {stale.map((o) => (
                <div
                  key={o.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-[#D5DEEA] py-2"
                >
                  <div className="min-w-0">
                    <span className="text-sm">
                      <strong className="font-semibold">
                        N° {o.id} · {o.customerNickname}
                      </strong>
                      {` · Retiro ${o.pickupLabel}`}
                    </span>
                    <Items order={o} compact className="text-sm font-medium" badgeClassName="bg-[#2B5C8F]" />
                    <OrderNote notas={o.notas} compact />
                  </div>
                  <button
                    type="button"
                    aria-label={`Entregado, pedido N° ${o.id}`}
                    disabled={busy}
                    onClick={() => onEntregar([o])}
                    className="min-h-[44px] rounded border border-[#2B5C8F] px-3.5 text-[11px] font-semibold uppercase tracking-brand text-[#2B5C8F] hover:bg-[#2B5C8F]/10 disabled:opacity-60"
                  >
                    Entregado
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => onEntregar(stale)}
                className="mt-2 min-h-[44px] self-end rounded bg-[#2B5C8F] px-[18px] text-xs font-semibold uppercase tracking-brand text-primary-foreground hover:bg-[#244E79] disabled:opacity-60"
              >
                {stale.length === 1 ? 'Marcar como entregado' : `Marcar los ${stale.length} como entregados`}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ScheduledBox({ board }: KitchenBoardViewProps) {
  const list = board.scheduled;
  return (
    <section
      aria-labelledby="kb-scheduled"
      className="flex min-w-0 flex-[2_1_520px] flex-col gap-3 rounded-md border border-warning/40 bg-warning/15 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="h-[18px] w-[18px] shrink-0 text-warning-foreground" aria-hidden="true" />
          <h2 id="kb-scheduled" className="text-[13px] font-bold uppercase tracking-brand">
            Pedidos programados
          </h2>
          <CountBadge n={list.length} className="h-[26px] bg-warning-foreground text-[13px]" />
        </div>
        <span className="text-xs text-muted-foreground">Pasan solos a confirmados</span>
      </div>
      {list.length === 0 ? (
        <p className="rounded-md border border-dashed border-warning/50 p-3 text-center text-sm text-muted-foreground">
          No quedan pedidos programados para hoy.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {list.map((o) => (
            <li
              key={o.id}
              className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-baseline gap-4 rounded bg-card/70 px-3.5 py-2.5"
            >
              <span className="text-[17px] font-bold">{o.pickupLabel}</span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">
                  N° {o.id} · {o.customerNickname}
                </span>
                <Items order={o} className="text-[15px] font-semibold leading-snug" badgeClassName="bg-warning-foreground" />
                <OrderNote notas={o.notas} />
              </div>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                Se confirma {o.confirmAtLabel}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DeliveredBox({ board }: KitchenBoardViewProps) {
  const [open, setOpen] = useState(false);
  const list = board.delivered;
  return (
    <section
      aria-labelledby="kb-delivered"
      className="min-w-0 flex-[1_1_320px] rounded-md border border-success/40 bg-success/15 px-4 py-1.5"
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

/** Presentational: the four boxes of the kitchen dashboard. All behavior arrives through props. */
export function KitchenBoardView(props: KitchenBoardViewProps): ReactNode {
  return (
    <div className="flex flex-col gap-6">
      <ConfirmedBox {...props} />
      <CommandedBox {...props} />
      <div className="flex flex-wrap items-start gap-6">
        <ScheduledBox {...props} />
        <DeliveredBox {...props} />
      </div>
    </div>
  );
}
