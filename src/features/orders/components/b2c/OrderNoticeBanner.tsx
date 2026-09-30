import { Check, X } from 'lucide-react';
import type { OrderNotice } from '../../orderNotice';

interface Props {
  notice: OrderNotice;
  onDismiss?: () => void;
}

/**
 * Aviso de éxito de "Mis pedidos" (F29): "Horario cambiado", "Plato quitado",
 * "Pedido cancelado". Va dentro de la fila abierta o, si el pedido sale de su
 * día, arriba de la página. Presentacional puro.
 */
export function OrderNoticeBanner({ notice, onDismiss }: Props) {
  return (
    <div role="status" className="flex items-start gap-2.5 rounded-md bg-success/15 p-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground"
      >
        <Check className="h-3 w-3" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-bold text-foreground">{notice.title}</span>
        <span className="text-[13px] leading-snug text-muted-foreground">{notice.text}</span>
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar aviso"
        className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
