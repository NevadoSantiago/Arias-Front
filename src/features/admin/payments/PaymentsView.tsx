import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/features/credits/packPricing';
import type { CreditPurchaseStatus } from '@/features/credits/types';
import type { PaymentReport, PaymentRow, PaymentStatusFilter, PaymentSummary } from './paymentsApi';
import { PaymentsDonut } from './PaymentsDonut';
import {
  asideNote,
  conceptOf,
  formatPaymentDate,
  missingFeeNote,
  QUICK_RANGES,
  quickRange,
  STATUS_LABEL,
} from './paymentsReport';

export interface PaymentsViewProps {
  today: string | null;
  timezone: string | null;
  from: string;
  to: string;
  status: PaymentStatusFilter;
  rangeInvalid: boolean;
  report: PaymentReport | null;
  isLoading: boolean;
  isError: boolean;
  onFrom: (from: string) => void;
  onTo: (to: string) => void;
  onRange: (range: { from: string; to: string }) => void;
  onStatus: (status: PaymentStatusFilter) => void;
  onRetry: () => void;
}

const LABEL = 'text-[11px] font-semibold uppercase tracking-brand text-foreground';
const CARD = 'rounded-md border border-border bg-card';

const STATUS_STYLE: Record<CreditPurchaseStatus, string> = {
  APPROVED: 'border-success bg-success text-success-foreground',
  PENDING: 'border-warning/60 bg-warning/15 text-foreground',
  IN_MEDIATION: 'border-dashed border-warning bg-warning/15 text-foreground',
  REVERSED: 'border-destructive bg-transparent text-destructive',
  REJECTED: 'border-transparent bg-muted text-muted-foreground',
  CANCELLED: 'border-transparent bg-muted text-muted-foreground',
  EXPIRED: 'border-transparent bg-muted text-muted-foreground',
};

function SummaryBox({
  title,
  value,
  hint,
  highlight = false,
}: {
  title: string;
  value: string | number;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-md px-5 py-4',
        highlight ? 'border-2 border-success bg-success/10' : 'border border-border bg-card',
      )}
    >
      <span className={cn(LABEL, highlight ? 'font-bold text-success' : 'text-muted-foreground')}>{title}</span>
      <span className="font-display text-2xl font-bold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  );
}

function Summary({ summary, from, to }: { summary: PaymentSummary; from: string; to: string }) {
  const fee = missingFeeNote(summary.rowsWithoutFee);
  const aside = asideNote(summary.inMediationCount, summary.reversedCount);
  return (
    <section aria-label="Resumen" className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryBox title="Pagos realizados" value={summary.approvedCount} hint={from === to ? from : `${from} al ${to}`} />
        <SummaryBox title="Cobrado bruto" value={formatPrice(summary.grossCents)} hint="Suma de los pagos realizados" />
        <SummaryBox
          title="Comisión Mercado Pago"
          value={formatPrice(summary.feeCents)}
          hint="Comisión real informada por Mercado Pago"
        />
        <SummaryBox title="Ingreso neto" value={formatPrice(summary.netCents)} hint="Bruto − comisión" highlight />
      </div>
      {fee && <p className="text-xs font-semibold text-foreground">{fee}</p>}
      {aside && <p className="text-xs text-muted-foreground">{aside}</p>}
    </section>
  );
}

const money = (cents: number | null) => (cents === null ? '—' : formatPrice(cents));

function PaymentsTable({ rows, timezone }: { rows: PaymentRow[]; timezone: string }) {
  const th = 'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-brand text-muted-foreground';
  const num = 'whitespace-nowrap px-3 py-2.5 text-right tabular-nums';
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-sm">
        <thead className="border-y border-border bg-muted/50">
          <tr>
            <th scope="col" className={th}>Fecha</th>
            <th scope="col" className={th}>Cliente</th>
            <th scope="col" className={th}>Concepto</th>
            <th scope="col" className={cn(th, 'text-right')}>Almuerzos</th>
            <th scope="col" className={cn(th, 'text-right')}>Monto</th>
            <th scope="col" className={cn(th, 'text-right')}>Comisión</th>
            <th scope="col" className={cn(th, 'text-right')}>Neto</th>
            <th scope="col" className={th}>Estado</th>
            <th scope="col" className={th}>Pago MP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const when = formatPaymentDate(r.occurredAt, timezone);
            return (
              <tr key={r.purchaseId} className="border-b border-border/60">
                <td className="px-3 py-2.5">
                  <span className="block font-semibold">{when.date}</span>
                  <span className="block text-xs text-muted-foreground">{when.time}</span>
                </td>
                <td className="px-3 py-2.5">{r.customer}</td>
                <td className="px-3 py-2.5">{conceptOf(r)}</td>
                <td className={num}>{r.credits}</td>
                <td className={num}>{formatPrice(r.amountCents)}</td>
                <td className={num}>{money(r.feeCents)}</td>
                <td className={num}>{money(r.netCents)}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      'inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                      STATUS_STYLE[r.status],
                    )}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">{r.mpPaymentId ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Presentational payments report: filters, summary, donut and table. State lives in `usePaymentsReport`. */
