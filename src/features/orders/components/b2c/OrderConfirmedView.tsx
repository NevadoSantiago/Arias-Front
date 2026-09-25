import { Check, Clock3, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatLunches } from '../../lunches';

export interface ConfirmedItem {
  name: string;
  side: string | null;
  costLabel: string;
}

interface Props {
  isToday: boolean;
  /** "jueves 24 de septiembre" (capitalizado). */
  dayLongLabel: string;
  pickupTimeLabel: string;
  items: ConfirmedItem[];
  totalLunches: number;
  /** Saldo disponible después de este pedido — solo informativo; null mientras no se conoce. */
  walletAvailableAfter: number | null;
  onBackToMenu: () => void;
}

/**
 * Vista de confirmación B2C (F4, prototipo `Main.dc.html` — vista
 * confirmada). Reemplaza al toast efímero `OrderConfirmation` (compartido
 * con B2B, sin cambios) por una vista tipo ticket que se queda en pantalla
 * hasta que el cliente elige volver al menú.
 */
export function OrderConfirmedView({
  isToday,
  dayLongLabel,
  pickupTimeLabel,
  items,
  totalLunches,
  walletAvailableAfter,
  onBackToMenu,
}: Props) {
  const title = isToday ? '¡Pedido confirmado!' : '¡Pedido programado!';
  const headline = `Te esperamos ${isToday ? 'hoy' : `el ${dayLongLabel.toLowerCase()}`} a las ${pickupTimeLabel}.`;

  return (
    <div className="flex flex-col items-center gap-5 px-4 pb-8 pt-6 text-center">
      <div
        aria-hidden="true"
        className="flex h-20 w-20 items-center justify-center rounded-full bg-success text-primary-foreground"
      >
        <Check className="h-10 w-10" aria-hidden="true" />
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <h1 className="font-display text-3xl font-bold leading-tight text-foreground">{title}</h1>
        <p className="text-[15px] text-muted-foreground">{headline}</p>
      </div>

      <div className="w-full rounded-lg border border-border bg-card text-left">
        <div className="flex flex-col gap-1 p-4">
          <span className="text-xs font-semibold uppercase tracking-brand text-muted-foreground">
            Retiro en el local
          </span>
          <span className="font-display text-xl font-bold leading-tight text-foreground">
            {dayLongLabel} · {pickupTimeLabel} hs
          </span>
        </div>
        <div aria-hidden="true" className="mx-4 border-t border-dashed border-border" />
        <ul className="m-0 flex list-none flex-col gap-2.5 p-4">
          {items.map((item, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold text-foreground">{item.name}</span>
                {item.side && <span className="text-[13px] text-muted-foreground">{item.side}</span>}
              </span>
              <span className="whitespace-nowrap text-[13px] font-semibold text-muted-foreground">
                {item.costLabel}
              </span>
            </li>
          ))}
        </ul>
        <div aria-hidden="true" className="mx-4 border-t border-dashed border-border" />
        <div className="flex items-center justify-between gap-3 p-4">
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] text-muted-foreground">
              {`Reservaste ${formatLunches(totalLunches)} para este pedido`}
            </span>
            {walletAvailableAfter !== null && (
              <span className="text-base font-bold text-foreground">
                {`Te quedan ${formatLunches(walletAvailableAfter)}`}
              </span>
            )}
          </span>
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-primary-deep"
          >
            <UtensilsCrossed className="h-6 w-6" aria-hidden="true" />
          </span>
        </div>
      </div>

      <ul className="m-0 flex w-full list-none flex-col gap-2.5 p-0 text-left">
        <li className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-foreground">
          <Clock3 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-primary-deep" aria-hidden="true" />
          <span>Te avisamos 25 minutos antes del horario de retiro.</span>
        </li>
      </ul>

      <div className="flex w-full flex-col gap-2.5">
        <button
          type="button"
          onClick={onBackToMenu}
          className="h-[52px] rounded-md bg-primary-deep text-sm font-bold uppercase tracking-brand text-primary-foreground"
        >
          Volver al menú
        </button>
        <Link
          to="/credits"
          className="flex h-[52px] items-center justify-center rounded-md border border-border bg-card text-sm font-semibold text-foreground no-underline"
        >
          Ver mis almuerzos
        </Link>
      </div>
    </div>
  );
}
