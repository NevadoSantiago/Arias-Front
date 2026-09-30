import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { formatLunches } from '@/features/orders/lunches';
import { useWallet } from '../hooks/useWallet';

/**
 * Chip de saldo en el header — solo para clientes B2C (`AppLayout` lo monta
 * únicamente cuando `user.companyId == null`). Enlaza a `/credits` y nunca
 * dice "créditos" (siempre "almuerzos", `formatLunches`). En 0 disponibles
 * usa el estilo mostaza/warning y ofrece "Cargar" en vez del plural.
 */
export function BalanceChip() {
  const { data: wallet } = useWallet();

  if (!wallet) return null;

  const { available } = wallet;
  const isZero = available === 0;
  const ariaLabel = isZero
    ? 'No tenés almuerzos disponibles. Cargar almuerzos'
    : `Tenés ${formatLunches(available)} disponibles. Ver mis almuerzos`;

  return (
    <Link
      to="/credits"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex h-11 shrink-0 items-center gap-2 rounded-full border pl-[5px] pr-3.5',
        'transition-colors',
        isZero ? 'border-warning bg-warning/15' : 'border-border bg-secondary',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full',
          isZero ? 'bg-warning text-warning-foreground' : 'bg-primary-deep text-primary-foreground',
        )}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="3.25" />
          <path d="M2.75 4v4.25a1.25 1.25 0 0 0 2.5 0V4M4 9.5V20" />
          <path d="M21.25 20V4c-1.3.7-2 2.6-2 5.2V13h2" />
        </svg>
      </span>
      <span className="flex flex-col gap-0.5 leading-none">
        <span className="text-sm font-bold text-foreground">{available}</span>
        <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">
          {isZero ? 'Cargar' : available === 1 ? 'almuerzo' : 'almuerzos'}
        </span>
      </span>
    </Link>
  );
}
