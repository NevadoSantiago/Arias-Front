import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { getPickupSlots } from '../services/ordersApi';

interface Props {
  /** "YYYY-MM-DD" — fecha para la que se piden horarios de retiro. */
  fecha: string;
  /** ISO-8601 instant del horario seleccionado, o null si todavía no eligió. */
  selected: string | null;
  onSelect: (pickupAt: string) => void;
}

function formatSlotTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Selector de horario de retiro — muestra ÚNICAMENTE los slots que devuelve
 * `GET /api/v1/orders/pickup-slots`. El frontend nunca genera horarios por su
 * cuenta: la ventana de servicio, la antelación mínima, la semana
 * habilitada y las fechas deshabilitadas son decisión exclusiva del backend
 * (spec backend `pickup-scheduling`).
 */
export function PickupSlotSelector({ fecha, selected, onSelect }: Props) {
  const { data: slots, isLoading } = useQuery({
    queryKey: ['pickupSlots', fecha],
    queryFn: () => getPickupSlots(fecha),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando horarios…</p>;
  }

  if (!slots || slots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay horarios de retiro disponibles para esa fecha.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Horario de retiro">
      {slots.map((slot) => (
        <button
          key={slot}
          type="button"
          onClick={() => onSelect(slot)}
          aria-pressed={selected === slot}
          className={cn(
            'px-3 py-2 rounded-md border text-sm transition-colors',
            selected === slot
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card border-border text-foreground hover:border-primary'
          )}
        >
          {formatSlotTime(slot)}
        </button>
      ))}
    </div>
  );
}