export function PaymentsView(p: PaymentsViewProps) {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-10">
      <header>
        <h1 className="mb-1 font-display text-3xl font-bold leading-tight text-foreground lg:text-4xl">Pagos</h1>
        <p className="text-sm text-muted-foreground">
          Cobros con Mercado Pago de clientes con retiro: compras de paquetes y pagos directos de pedidos.
        </p>
      </header>

      <form
        aria-label="Filtros"
        onSubmit={(e) => e.preventDefault()}
        className={cn(CARD, 'flex flex-wrap items-end gap-4 px-5 py-4')}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="payments-from" className={LABEL}>Desde</label>
          <Input
            id="payments-from"
            type="date"
            value={p.from}
            onChange={(e) => p.onFrom(e.target.value)}
            className="h-11 w-auto"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="payments-to" className={LABEL}>Hasta</label>
          <Input
            id="payments-to"
            type="date"
            value={p.to}
            aria-invalid={p.rangeInvalid || undefined}
            onChange={(e) => p.onTo(e.target.value)}
            className="h-11 w-auto"
          />
        </div>
        <div role="group" aria-label="Rangos rápidos" className="flex flex-wrap gap-1.5">
          {QUICK_RANGES.map(({ key, label }) => {
            const range = p.today ? quickRange(key, p.today) : null;
            const pressed = range !== null && range.from === p.from && range.to === p.to;
            return (
              <Button
                key={key}
                type="button"
                variant={pressed ? 'default' : 'outline'}
                aria-pressed={pressed}
                disabled={range === null}
                className="min-h-[44px] rounded-full text-xs"
                onClick={() => range && p.onRange(range)}
              >
                {label}
              </Button>
            );
          })}
        </div>
        <div className="flex flex-col gap-1.5 sm:ml-auto">
          <label htmlFor="payments-status" className={LABEL}>Estado</label>
          <select
            id="payments-status"
            value={p.status}
            onChange={(e) => p.onStatus(e.target.value as PaymentStatusFilter)}
            className="h-11 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="APPROVED">Pagos realizados</option>
            <option value="ALL">Todos los estados</option>
          </select>
        </div>
        {p.rangeInvalid && (
          <p role="alert" className="basis-full text-sm font-semibold text-destructive">
            «Hasta» tiene que ser igual o posterior a «Desde».
          </p>
        )}
      </form>

      {p.isError && (
        <div role="alert" className="flex items-center gap-3 text-sm">
          <span>No pudimos cargar los pagos.</span>
          <Button type="button" variant="outline" size="sm" onClick={p.onRetry}>Reintentar</Button>
        </div>
      )}

      {p.isLoading && !p.report && !p.isError && (
        <p className="py-12 text-center text-sm uppercase tracking-brand text-muted-foreground">Cargando…</p>
      )}

      {p.report && !p.rangeInvalid && (
        <>
          <Summary summary={p.report.summary} from={p.from} to={p.to} />

          <section aria-labelledby="payments-donut-title" className={cn(CARD, 'flex flex-col gap-4 p-5')}>
            <h2 id="payments-donut-title" className="font-display text-xl font-bold">Pagos por tipo</h2>
            <PaymentsDonut summary={p.report.summary} />
            <p className="text-xs text-muted-foreground">Por cantidad de pagos. El monto de cada uno está en la lista.</p>
          </section>

          <section aria-labelledby="payments-list-title" className={cn(CARD, 'overflow-hidden')}>
            <div className="flex items-baseline justify-between px-5 py-4">
              <h2 id="payments-list-title" className="font-display text-xl font-bold">Detalle de pagos</h2>
              <span className="text-xs text-muted-foreground">Más recientes primero</span>
            </div>
            {p.report.rows.length === 0 || !p.timezone ? (
              <p className="border-t border-border px-5 py-8 text-sm text-muted-foreground">
                No hay pagos para este rango y estado.
              </p>
            ) : (
              <PaymentsTable rows={p.report.rows} timezone={p.timezone} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
