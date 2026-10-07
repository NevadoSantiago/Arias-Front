import { CalendarDays, ChevronRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useWallet } from '../hooks/useWallet';

const RADIUS = 64;
const STROKE = 14;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Colores de la caja de saldo (tablero v28): caja clara con el mantel de Arias. */
const PAPER = '#FFFCF5';
const INK = '#1A110F';
const AVAILABLE_COLOR = '#F4B5B6';

/** Mantel a cuadros rojo suave: franjas de 12px que se repiten cada 24px, en horizontal y en vertical. */
const GINGHAM_STYLE = {
  backgroundColor: PAPER,
  backgroundImage: [
    'repeating-linear-gradient(90deg, rgba(220,44,46,0.08) 0 12px, transparent 12px 24px)',
    'repeating-linear-gradient(0deg, rgba(220,44,46,0.08) 0 12px, transparent 12px 24px)',
  ].join(', '),
  borderColor: 'rgba(220,44,46,0.28)',
  color: INK,
} as const;

function formatExpiry(expiresAt: string): string {
  return new Date(expiresAt).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Segmentos del anillo disponibles/reservados — mismo cálculo que el
 * prototipo (`Credits.dc.html`): un pequeño hueco entre segmentos cuando
 * ambos son > 0, dasharray/offset sobre la circunferencia del círculo.
 */
function ringSegments(available: number, committed: number) {
  const total = available + committed;
  const gap = available > 0 && committed > 0 ? 6 : 0;
  const availLen = total > 0 ? Math.max(0, (available / total) * CIRCUMFERENCE - gap) : 0;
  const committedLen = total > 0 ? Math.max(0, (committed / total) * CIRCUMFERENCE - gap) : 0;
  return {
    availableDasharray: `${availLen} ${CIRCUMFERENCE}`,
    committedDasharray: `${committedLen} ${CIRCUMFERENCE}`,
    committedOffset: -(availLen + gap),
  };
}

interface Props {
  /**
   * `card` (default, móvil): tarjeta apilada con "Comprar más almuerzos" que lleva a Paquetes.
   * `wide` (escritorio, F22c): anillo y cifras en horizontal, con "Pedir un almuerzo";
   * la compra vive en el panel lateral de la página, así que no hay enlace a Paquetes.
   */
  variant?: 'card' | 'wide';
}

/**
 * Saldo de almuerzos — anillo disponibles/reservados con el número grande al
 * centro (F5, prototipo `Credits.dc.html`). AVAILABLE y COMMITTED se
 * muestran SIEMPRE como dos cifras separadas, nunca sumadas en un único
 * total (spec `credits-ui`, decisión F2 de `design.md`) — el texto nunca
 * dice "créditos" (siempre "almuerzos").
 */
export function WalletBalance({ variant = 'card' }: Props = {}) {
  const wide = variant === 'wide';
  const { data: wallet, isLoading, isError } = useWallet();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando tu billetera…</p>;
  }

  if (isError || !wallet) {
    return <p className="text-sm text-destructive">No pudimos cargar tu billetera.</p>;
  }

  const { available, committed, expiresAt } = wallet;
  const ring = ringSegments(available, committed);
  const availableWord = available === 1 ? 'Disponible' : 'Disponibles';
  const committedWord = committed === 1 ? 'Reservado' : 'Reservados';

  const legend = (
    <dl className={cn('m-0 flex min-w-0 flex-1 flex-col', wide ? 'gap-5' : 'gap-4')}>
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded" style={{ backgroundColor: AVAILABLE_COLOR }} />
        <div className={cn('flex gap-0.5', wide ? 'flex-col' : 'flex-col-reverse')}>
          <dt className={cn('text-[12.5px] font-semibold text-[#67514C]', wide && 'order-2')}>{availableWord}</dt>
          <dd className={cn('m-0 text-2xl font-bold leading-none', wide && 'order-1')}>{available}</dd>
          {wide && <dd className="order-3 m-0 text-[12.5px] text-[#67514C]">para pedir cuando quieras</dd>}
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded bg-primary" />
        <div className={cn('flex gap-0.5', wide ? 'flex-col' : 'flex-col-reverse')}>
          <dt className={cn('text-[12.5px] font-semibold text-[#67514C]', wide && 'order-2')}>{committedWord}</dt>
          <dd className={cn('m-0 text-2xl font-bold leading-none', wide && 'order-1')}>{committed}</dd>
          {wide && (
            <dd className="order-3 m-0 text-[12.5px] text-[#67514C]">en pedidos que todavía no retiraste</dd>
          )}
        </div>
      </div>
    </dl>
  );

  const expiry = expiresAt && (
    <p className="m-0 flex items-center gap-2.5 text-[13.5px] text-[#67514C]">
      <CalendarDays className="h-[18px] w-[18px] shrink-0 text-primary-deep" aria-hidden="true" />
      <span>
        Vencen el <strong className="font-bold text-[#1A110F]">{formatExpiry(expiresAt)}</strong>
      </span>
    </p>
  );

  if (wide) {
    return (
      <section
        aria-label="Tu saldo"
        className="flex items-center gap-8 rounded-xl border-[1.5px] px-7 py-6 shadow-[0_2px_10px_rgba(26,17,15,0.08)]"
        style={GINGHAM_STYLE}
      >
        <Ring available={available} ring={ring} size={176} numberClass="text-[60px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {legend}
          <div aria-hidden="true" className="border-t-[1.5px] border-dashed border-[#1A110F]/25" />
          <div className="flex items-center justify-between gap-4">
            {expiry || <span />}
            <Link
              to="/orders/today"
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-md border-[1.5px] border-[#1A110F] bg-[#FFFCF5] px-4 text-[13.5px] font-bold text-[#1A110F] no-underline"
            >
              Pedir un almuerzo
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div
      className="flex flex-col gap-4 rounded-xl border-[1.5px] p-5 shadow-[0_2px_10px_rgba(26,17,15,0.08)]"
      style={GINGHAM_STYLE}
    >
      <div className="flex items-center gap-4">
        <Ring available={available} ring={ring} size={156} numberClass="text-[52px]" />
        {legend}
      </div>

      {expiry && (
        <>
          <div aria-hidden="true" className="border-t-[1.5px] border-dashed border-[#1A110F]/25" />
          {expiry}
        </>
      )}

      <Link
        to="/credits/packs"
        data-tour="buy"
        className="flex h-[54px] items-center justify-center gap-2 rounded-md bg-primary-deep text-sm font-bold uppercase tracking-brand text-primary-foreground no-underline"
      >
        <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
        Comprar más almuerzos
      </Link>
    </div>
  );
}

/** Anillo disponibles/reservados con el número grande al centro; `size` en px (el trazado escala con el viewBox). */
function Ring({
  available,
  ring,
  size,
  numberClass,
}: {
  available: number;
  ring: ReturnType<typeof ringSegments>;
  size: number;
  numberClass: string;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 156 156" className="absolute left-0 top-0">
        <circle cx="78" cy="78" r="56" fill={PAPER} />
        <circle cx="78" cy="78" r={RADIUS} fill="none" stroke="hsl(var(--primary) / 0.12)" strokeWidth={STROKE} />
        <circle
          cx="78"
          cy="78"
          r={RADIUS}
          fill="none"
          stroke={AVAILABLE_COLOR}
          strokeWidth={STROKE}
          strokeDasharray={ring.availableDasharray}
          transform="rotate(-90 78 78)"
        />
        <circle
          cx="78"
          cy="78"
          r={RADIUS}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={STROKE}
          strokeDasharray={ring.committedDasharray}
          strokeDashoffset={ring.committedOffset}
          transform="rotate(-90 78 78)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('font-display font-black leading-none text-[#1A110F]', numberClass)}>{available}</span>
      </div>
    </div>
  );
}
