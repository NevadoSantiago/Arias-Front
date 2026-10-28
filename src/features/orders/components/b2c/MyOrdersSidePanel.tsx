import { Clock3, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import pedidoConfirmado from '@/assets/illustrations/PedidoConfirmado-transparente.svg';
import { GINGHAM_STYLE } from '@/lib/gingham';
import { formatLunches } from '../../lunches';

interface Props {
  /** Almuerzos disponibles; null mientras la billetera no carga. */
  available: number | null;
  /** Almuerzos reservados por pedidos programados; null mientras no se conocen. */
  committed: number | null;
  /** `getRestaurantConfig().cancelLimitMinutes`; null/undefined si no se conoce (el aviso se omite). */
  cancelLimitMinutes?: number | null;
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
 * El texto solo informa el plazo de devolución; cada pedido trae su propio
 * `refundableUntil`.
 */
export function MyOrdersSidePanel({ available, committed, cancelLimitMinutes }: Props) {
  return (
    <aside aria-label="Resumen" className="sticky top-6 flex flex-col gap-4">
      <section
        aria-labelledby="my-orders-balance-title"
        className="flex flex-col gap-3.5 rounded-xl border-[1.5px] p-5 shadow-[0_2px_10px_rgba(26,17,15,0.08)]"
        style={GINGHAM_STYLE}
      >
        <h2 id="my-orders-balance-title" className="m-0 text-[11px] font-semibold uppercase tracking-brand text-[#67514C]">
          Tu saldo
        </h2>
        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-[52px] font-black leading-none text-primary-deep">{available ?? '–'}</span>
          <span className="text-sm text-[#67514C]">almuerzos para pedir</span>
        </div>
        {committed !== null && (
          <div className="flex items-center gap-2.5 text-[13.5px] text-[#67514C]">
            <span aria-hidden="true" className="h-3 w-3 flex-none rounded-[3px] bg-primary" />
            <span>
              <strong className="font-bold text-[#1A110F]">{formatLunches(committed)}</strong> reservados en pedidos
              programados
            </span>
          </div>
        )}
        <Link
          to="/credits"
          className="flex h-[46px] items-center justify-center rounded-md border-[1.5px] border-primary-deep/40 bg-[#FFFCF5]/70 text-[13.5px] font-bold text-primary-deep no-underline"
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

      {cancelLimitMinutes != null && (
        <p className="m-0 flex items-start gap-2.5 text-[13px] leading-snug text-muted-foreground">
          <Clock3 className="mt-px h-4 w-4 flex-none text-primary-deep" aria-hidden="true" />
          <span>
            Si cancelás hasta {formatMinutes(cancelLimitMinutes)} antes del retiro, el almuerzo vuelve a tu saldo.
            Después, se descuenta.
          </span>
        </p>
      )}

      <img
        src={pedidoConfirmado}
        alt=""
        aria-hidden="true"
        className="pointer-events-none mt-2 h-auto w-[300px] max-w-full select-none self-center"
      />
    </aside>
  );
}
