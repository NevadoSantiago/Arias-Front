import { Clock3, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatLunches } from '../../lunches';

interface Props {
  /** Almuerzos disponibles; null mientras la billetera no carga. */
  available: number | null;
  /** Almuerzos reservados por pedidos programados; null mientras no se conocen. */
  committed: number | null;
  /** `getRestaurantConfig().pickupLeadMinutes`; null/undefined si no se conoce (el aviso se omite). */
  pickupLeadMinutes?: number | null;
}

/** "20 minutos" / "1 minuto". */
function formatMinutes(minutes: number): string {
  return `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
}

/**
 * Panel lateral de "Mis pedidos" en escritorio (F22b, prototipo
 * `DesktopMyOrders.dc.html`): saldo (disponibles y reservados), "Hacer un
 * pedido" y el aviso del corte de cancelación. Presentacional puro: los datos
 * salen de `useWallet` y de la config del restaurante que la página ya pide.
 * El corte real lo decide siempre el backend (`cancellable`); el texto solo lo
 * informa.
 */
export function MyOrdersSidePanel({ available, committed, pickupLeadMinutes }: Props) {
  return (
    <aside aria-label="Resumen" className="sticky top-6 flex flex-col gap-4">
      <section
        aria-labelledby="my-orders-balance-title"
        className="flex flex-col gap-3.5 rounded-xl bg-foreground p-5 text-background"
      >
        <h2
          id="my-orders-balance-title"
          className="m-0 text-[11px] font-semibold uppercase tracking-brand opacity-80"
        >
          Tu saldo
        </h2>
        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-[52px] font-black leading-none">{available ?? '–'}</span>
          <span className="text-sm opacity-80">almuerzos para pedir</span>
        </div>
        {committed !== null && (
          <div className="flex items-center gap-2.5 text-[13.5px] opacity-90">
            <span aria-hidden="true" className="h-3 w-3 flex-none rounded-[3px] bg-warning" />
            <span>
              <strong className="font-bold">{formatLunches(committed)}</strong> reservados en pedidos programados
            </span>
          </div>
        )}
        <Link
          to="/credits"
          className="flex h-[46px] items-center justify-center rounded-md border-[1.5px] border-background/30 text-[13.5px] font-bold text-background no-underline"
        >
          Ver mis almuerzos
        </Link>
      </section>

      <Link
        to="/orders/today"
        className="flex h-[54px] items-center justify-center gap-2 rounded-md bg-primary-deep text-sm font-bold uppercase tracking-brand text-primary-foreground no-underline"
      >
        <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
        Hacer un pedido
      </Link>

      {pickupLeadMinutes != null && (
        <p className="m-0 flex items-start gap-2.5 text-[13px] leading-snug text-muted-foreground">
          <Clock3 className="mt-px h-4 w-4 flex-none text-primary-deep" aria-hidden="true" />
          <span>
            Podés cancelar un pedido hasta {formatMinutes(pickupLeadMinutes)} antes del retiro. Después ya lo estamos
            preparando.
          </span>
        </p>
      )}
    </aside>
  );
}
