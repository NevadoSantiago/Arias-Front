import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NoPickupSlotsNoticeProps {
  /** Próximo día abierto (`label` como "Martes 21"); sin él, solo se pide elegir otro día. */
  nextDay?: { date: string; label: string };
  onGoToDay?: (date: string) => void;
}

/**
 * Aviso de "día sin horarios" de `B2cOrderPage`: el día elegido ya no tiene
 * horarios de retiro (`getPickupSlots` devolvió una lista vacía), así que no se
 * puede armar un pedido para ese día. El backend sigue validando el horario al
 * confirmar; esto es solo orientación: con `nextDay` ofrece ir al menú del
 * próximo día abierto, y sin él pide elegir otro día.
 */
export function NoPickupSlotsNotice({ nextDay, onGoToDay }: NoPickupSlotsNoticeProps) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-xl border border-warning bg-warning/10 p-4">
      <Clock className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="m-0 font-display text-base font-bold leading-tight text-foreground">
          Ya no quedan horarios de retiro para este día
        </h2>
        {nextDay ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1 self-start"
            onClick={() => onGoToDay?.(nextDay.date)}
          >
            {`Ir al menú del ${nextDay.label.toLowerCase()}`}
          </Button>
        ) : (
          <p className="m-0 text-sm leading-snug text-muted-foreground">Elegí otro día para armar tu pedido.</p>
        )}
      </div>
    </div>
  );
}
