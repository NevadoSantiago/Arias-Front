import { CircleMinus, Lock, RotateCcw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { isRefundable, refundDeadlineLabel } from '../../cancellation';
import type { OrderV2 } from '../../services/ordersApi';

function Box({ tone, icon, title, children }: { tone: 'ok' | 'warn'; icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-md p-3',
        tone === 'ok' ? 'bg-success/15' : 'border border-warning bg-warning/15',
      )}
    >
      <span className="mt-px shrink-0">{icon}</span>
      <div className="flex flex-col gap-0.5 text-[13.5px] leading-snug">
        <strong className="font-bold text-foreground">{title}</strong>
        {children && <span className="text-foreground">{children}</span>}
      </div>
    </div>
  );
}

/** "los 2 almuerzos" / "el almuerzo". */
function theLunches(count: number): string {
  return count > 1 ? `los ${count} almuerzos` : 'el almuerzo';
}

interface Props {
  order: OrderV2;
  now: Date;
  /** El pedido se puede cancelar ahora (la acción está disponible): recién ahí tiene sentido el plazo. */
  cancellable: boolean;
}

/**
 * Recuadro del plazo de devolución en la comanda abierta (prototipo "Mis pedidos
 * cancelar"): antes de `refundableUntil` promete la devolución, después avisa
 * que todavía se puede cancelar pero se descuenta. En un pedido cancelado dice
 * cómo terminó (devuelto / consumido) y en uno entregado, que ya no se cancela.
 */
export function RefundWindowNotice({ order, now, cancellable }: Props) {
  const deadline = refundDeadlineLabel(order);

  if (order.estado === 'ENTREGADO') {
    return (
      <p className="m-0 flex items-center gap-2 rounded-md bg-muted p-2.5 text-[13px] leading-snug text-foreground">
        <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        Ya lo retiraste: un pedido entregado no se puede cancelar.
      </p>
    );
  }

  if (order.estado === 'CANCELADO') {
    if (order.cancelRefunded === true) {
      const count = order.creditTotal;
      return (
        <Box
          tone="ok"
          icon={<RotateCcw className="h-5 w-5 text-[#3F6B27]" aria-hidden="true" />}
          title={count === 1 ? 'Almuerzo devuelto' : `${count} almuerzos devueltos`}
        >
          {count === 1 ? 'Volvió a tu saldo cuando cancelaste.' : 'Volvieron a tu saldo cuando cancelaste.'}
        </Box>
      );
    }
    if (order.cancelRefunded === false) {
      const count = order.creditTotal;
      return (
        <Box
          tone="warn"
          icon={<CircleMinus className="h-5 w-5 text-warning-deep" aria-hidden="true" />}
          title={count === 1 ? '1 almuerzo consumido' : `${count} almuerzos consumidos`}
        >
          {deadline
            ? `Lo cancelaste después del límite de las ${deadline}, así que ${count === 1 ? 'se cobró' : 'se cobraron'} igual.`
            : `Lo cancelaste después del límite de devolución, así que ${count === 1 ? 'se cobró' : 'se cobraron'} igual.`}
        </Box>
      );
    }
    return null;
  }

  if (!cancellable || order.estado === 'PENDIENTE_PAGO' || !deadline) return null;

  const the = theLunches(order.creditTotal);
  if (isRefundable(order, now)) {
    return (
      <Box
        tone="ok"
        icon={<RotateCcw className="h-5 w-5 text-[#3F6B27]" aria-hidden="true" />}
        title={`Si cancelás hasta las ${deadline}, te devolvemos ${the}.`}
      >
        Si lo cancelás después, se descuenta
      </Box>
    );
  }
  return (
    <Box
      tone="warn"
      icon={<TriangleAlert className="h-5 w-5 text-warning-deep" aria-hidden="true" />}
      title={`Ya pasó el límite de las ${deadline}.`}
    >
      Todavía podés cancelarlo, pero {the} {order.creditTotal > 1 ? 'no se devuelven' : 'no se devuelve'}.
    </Box>
  );
}
