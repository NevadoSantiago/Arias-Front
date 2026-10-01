import { useState } from 'react';
import { formatPrice } from '@/features/credits/packPricing';
import type { PaymentKind, PaymentSummary } from './paymentsApi';
import { donutSlices, KIND_COLOR, kindShares } from './paymentsReport';

const GEO = { cx: 100, cy: 100, outer: 92, inner: 58 };

/**
 * Donut of approved payments by kind (count). Hovering or focusing a slice or a legend row
 * shows its share in the centre; every kind is also named in the legend, so colour is never
 * the only cue. Inline SVG: four slices do not justify a chart library.
 */
export function PaymentsDonut({ summary }: { summary: PaymentSummary }) {
  const [active, setActive] = useState<PaymentKind | null>(null);
  const shares = kindShares(summary.byKind);
  const activeShare = shares.find((s) => s.kind === active) ?? null;
  const slices = donutSlices(shares.map((s) => s.count), GEO);

  if (summary.approvedCount === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Sin pagos realizados en este rango.</p>;
  }

  const hover = (kind: PaymentKind) => ({
    onMouseEnter: () => setActive(kind),
    onMouseLeave: () => setActive(null),
    onFocus: () => setActive(kind),
    onBlur: () => setActive(null),
  });

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative h-60 w-60 shrink-0">
        <svg viewBox="0 0 200 200" role="group" aria-label="Pagos por tipo" className="h-full w-full">
          {slices.map(({ index, d }) => {
            const s = shares[index];
            return (
              <path
                key={s.kind}
                d={d}
                data-testid={`slice-${s.kind}`}
                role="img"
                aria-label={`${s.label}: ${s.count} ${s.count === 1 ? 'pago' : 'pagos'}, ${s.percent} %`}
                tabIndex={0}
                fill={KIND_COLOR[s.kind]}
                stroke="hsl(var(--card))"
                strokeWidth={2}
                opacity={active && active !== s.kind ? 0.35 : 1}
                className="outline-none focus-visible:stroke-foreground"
                {...hover(s.kind)}
              />
            );
          })}
        </svg>
        <div
          data-testid="donut-centre"
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
        >
          <span className="font-display text-3xl font-bold leading-none text-foreground">
            {activeShare ? `${activeShare.percent} %` : summary.approvedCount}
          </span>
          <span className="mt-1 max-w-[110px] text-[11px] leading-tight text-muted-foreground">
            {activeShare ? activeShare.label : summary.approvedCount === 1 ? 'pago realizado' : 'pagos realizados'}
          </span>
        </div>
      </div>

      <ul aria-label="Pagos por tipo" className="flex w-full flex-col gap-2 text-sm">
        {shares.map((s) => (
          <li
            key={s.kind}
            className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted"
            onMouseEnter={() => setActive(s.kind)}
            onMouseLeave={() => setActive(null)}
          >
            <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm" style={{ background: KIND_COLOR[s.kind] }} />
            <span className="flex-1 font-semibold text-foreground">{s.label}</span>
            <span className="text-muted-foreground">
              {s.count} · {s.percent} %
            </span>
            <span className="w-28 text-right text-muted-foreground">{formatPrice(s.grossCents)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
