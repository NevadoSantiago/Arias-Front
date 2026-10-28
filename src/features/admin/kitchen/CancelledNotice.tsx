import { CircleX, X } from 'lucide-react';
import type { CancelledOrder } from '@/features/admin/services/adminApi';

interface CancelledNoticeProps {
  order: CancelledOrder;
  onShow: () => void;
  onDismiss: () => void;
}

/** Tells the kitchen that an order whose ticket is already out was cancelled. */
export function CancelledNotice({ order, onShow, onDismiss }: CancelledNoticeProps) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-l-[5px] border-destructive/35 border-l-destructive bg-card py-3 pl-4 pr-3.5 shadow-md"
    >
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
      >
        <CircleX className="h-5 w-5" />
      </span>
      <p className="m-0 min-w-[280px] flex-1 text-sm leading-snug">
        <strong className="font-bold">{`Se canceló el pedido N° ${order.id} · ${order.customerNickname}.`}</strong> Ya estaba
        comandado: no lo prepares y descartá la comanda impresa.
      </p>
      <button
        type="button"
        onClick={onShow}
        className="min-h-[44px] rounded-md border-[1.5px] border-destructive px-3.5 text-[13px] font-bold text-destructive"
      >
        Ver cancelados
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar aviso"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-foreground"
      >
        <X className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>
    </div>
  );
}
