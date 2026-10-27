import { useState } from 'react';
import { ChevronRight, Clock3, Gift, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { activeAccountDiscount, formatDiscountCountdown } from '../packPricing';
import type { AccountDiscount } from '../types';
import { rememberOpened, wasOpened } from '../surpriseStorage';

const BUY_PATH = '/credits?comprar=1';

const CONFETTI_COLORS = ['#DC2C2E', '#C5840D', '#5A8939', '#B3252B', '#E9B949', '#DC2C2E'];

/** Un único estallido de confeti de CSS puro (12 piezas), sin dependencias. */
function Confetti() {
  return (
    <>
      {Array.from({ length: 12 }, (_, i) => (
        <span
          key={i}
          data-testid="confetti-piece"
          aria-hidden="true"
          className="surprise-confetti pointer-events-none absolute -top-3.5 rounded-sm"
          style={{
            left: `${6 + i * 8}%`,
            width: i % 3 === 0 ? 6 : 8,
            height: i % 2 === 0 ? 12 : 8,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i * 70) % 420}ms`,
          }}
        />
      ))}
    </>
  );
}

function CountdownChip({ expiresAt, className }: { expiresAt: string; className?: string }) {
  const countdown = formatDiscountCountdown(expiresAt);
  if (!countdown) return null;
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] tabular-nums',
        countdown.urgent ? 'bg-warning/25 font-bold text-warning-deep' : 'font-semibold',
        className,
      )}
    >
      <Clock3 className="h-[13px] w-[13px]" aria-hidden="true" />
      {countdown.label}
    </span>
  );
}

interface Props {
  userId: number;
  discount: AccountDiscount;
}

/**
 * Sorpresa del inicio (prototipo `InicioSorpresa.dc.html`): mientras la billetera
 * tiene un descuento utilizable, un regalo cerrado que se abre con un toque (un
 * estallido de confeti) y muestra el beneficio. "Abierta" se recuerda por usuario
 * en el dispositivo; al volver aparece abierta y sin confeti.
 */
export function SurpriseGift({ userId, discount }: Props) {
  const [opened, setOpened] = useState(() => wasOpened(userId));
  const [burst, setBurst] = useState(false);

  if (!activeAccountDiscount(discount)) return null;

  if (!opened) {
    return (
      <button
        type="button"
        onClick={() => {
          rememberOpened(userId);
          setBurst(true);
          setOpened(true);
        }}
        className="relative mb-6 flex min-h-[184px] w-full cursor-pointer items-center gap-3.5 overflow-hidden rounded-[14px] border-0 bg-primary-deep py-5 pl-[22px] pr-5 text-left font-sans text-primary-foreground shadow-[0_14px_28px_-14px_rgba(142,28,33,0.55)] hover:shadow-[0_18px_32px_-14px_rgba(142,28,33,0.65)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-foreground"
      >
        <span aria-hidden="true" className="absolute bottom-0 right-[57px] top-0 w-[18px] bg-primary" />
        <span
          aria-hidden="true"
          className="surprise-shine absolute -bottom-[20%] -top-[20%] left-0 w-14 -translate-x-[160%] -skew-x-[20deg] bg-white/15"
        />
        <span className="relative flex min-w-0 flex-1 flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.15em]">Una sorpresa para vos</span>
          <span className="font-display text-[25px] font-bold leading-[1.15]">Tu almuerzo vino con sorpresa</span>
          <span className="inline-flex items-center gap-1.5 text-sm font-bold">
            Tocá para abrirla
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </span>
          <CountdownChip expiresAt={discount.expiresAt} className="bg-white/20 text-primary-foreground" />
        </span>
        <span aria-hidden="true" className="relative flex w-[92px] shrink-0 justify-center">
          <span className="surprise-wobble flex h-20 w-20 items-center justify-center rounded-full bg-[#FFFCF5] text-primary-deep shadow-[0_6px_14px_rgba(26,17,15,0.25)]">
            <Gift className="h-11 w-11" strokeWidth={1.7} />
          </span>
        </span>
      </button>
    );
  }

  return (
    <section
      aria-live="polite"
      aria-labelledby="surprise-title"
      className="relative mb-6 flex flex-col items-center gap-2 overflow-hidden rounded-[14px] border-2 border-primary-deep bg-[#FFFCF5] px-5 pb-5 pt-[22px] text-center shadow-[0_14px_28px_-16px_rgba(142,28,33,0.45)]"
    >
      {burst && <Confetti />}
      <span
        aria-hidden="true"
        className="surprise-pop flex h-14 w-14 items-center justify-center rounded-full bg-primary-deep text-primary-foreground"
      >
        <Tag className="h-7 w-7" strokeWidth={1.8} />
      </span>
      <div className="surprise-appear flex w-full flex-col items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary-deep">
          Beneficio primeros 100 clientes
        </span>
        <h2 id="surprise-title" className="m-0 flex flex-col items-center gap-1">
          <span className="font-display text-[60px] font-black leading-none text-primary-deep">{discount.percent}%</span>
          <span className="font-display text-xl font-bold leading-tight text-foreground">
            de descuento en tu próxima compra
          </span>
        </h2>
        <p className="m-0 text-[13.5px] leading-normal text-muted-foreground">
          Ya está aplicado en tu cuenta, no tenés que hacer nada.
        </p>
        <CountdownChip expiresAt={discount.expiresAt} className="bg-muted text-muted-foreground" />
        <Link
          to={BUY_PATH}
          className="mt-2 flex h-[52px] w-full items-center justify-center gap-2 rounded-md bg-primary-deep text-sm font-bold uppercase tracking-[0.1em] text-primary-foreground no-underline"
        >
          Comprar almuerzos
          <ChevronRight className="h-[17px] w-[17px]" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
