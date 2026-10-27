import { ChevronRight, Clock3, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { activeAccountDiscount, formatDiscountCountdown } from '../packPricing';
import type { AccountDiscount } from '../types';

const BUY_PATH = '/credits?comprar=1';

interface Props {
  discount: AccountDiscount;
  /** `large`: reemplaza la tarjeta de saldo cero; `small`: chip compacto cuando hay saldo (prototipo `Inicio.dc.html`). */
  variant: 'large' | 'small';
}

function Countdown({ expiresAt, size }: { expiresAt: string; size: 'sm' | 'md' }) {
  const countdown = formatDiscountCountdown(expiresAt);
  if (!countdown) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 tabular-nums',
        size === 'md' ? 'text-[13px]' : 'text-[12.5px]',
        countdown.urgent ? 'font-bold text-warning-deep' : 'font-semibold text-muted-foreground',
      )}
    >
      <Clock3 className={size === 'md' ? 'h-[15px] w-[15px]' : 'h-[13px] w-[13px]'} aria-hidden="true" />
      {countdown.label}
    </span>
  );
}

/**
 * Descuento de la cuenta en Inicio: porcentaje, cuenta regresiva y camino a la compra.
 * No renderiza nada si ya venció según el reloj local.
 */
export function AccountDiscountCard({ discount, variant }: Props) {
  if (!activeAccountDiscount(discount)) return null;

  if (variant === 'small') {
    return (
      <Link
        to={BUY_PATH}
        className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card py-2.5 pl-3 pr-2 text-foreground no-underline"
      >
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-deep text-primary-foreground"
        >
          <Tag className="h-5 w-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-bold">{discount.percent}% off en tu próxima compra</span>
          <Countdown expiresAt={discount.expiresAt} size="sm" />
        </span>
        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-deep text-primary-foreground"
        >
          <Tag className="h-[22px] w-[22px]" />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary-deep">Primeros 100</span>
          <span className="font-display text-[19px] font-bold leading-tight text-foreground">
            Tenés {discount.percent}% off en tu próxima compra
          </span>
        </span>
      </div>
      <div aria-hidden="true" className="border-t border-dashed border-border" />
      <div className="flex items-center justify-between gap-3">
        <Countdown expiresAt={discount.expiresAt} size="md" />
        <Link
          to={BUY_PATH}
          className="inline-flex h-11 items-center gap-1.5 rounded-md bg-primary-deep px-4 text-[13px] font-bold uppercase tracking-[0.06em] text-primary-foreground no-underline"
        >
          Cargar
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
